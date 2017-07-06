import router from 'router';

import route from '../route';
import * as controller from '../controllers/server';

export default function serverRoutes() {
  return router()
    .get(
      '/time',
      route(controller.getServerTime),
    );
}
