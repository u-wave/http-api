import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/booth';
import { ROLE_MODERATOR } from '../roles';

export default function boothRoutes() {
  return router()
    // GET /booth/ - Get the current booth status.
    .get(
      '/',
      route(controller.getBooth),
    )
    // POST /booth/skip - Skip the current DJ's play.
    .post(
      '/skip',
      protect(),
      route(controller.skipBooth),
    )
    // POST /booth/replace - Replace the current DJ with someone else.
    .post(
      '/replace',
      protect(ROLE_MODERATOR),
      checkFields({ userID: 'string' }),
      route(controller.replaceBooth),
    )
    // POST /booth/favorite - Add the current play to your favorites.
    .post(
      '/favorite',
      protect(),
      checkFields({
        playlistID: 'string',
        historyID: 'string',
      }),
      route(controller.favorite),
    )
    // GET /booth/history - Get recent plays.
    .get(
      '/history',
      route(controller.getHistory),
    );
}
