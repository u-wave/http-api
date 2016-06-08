import Promise from 'bluebird';
import createDebug from 'debug';
import { NotFoundError } from '../errors';

const log = createDebug('uwave:api:v1:search');

export function searchAll(uw, query) {
  const promises = {};
  uw.sources.forEach((source) => {
    promises[source.type] = source.search(query)
      .catch((error) => {
        log(error.message);
        // Default to empty search on failure, for now.
        return [];
      });
  });

  return Promise.props(promises);
}

export async function search(uw, sourceName, query) {
  const source = uw.source(sourceName);
  if (!source) {
    throw new NotFoundError('Source not found.');
  }
  return await source.search(query);
}
