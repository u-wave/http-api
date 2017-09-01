import createRouter from 'router';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/booth';
import { ROLE_MODERATOR } from '../roles';
import route from '../route';

export default function boothRoutes() {
  const router = createRouter()
    .get(
      '/',
      route(controller.getBooth),
    )
    .post(
      '/skip',
      protect(),
      route(controller.skipBooth),
    )
    .post(
      '/replace',
      protect(ROLE_MODERATOR),
      checkFields({ userID: 'string' }),
      route(controller.replaceBooth),
    )
    .post(
      '/favorite',
      protect(),
      checkFields({
        playlistID: 'string',
        historyID: 'string',
      }),
      route(controller.favorite),
    )
    .get(
      '/history',
      route(controller.getHistory),
    );

  return router;
}
