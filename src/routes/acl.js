import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/acl';

export default function serverRoutes() {
  return router()
    // GET /roles - List available roles.
    .get(
      '/',
      route(controller.list),
    )
    // PUT /roles/:name - Create a new role.
    .put(
      '/:name',
      protect('acl.create'),
      route(controller.createRole),
    )
    // DELETE /roles/:name - Delete a new role.
    .delete(
      '/:name',
      protect('acl.delete'),
      route(controller.deleteRole),
    );
}
