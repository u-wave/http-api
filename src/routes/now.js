import router from 'router';

import * as controller from '../controllers/now';
import route from '../route';

export default function nowRoute() {
  return router()
    // GET /now/ - Get a combined view of the current state.
    .get(
      '/',
      route(controller.getState),
    );
}
