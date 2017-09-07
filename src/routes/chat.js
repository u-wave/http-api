import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import { ROLE_MODERATOR } from '../roles';
import * as controller from '../controllers/chat';

export default function chatRoutes() {
  return router()
    // DELETE /v1/chat/ - Clear the chat (delete all messages).
    .delete(
      '/',
      protect(ROLE_MODERATOR),
      route(controller.deleteAll),
    )
    // DELETE /v1/chat/user/:id - Delete all messages by a user.
    .delete(
      '/user/:id',
      protect(ROLE_MODERATOR),
      route(controller.deleteByUser),
    )
    // DELETE /v1/chat/:id - Delete a chat message.
    .delete(
      '/:id',
      protect(ROLE_MODERATOR),
      route(controller.deleteMessage),
    );
}
