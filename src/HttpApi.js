import Router from 'router';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import url from 'url';

// routes
import authenticate from './routes/authenticate';
import acl from './routes/acl';
import bans from './routes/bans';
import playlist from './routes/playlists';
import waitlist from './routes/waitlist';
import search from './routes/search';
import booth from './routes/booth';
import users from './routes/users';
import chat from './routes/chat';
import motd from './routes/motd';
import now from './routes/now';
import imports from './routes/import';

// middleware
import addFullUrl from './middleware/addFullUrl';
import attachUwaveMeta from './middleware/attachUwaveMeta';
import errorHandler from './middleware/errorHandler';
import rateLimit from './middleware/rateLimit';

import createPassport from './passport';
import WSServer from './sockets';

function missingServerOption() {
  throw new TypeError(`
Exactly one of "options.server" and "options.socketPort" is required. These
options are used to attach the WebSocket server to the correct HTTP server.

An example of how to attach the WebSocket server to an existing HTTP server
using Express:

    import httpApi from 'u-wave-http-api';
    const app = express();
    const server = app.listen(80);

    app.use('/api', httpApi(uwave, {
      server: server,
      ...
    }));

Alternatively, you can provide a port for the socket server to listen on:

    import httpApi from 'u-wave-http-api';
    const app = express();

    app.use('/api', httpApi(uwave, {
      socketPort: 6042,
      ...
    }));
  `);
}

function defaultCreatePasswordResetEmail({ token, requestUrl }) {
  const parsed = url.parse(requestUrl);
  const { hostname } = parsed;
  const webroot = url.format({
    ...parsed,
    pathname: '',
  });
  return {
    from: `noreply@${hostname}`,
    subject: 'üWave Password Reset Request',
    text: `
      Hello,

      To reset your password, please visit:
      ${webroot}/reset/${token}
    `,
  };
}

export default class UwaveHttpApi extends Router {
  constructor(uw, options = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError('Expected a u-wave-core instance in the first parameter. If you are ' +
        'developing, you may have to upgrade your u-wave-* modules.');
    }

    if (!options.server && !options.socketPort) {
      missingServerOption(options);
    }

    if (!options.secret) {
      throw new TypeError('"options.secret" is empty. This option is used to sign authentication ' +
        'keys, and is required for security reasons.');
    }

    if (options.recaptcha && !options.recaptcha.secret) {
      throw new TypeError('ReCaptcha validation is enabled, but "options.recaptcha.secret" is ' +
        'not set. Please set "options.recaptcha.secret" to your ReCaptcha ' +
        'secret, or disable ReCaptcha validation by setting "options.recaptcha" ' +
        'to "false".');
    }

    if (options.onError != null && typeof options.onError !== 'function') {
      throw new TypeError('"options.onError" must be a function.');
    }

    const router = super(options);

    this.uw = uw;
    this.sockets = new WSServer(uw, {
      port: options.socketPort,
      server: options.server,
      secret: options.secret,
    });

    this.passport = createPassport(uw, {
      secret: options.secret,
      auth: options.auth || {},
    });

    this
      .use(bodyParser.json())
      .use(cookieParser())
      .use(this.passport.initialize())
      .use(addFullUrl())
      .use(this.attachUwaveToRequest())
      .use(this.passport.authenticate('jwt'))
      .use(rateLimit('api-http', { max: 500, duration: 60 * 1000 }));

    this
      .use('/auth', authenticate(this, {
        secret: options.secret,
        mailTransport: options.mailTransport,
        createPasswordResetEmail:
          options.createPasswordResetEmail || defaultCreatePasswordResetEmail,
      }))
      .use('/roles', acl(this))
      .use('/bans', bans(this))
      .use('/booth', booth(this))
      .use('/chat', chat(this))
      .use('/import', imports(this))
      .use('/motd', motd(this))
      .use('/now', now(this))
      .use('/playlists', playlist(this))
      .use('/search', search(this))
      .use('/users', users(this))
      .use('/waitlist', waitlist(this));

    this.use(errorHandler(options));

    return router;
  }

  /**
   * Create middleware to attach the u-wave-core instance and the u-wave-http-api
   * instance to incoming requests. This can be used to access eg. configuration
   * options or session information inside other routes (ones not added by
   * u-wave-http-api).
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
