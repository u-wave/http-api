import router from 'router';
import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import rateLimit from '../middleware/rateLimit';
import * as controller from '../controllers/users';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

export default function userRoutes() {
  return router()
    // GET /users/ - List user accounts.
    .get(
      '/',
      protect(ROLE_MANAGER),
      route(controller.getUsers),
    )
    // GET /users/:id - Show a single user.
    .get(
      '/:id',
      checkFields(validations.getUser),
      route(controller.getUser),
    )
    // POST /users/:id/mute - Mute a user in the chat.
    // TODO move this to /mutes/ namespace.
    .post(
      '/:id/mute',
      protect(ROLE_MODERATOR),
      checkFields(validations.muteUser),
      route(controller.muteUser),
    )
    // DELETE /users/:id/mute - Unmute a user in the chat.
    // TODO move this to /mutes/ namespace.
    .delete(
      '/:id/mute',
      protect(ROLE_MODERATOR),
      checkFields(validations.unmuteUser),
      route(controller.unmuteUser),
    )
    // PUT /users/:id/role - Change a user's role.
    .put(
      '/:id/role',
      protect(ROLE_MANAGER),
      checkFields(validations.setUserRole),
      route(controller.changeRole),
    )
    // PUT /users/:id/username - Change a user's username.
    .put(
      '/:id/username',
      checkFields(validations.setUserName),
      rateLimit('change-username', {
        max: 5,
        duration: 60 * 60 * 1000,
        error: (_, retryAfter) =>
          `You can only change your username five times per hour. Try again in ${retryAfter}.`,
      }),
      route(controller.changeUsername),
    )
    // PUT /users/:id/avatar - Change a user's username.
    .put(
      '/:id/avatar',
      protect(),
      checkFields(validations.setUserAvatar),
      route(controller.changeAvatar),
    )
    // PUT /users/:id/status - Change a user's online status.
    // TODO Unused, maybe remove?
    .put(
      '/:id/status',
      protect(),
      checkFields(validations.setUserStatus),
      route(controller.changeStatus),
    )
    // GET /users/:id/history - Show recent plays by a user.
    .get(
      '/:id/history',
      checkFields(validations.getUserHistory),
      route(controller.getHistory),
    );
}
