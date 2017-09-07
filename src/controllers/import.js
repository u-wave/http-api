import { NotFoundError, APIError } from '../errors';

const getImportableSource = (req) => {
  const source = req.uwave.source(req.params.source);
  if (!source) {
    throw new NotFoundError(`Source "${req.params.source}" not found.`);
  }
  if (!source.import) {
    throw new NotFoundError(`Source "${req.params.source}" does not support importing.`);
  }
  return source;
};

const mergeImportParameters = req => ({
  ...req.query,
  ...req.body,
  ...req.params,
});

// eslint-disable-next-line import/prefer-default-export
export async function importAction(req) {
  const source = getImportableSource(req);

  const opts = mergeImportParameters(req);

  try {
    const response = await source.import(req.user, opts);

    return response;
  } catch (err) {
    throw APIError.wrap(err);
  }
}
