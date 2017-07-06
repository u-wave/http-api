import router from 'router';

import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/search';

export default function searchRoutes() {
  return router()
    .use(protect())
    .get(
      '/',
      route(controller.searchAll),
    )
    .get(
      '/:source',
      route(controller.search),
    );
}
