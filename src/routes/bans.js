import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import { ROLE_MODERATOR, ROLE_MANAGER } from '../roles';
import * as controller from '../controllers/bans';

export default function banRoutes() {
  return router()
    .get(
      '/',
      protect(ROLE_MODERATOR),
      route(controller.getBans),
    )

    .post(
      '/',
      protect(ROLE_MODERATOR),
      route(controller.addBan),
    )

    .delete(
      '/:userID',
      protect(ROLE_MANAGER),
      route(controller.removeBan),
    );
}
