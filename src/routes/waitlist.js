import router from 'router';

import route from '../route';
import protect from '../middleware/protect';
import requireActiveConnection from '../middleware/requireActiveConnection';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/waitlist';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

export default function waitlistRoutes() {
  return router()
    .get(
      '/',
      route(controller.getWaitlist),
    )
    .post(
      '/',
      protect(),
      requireActiveConnection(),
      checkFields({ userID: 'string' }),
      route(controller.addToWaitlist),
    )
    .delete(
      '/',
      protect(ROLE_MANAGER),
      route(controller.clearWaitlist),
    )
    .put(
      '/move',
      protect(ROLE_MODERATOR),
      checkFields({
        userID: 'string',
        position: 'number',
      }),
      route(controller.moveWaitlist),
    )
    .delete(
      '/:id',
      protect(),
      route(controller.removeFromWaitlist),
    )
    .put(
      '/lock',
      protect(ROLE_MODERATOR),
      checkFields({ lock: 'boolean' }),
      route(controller.lockWaitlist),
    );
}
