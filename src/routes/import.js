import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/import';

export default function importRoutes() {
  return router()
    .all(
      '/:source/:action',
      protect(),
      route(controller.importAction),
    )
    .all(
      '/:source',
      protect(),
      route(controller.importAction),
    );
}
