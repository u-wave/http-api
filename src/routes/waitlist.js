import router from 'router';
import route from '../route';
import * as validations from '../validations';
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
      checkFields(validations.joinWaitlist),
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
      checkFields(validations.moveWaitlist),
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
      checkFields(validations.lockWaitlist),
      route(controller.lockWaitlist),
    );
}
