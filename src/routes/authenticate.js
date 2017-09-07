import router from 'router';
import route from '../route';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/authenticate';

export default function authenticateRoutes(v1, options) {
  return router()
    // GET /auth/ - Show current user information.
    .get(
      '/',
      route(controller.getCurrentUser),
    )
    // POST /auth/register - Create a new user account.
    .post(
      '/register',
      checkFields({
        email: 'string',
        username: 'string',
        password: 'string',
      }),
      route(controller.register.bind(null, options)),
    )
    // POST /auth/login - Log in as an existing user.
    .post(
      '/login',
      checkFields({ email: 'string', password: 'string' }),
      route(controller.login.bind(null, options)),
    )
    // POST /password/reset - Request a password reset.
    .post(
      '/password/reset',
      checkFields({ email: 'string' }),
      route(controller.reset.bind(null, options)),
    )
    // POST /password/reset/:reset - Change the password using a reset token.
    .post(
      '/password/reset/:reset',
      checkFields({ password: 'string' }),
      route(controller.changePassword),
    )
    // DELETE /session/:id - Unused? Forcibly quit a user's session.
    .delete(
      '/session/:id',
      route(controller.removeSession),
    );
}
