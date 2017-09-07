import router from 'router';
import route from '../route';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/authenticate';

export default function authenticateRoutes(v1, options) {
  return router()
    .get(
      '/',
      route(controller.getCurrentUser),
    )
    .post(
      '/register',
      checkFields({
        email: 'string',
        username: 'string',
        password: 'string',
      }),
      route(controller.register.bind(null, options)),
    )
    .post(
      '/login',
      checkFields({ email: 'string', password: 'string' }),
      route(controller.login.bind(null, options)),
    )
    .post(
      '/password/reset',
      checkFields({ email: 'string' }),
      route(controller.reset.bind(null, options)),
    )
    .post(
      '/password/reset/:reset',
      checkFields({ password: 'string' }),
      route(controller.changePassword),
    )
    .delete(
      '/session/:id',
      route(controller.removeSession),
    );
}
