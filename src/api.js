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

// models
import installAuthenticationModel from './models/authentication';
import installPlaylistItemModel from './models/playlistitem';
import installPlaylistModel from './models/playlist';
import installHistoryModel from './models/history';
import installMediaModel from './models/media';
import installUserModel from './models/user';

// middleware
import authenticator from './middleware/authenticator';
import WSServer from './sockets';

const log = debug('uwave:api:v1');

/**
 * creates a router for version 1 of the api
 *
 * @param {Object} options - router config, for more information see {@link http://expressjs.com/4x/api.html#router}
 **/
export default class V1 {
  constructor(config = {}) {
    this.router = createRouter(config.router);
    this.cert = '';
    this.wsserver = null;

    this.setCert(config.cert);

    this.router.use(authenticator(this));

    authenticate(this, this.router);
    playlist(this.router);
    waitlist(this.router);
    search(this.router);
    booth(this.router);
    users(this.router);
    staff(this.router);
    chat(this.router);
    now(this.router);
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

  registerModels(uwave) {
    const mongoose = uwave.getMongoose();
    installAuthenticationModel(mongoose);
    installPlaylistItemModel(mongoose);
    installPlaylistModel(mongoose);
    installHistoryModel(mongoose);
    installMediaModel(mongoose);
    installUserModel(mongoose);
  }

  registerWSServer(uwave) {
    if (!this.wsserver) {
      this.wsserver = new WSServer(this, uwave, uwave.getConfig());
    } else {
      this.log('wsserver is already registered');
    }
  }

  destroy() {
    this.wsserver.destroy();
    this.wsserver = null;
    this.router = null;
  }
}
