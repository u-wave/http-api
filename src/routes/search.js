import router from 'router';

import protect from '../middleware/protect';
import { searchAll, search } from '../controllers/search';
import toListResponse from '../utils/toListResponse';

export default function searchRoutes() {
  return router()
    .use(protect())
    .get('/', (req, res, next) => {
      searchAll(req.uwave, req.query.query)
        .then(results => res.json(results))
        .catch(next);
    })
    .get('/:source', (req, res, next) => {
      search(req.uwave, req.params.source, req.query.query)
        .then(results => toListResponse(results, { url: req.fullUrl }))
        .then(list => res.json(list))
        .catch(next);
    });
}
