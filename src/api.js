import createRouter from 'router';

// routes
import authenticate from './routes/authenticate';
import playlist from './routes/playlists';
import waitlist from './routes/waitlist';
import search from './routes/search';
import booth from './routes/booth';
import users from './routes/users';
import staff from './routes/staff';
import chat from './routes/chat';
import now from './routes/now';

// middleware
import authenticator from './middleware/authenticator';
import WSServer from './sockets';

/**
 * creates a router for version 1 of the api
 *
 * @param {Object} options - router config, for more information see {@link http://expressjs.com/4x/api.html#router}
 **/
export class V1 {
  constructor(uw, options = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new TypeError(`
        Expected a u-wave-core instance in the first parameter. If you are
        developing, you may have to upgrade your u-wave-* modules.
      `.replace(/\s+/g, ' ').trim());
    }

    if (!options.secret) {
      throw new TypeError(`
        "options.secret" is empty. This option is used to sign authentication
        keys, and is required for security reasons.
      `);
    }

    this.uw = uw;
    this.router = createRouter(options.router);
    this.sockets = new WSServer(uw, { secret: options.secret });

    this.router.use(authenticator(this, { secret: options.secret }));

    this.router
      .use('/auth', authenticate(this, { secret: options.secret }))
      .use('/booth', booth(this))
      .use('/chat', chat(this))
      .use('/now', now(this))
      .use('/playlists', playlist(this))
      .use('/search', search(this))
      .use('/staff', staff(this))
      .use('/users', users(this))
      .use('/waitlist', waitlist(this));
  }

  getRouter() {
    return this.router;
  }

  destroy() {
    this.sockets.destroy();
    this.sockets = null;
    this.router = null;
  }
}

export default function api(uw, opts = {}) {
  return new V1(uw, opts);
}
