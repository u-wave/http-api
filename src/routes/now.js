import debug from 'debug';
import router from 'router';

import * as controller from '../controllers/now';
import handleError from '../errors';

const log = debug('uwave:api:v1:now');

export default function nowRoute() {
  return router()
    .get('/', (req, res) => {
      if (!req.user) {
        req.user = { id: null };
      }

      controller.getState(req.uwave, req.user.id)
      .then(state => res.status(200).json(state))
      .catch(e => handleError(res, e, log));
    });
}
