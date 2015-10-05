import express from 'express';
import debug from 'debug';
import fs from 'fs';

// routes
import authenticate from './routes/authenticate';
import playlist from './routes/playlists';
import waitlist from './routes/waitlist';
import search from './routes/search';
import booth from './routes/booth';
import users from './routes/users';
import chat from './routes/chat';
import now from './routes/now';

// models
import Authentication from './models/authentication';
import GlobalMedia from './models/globalmedia';
import Playlist from './models/playlist';
import History from './models/history';
import Media from './models/media';
import User from './models/user';

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
    this.router = express.Router(config.router);
    this.cert = '';
    this.wsserver = null;

    this.setCert(config.cert);

    this.router.use(authenticator(this));

    authenticate(this, this.router);
    playlist(this.router);
    waitlist(this.router);
    search(config.keys, this.router);
    booth(this.router);
    users(this.router);
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
    Authentication(mongoose);
    GlobalMedia(mongoose);
    Playlist(mongoose);
    History(mongoose);
    Media(mongoose);
    User(mongoose);
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
