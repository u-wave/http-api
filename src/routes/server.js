import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import * as controller from '../controllers/server';

export default function serverRoutes() {
  return router()
    // GET /server/time - Show the current server time.
    .get(
      '/time',
      route(controller.getServerTime),
    )
    // GET /server/config/schema - Show the schema describing server configuration. Superuser only atm!
    .get(
      '/config/schema',
      protect('admin'),
      route(controller.getConfigSchema),
    )
    // GET /server/config
    .get(
      '/config',
      protect('admin'),
      route(controller.getAllConfig),
    )
    // GET /server/config:key
    .get(
      '/config/:key',
      protect('admin'),
      route(controller.getConfig),
    )
    // PUT /server/config/:key - Update server configuration.
    .put(
      '/config/:key',
      protect('admin'),
      route(controller.updateConfig)
    );
}
