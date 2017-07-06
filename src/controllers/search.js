import Promise from 'bluebird';
import createDebug from 'debug';
import { NotFoundError } from '../errors';
import toListResponse from '../utils/toListResponse';

const log = createDebug('uwave:api:v1:search');

export function searchAll(req) {
  const { query } = req.query;
  const promises = {};

  req.uwave.sources.forEach((source) => {
    promises[source.type] = source.search(query)
      .catch((error) => {
        log(error.message);
        // Default to empty search on failure, for now.
        return [];
      });
  });

  return Promise.props(promises);
}

export async function search(req) {
  const sourceName = req.params.source;
  const { query } = req.query;

  const source = req.uwave.source(sourceName);
  if (!source) {
    throw new NotFoundError('Source not found.');
  }

  const results = await source.search(query);

  return toListResponse(results, { url: req.fullUrl });
}
