import express from 'express';
import debug from 'debug';

// routes
import authenticate from './routes/authenticate';
import playlist from './routes/playlists';
import waitlist from './routes/waitlist';
import booth from './routes/booth';
import users from './routes/users';
import chat from './routes/chat';

// models
import Authentication from './models/authentication';
import User from './models/user';
import Playlist from './models/playlist';
import History from './models/history';
import Media from './models/media';

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
  constructor(options = {}) {
    this.router = express.Router(options);
    this.wsserver = null;

    this.router.use(authenticator);

    authenticate(this.router);
    playlist(this.router);
    waitlist(this.router);
    booth(this.router);
    users(this.router);
    chat(this.router);
  }

  getRouter() {
    return this.router;
  }

  registerModels(uwave) {
    const mongoose = uwave.getMongoose();
    Authentication(mongoose);
    Playlist(mongoose);
    History(mongoose);
    Media(mongoose);
    User(mongoose);
  }

  registerWSServer(uwave) {
    if (!this.wsserver) {
      this.wsserver = new WSServer(uwave.getServer(), uwave.getRedis(), uwave.getConfig());
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
