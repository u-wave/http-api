import router from 'router';

import * as controller from '../controllers/now';

export default function nowRoute(v1) {
  return router()
    .get('/', (req, res, next) => {
      controller.getState(v1, req.uwave, req.user)
        .then(state => res.status(200).json(state))
        .catch(next);
    });
}
