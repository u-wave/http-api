import createRouter from 'router';
import debug from 'debug';
import fs from 'fs';

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

const log = debug('uwave:api:v1');

/**
 * creates a router for version 1 of the api
 *
 * @param {Object} options - router config, for more information see {@link http://expressjs.com/4x/api.html#router}
 **/
export class V1 {
  constructor(uw, config = {}) {
    if (!uw || !('mongo' in uw)) {
      throw new Error(`
        Expected a u-wave-core instance in the first parameter. If you are
        developing, you may have to upgrade your u-wave-* modules.
      `.replace(/\s+/g, ' ').trim());
    }

    this.uw = uw;
    this.router = createRouter(config.router);
    this.cert = '';
    this.sockets = new WSServer(this, uw, config);

    this.setCert(config.cert);

    this.router.use(authenticator(this));

    this.router
      .use('/auth', authenticate(this))
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

  setCert(filepath) {
    fs.readFile(filepath, 'UTF8', (err, content) => {
      if (err) return log(`couldn't load cert. Error: ${err}`);
      this.cert = content;
    });
  }

  getCert() {
    return this.cert;
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
