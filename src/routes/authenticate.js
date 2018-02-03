import router from 'router';
import route from '../route';
import * as validations from '../validations';
import protect from '../middleware/protect';
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
      checkFields(validations.register),
      route(controller.register.bind(null, options)),
    )
    // POST /auth/login - Log in as an existing user.
    .post(
      '/login',
      checkFields(validations.login),
      v1.passport.authenticate('local', { failWithError: true }),
      route(controller.login.bind(null, options)),
    )
    // POST /password/reset - Request a password reset.
    .post(
      '/password/reset',
      checkFields(validations.requestPasswordReset),
      route(controller.reset.bind(null, options)),
    )
    // POST /password/reset/:reset - Change the password using a reset token.
    .post(
      '/password/reset/:reset',
      checkFields(validations.passwordReset),
      route(controller.changePassword),
    )
    // GET /socket - Obtain an authentication token for the WebSocket server.
    .get(
      '/socket',
      protect(),
      route(controller.getSocketToken)
    )
    // DELETE /session/:id - Unused? Forcibly quit a user's session.
    .delete(
      '/session/:id',
      route(controller.removeSession),
    )
    // GET /service/google - Initiate a social login using Google.
    .get(
      '/service/google',
      v1.passport.authenticate('google'),
      route(controller.login.bind(null, options)),
    )
    // GET /service/google/callback - Finish a social login using Google.
    .get(
      '/service/google/callback',
      v1.passport.authenticate('google'),
      route(controller.socialLoginCallback.bind(null, options)),
    );
}
