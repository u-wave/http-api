import router from 'router';

import protect from '../middleware/protect';
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

export default function importRoutes() {
  return router()
    .use(protect())
    .all('/:source/:action', (req, res, next) => {
      const source = getImportableSource(req);

      const opts = mergeImportParameters(req);

      source.import(req.user, opts)
        .then(response => res.json(response))
        .catch(error => next(APIError.wrap(error)));
    })
    .all('/:source', (req, res, next) => {
      const source = getImportableSource(req);

      const opts = mergeImportParameters(req);

      source.import(req.user, opts)
        .then(response => res.json(response))
        .catch(error => next(APIError.wrap(error)));
    });
}
