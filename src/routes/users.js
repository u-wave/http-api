import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import rateLimit from '../middleware/rateLimit';
import * as controller from '../controllers/users';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

export default function userRoutes() {
  return router()
    .get(
      '/',
      protect(ROLE_MANAGER),
      route(controller.getUsers),
    )
    .get(
      '/:id',
      route(controller.getUser),
    )
    .post(
      '/:id/mute',
      protect(ROLE_MODERATOR),
      route(controller.muteUser),
    )
    .delete(
      '/:id/mute',
      protect(ROLE_MODERATOR),
      route(controller.unmuteUser),
    )
    .put(
      '/:id/role',
      protect(ROLE_MANAGER),
      checkFields({ role: 'number' }),
      route(controller.changeRole),
    )
    .put(
      '/:id/username',
      checkFields({ username: 'string' }),
      rateLimit('change-username', {
        max: 5,
        duration: 60 * 60 * 1000,
        error: (_, retryAfter) =>
          `You can only change your username five times per hour. Try again in ${retryAfter}.`,
      }),
      route(controller.changeUsername),
    )
    .put(
      '/:id/avatar',
      protect(),
      checkFields({ avatar: 'string' }),
      route(controller.changeAvatar),
    )
    .put(
      '/:id/status',
      protect(),
      checkFields({ status: 'number' }),
      route(controller.changeStatus),
    )
    .get(
      '/:id/history',
      route(controller.getHistory),
    );
}
