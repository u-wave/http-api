import Router from 'router';

// routes
import authenticate from './routes/authenticate';
import bans from './routes/bans';
import playlist from './routes/playlists';
import waitlist from './routes/waitlist';
import search from './routes/search';
import booth from './routes/booth';
import users from './routes/users';
import staff from './routes/staff';
import chat from './routes/chat';
import motd from './routes/motd';
import now from './routes/now';
import imports from './routes/import';

// middleware
import bodyParser from 'body-parser';
import attachUwaveMeta from './middleware/attachUwaveMeta';
import authenticator from './middleware/authenticator';
import errorHandler from './middleware/errorHandler';
import rateLimit from './middleware/rateLimit';

import WSServer from './sockets';

function missingServerOption() {
  throw new TypeError(`
Exactly one of "options.server" and "options.socketPort" is required. These
options are used to attach the WebSocket server to the correct HTTP server.

An example of how to attach the WebSocket server to an existing HTTP server
using Express:

    import webApi from 'u-wave-api-v1';
    const app = express();
    const server = app.listen(80);

    app.use('/v1', webApi(uwave, {
      server: server,
      ...
    }));

Alternatively, you can provide a port for the socket server to listen on:

    import webApi from 'u-wave-api-v1';
    const app = express();

    app.use('/v1', webApi(uwave, {
      socketPort: 6042,
      ...
    }));
  `);
}

export default class ApiV1 extends Router {
  constructor(uw, options = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError(
        'Expected a u-wave-core instance in the first parameter. If you are ' +
        'developing, you may have to upgrade your u-wave-* modules.'
      );
    }

    if (!options.server && !options.socketPort) {
      missingServerOption(options);
    }

    if (!options.secret) {
      throw new TypeError(
        '"options.secret" is empty. This option is used to sign authentication ' +
        'keys, and is required for security reasons.'
      );
    }

    if (options.recaptcha && !options.recaptcha.secret) {
      throw new TypeError(
        'ReCaptcha validation is enabled, but "options.recaptcha.secret" is ' +
        'not set. Please set "options.recaptcha.secret" to your ReCaptcha ' +
        'secret, or disable ReCaptcha validation by setting "options.recaptcha" ' +
        'to "false".'
      );
    }

    const router = super(options);

    this.uw = uw;
    this.sockets = new WSServer(uw, {
      port: options.socketPort,
      server: options.server,
      secret: options.secret
    });

    this
      .use(bodyParser.json())
      .use(this.attachUwaveToRequest())
      .use(authenticator(this, {
        secret: options.secret,
        recaptcha: options.recaptcha
      }))
      .use(rateLimit('api-v1-http', { max: 500, duration: 60 * 1000 }));

    this
      .use('/auth', authenticate(this, { secret: options.secret }))
      .use('/bans', bans(this))
      .use('/booth', booth(this))
      .use('/chat', chat(this))
      .use('/import', imports(this))
      .use('/motd', motd(this))
      .use('/now', now(this))
      .use('/playlists', playlist(this))
      .use('/search', search(this))
      .use('/staff', staff(this))
      .use('/users', users(this))
      .use('/waitlist', waitlist(this));

    this.use(errorHandler(this));

    return router;
  }

  /**
   * Create middleware to attach the u-wave-core instance and the u-wave-api-v1
   * instance to incoming requests. This can be used to access eg. configuration
   * options or session information inside other routes (ones not added by
   * u-wave-api-v1).
   *
   * @return {Function} Middleware.
   */
  attachUwaveToRequest() {
    return attachUwaveMeta(this, this.uw);
  }

  /**
   * @return Number of open guest connections.
   */
  getGuestCount() {
    return this.sockets.getGuestCount();
  }

  destroy() {
    this.sockets.destroy();
    this.sockets = null;
  }
}
