import router from 'router';

import route from '../route';
import protect from '../middleware/protect';
import requireActiveConnection from '../middleware/requireActiveConnection';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/waitlist';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

export default function waitlistRoutes() {
  return router()
    // GET /waitlist/ - List users in the waitlist.
    .get(
      '/',
      route(controller.getWaitlist),
    )
    // POST /waitlist/ - Add a user to the waitlist.
    .post(
      '/',
      protect(),
      requireActiveConnection(),
      checkFields({ userID: 'string' }),
      route(controller.addToWaitlist),
    )
    // DELETE /waitlist/ - Clear the waitlist.
    .delete(
      '/',
      protect(ROLE_MANAGER),
      route(controller.clearWaitlist),
    )
    // PUT /waitlist/move - Move a user to a different position in the waitlist.
    .put(
      '/move',
      protect(ROLE_MODERATOR),
      checkFields({
        userID: 'string',
        position: 'number',
      }),
      route(controller.moveWaitlist),
    )
    // DELETE /waitlist/:id - Remove a user from the waitlist.
    .delete(
      '/:id',
      protect(),
      route(controller.removeFromWaitlist),
    )
    // PUT /waitlist/lock - Lock or unlock the waitlist.
    .put(
      '/lock',
      protect(ROLE_MODERATOR),
      checkFields({ lock: 'boolean' }),
      route(controller.lockWaitlist),
    );
}
