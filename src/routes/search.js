import debug from 'debug';
import router from 'router';

import protect from '../middleware/protect';
import * as controller from '../controllers/search';
import { handleError } from '../errors';

const log = debug('uwave:api:v1:search');

export default function searchRoutes() {
  return router()
    .use(protect())
    .get('/', (req, res) => {
      controller.search(req.uwave, req.query.query)
        .then(results => res.status(200).json(results))
        .catch(e => handleError(res, e, log));
    });
}
