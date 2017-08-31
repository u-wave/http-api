import router from 'router';

import * as controller from '../controllers/now';
import route from '../route';

export default function nowRoute() {
  return router()
    .get(
      '/',
      route(controller.getState),
    );
}
