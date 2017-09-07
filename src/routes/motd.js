import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/motd';
import { ROLE_MANAGER } from '../roles';

export default function motdRoutes() {
  return router()
    // GET /motd/ - Get the message of the day.
    .get(
      '/',
      route(controller.getMotd),
    )
    // PUT /motd/ - Set the message of the day.
    .put(
      '/',
      protect(ROLE_MANAGER),
      checkFields({ motd: 'string' }),
      route(controller.setMotd),
    );
}
