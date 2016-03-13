import Mongoose from 'mongoose';
import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import debug from 'debug';

import { vote } from './controllers/booth';
import { sendChatMessage } from './controllers/chat';
import { disconnectUser } from './controllers/users';

// websocket error codes
const CLOSE_NORMAL = 1000;
const CLOSE_VIOLATED_POLICY = 1008;

const ObjectId = Mongoose.Types.ObjectId;

const log = debug('uwave:api:sockets');
const verify = bluebird.promisify(jwt.verify);

export function createCommand(command, data) {
  return JSON.stringify({ command, data });
}

export default class WSServer {
  constructor(v1, uw) {
    this.v1 = v1;
    this.uw = uw;
    this.sub = uw.subscription();

    this.wss = new WebSocket.Server({
      server: uw.server,
      clientTracking: false
    });

    this.clients = {};
    this.ID = 0;

    this.heartbeatInt = setInterval(this._heartbeat.bind(this), 30 * 1000);

    this.sub.on('ready', () => this.sub.subscribe('v1'));
    this.sub.on('message', (channel, command) => {
      this._handleMessage(channel, command)
        .catch(e => { throw e; });
    });

    this.wss.on('connection', this._onConnection.bind(this));
  }

  static parseMessage(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      log(e);
    }
    return {};
  }

  async _close(id, code) {
    if (code !== CLOSE_NORMAL) {
      log(`connection ${id} closed with error: ${code}.`);
    }

    const client = this.clients[id];
    delete this.clients[id];

    if (client._id) {
      await disconnectUser(this.uw, client._id);
    }
  }

  generateID() {
    while (this.clients[++this.ID]) {
      if (this.ID >= Number.MAX_SAFE_INTEGER) {
        this.ID = 0;
      }
    }
    return this.ID;
  }

  _onConnection(conn) {
    log('new connection');
    conn.on('message', msg => {
      log('message', msg);
      this._authenticate(conn, msg)
        .catch(jwt.JsonWebTokenError, e => {
          log(e);
          conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'token was not valid.'));
        })
        .catch(e => {
          log(e);
          conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'internal server error'));
        });
    });
    conn.on('close', code => {
      this._close(conn.id, code);
    });

    conn.id = this.generateID();

    this.clients[conn.id] = {
      _id: '',
      conn,
      heartbeat: Date.now()
    };
  }

  _heartbeat() {
    this.eachClient(client => {
      if (client.heartbeat - Date.now() >= 60 * 1000) {
        client.conn.close(CLOSE_VIOLATED_POLICY, 'idled too long');
      }
    });
  }

  async _authenticate(conn, token) {
    const uw = this.uw;
    const User = uw.model('User');
    // Currently `this` doesn't work well in async arrow functions:
    // https://phabricator.babeljs.io/T2765
    // So we'll use `sThis` as a workaround for now.
    const sThis = this;

    log('authenticate', token);

    const user = await verify(token, this.v1.getCert());

    conn.removeAllListeners();
    conn.on('message', msg => this._handleIncomingCommands(conn, msg));
    conn.on('error', e => log(e));
    conn.on('close', async code => {
      sThis._close(conn.id, code);
    });

    conn.on('ping', () => {
      conn.pong();
      if (this.clients[conn.id]) {
        this.clients[conn.id].heartbeat = Date.now();
      } else {
        conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'unknown user'));
      }
    });

    this.clients[conn.id]._id = user.id;
    const userModel = await User.findOne(new ObjectId(user.id), { __v: 0 });
    if (!userModel) {
      return conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'unknown user'));
    }

    await uw.redis.lpush('users', userModel.id);

    this.broadcast('join', userModel);
  }

  /**
   * Handlers for commands that come in from clients.
   */
  clientActions = {
    sendChat(client, message) {
      return sendChatMessage(this.uw, client._id, message);
    },
    vote(client, direction) {
      return vote(this.uw, client._id, direction);
    }
  };

  /**
   * Handlers for commands that come in from the server side.
   */
  serverActions = {
    /**
     * Broadcast the next track.
     */
    'advance:complete'(next) {
      if (next) {
        this.broadcast('advance', {
          historyID: next._id,
          userID: next.user._id,
          item: next.item._id,
          media: next.media,
          played: new Date(next.played).getTime()
        });
      } else {
        this.broadcast('advance', null);
      }
    },
    /**
     * Broadcast a chat message.
     */
    'chat:message'({ userID, message, timestamp }) {
      this.broadcast('chatMessage', {
        _id: userID,
        message,
        timestamp
      });
    },
    /**
     * Broadcast a vote for the current track.
     */
    'booth:vote'({ userID, direction }) {
      this.broadcast('vote', {
        _id: userID,
        value: direction
      });
    },
    /**
     * Cycle a single user's playlist.
     */
    'playlist:cycle'({ userID, playlistID }) {
      this.sendTo(userID, 'playlistCycle', { playlistID });
    },
    /**
     * Broadcast that a user left the waitlist.
     */
    'waitlist:leave'({ userID, waitlist }) {
      this.broadcast('waitlistLeave', { userID, waitlist });
    },
    /**
     * Broadcast that a user was removed from the waitlist.
     */
    'waitlist:remove'({ userID, moderatorID, waitlist }) {
      this.broadcast('waitlistRemove', { userID, moderatorID, waitlist });
    },
    /**
     * Broadcast a waitlist update.
     */
    'waitlist:update'(waitlist) {
      this.broadcast('waitlistUpdate', waitlist);
    },
    /**
     * Broadcast that a user left the server.
     */
    'user:leave'(userID) {
      this.broadcast('leave', userID);
    },
    /**
     * Force-close a connection.
     */
    'api-v1:socket:close'(connectionID) {
      this._close(connectionID, CLOSE_NORMAL);
    }
  };

  /**
   * Handle commands coming in from clients.
   */
  async _handleIncomingCommands(conn, rawCommand) {
    log('incoming', rawCommand);
    const { command, data } = WSServer.parseMessage(rawCommand);
    const client = this.clients[conn.id];

    if (!command || typeof command !== 'string') {
      conn.send(createCommand('error', 'command invalid'));
      return;
    }

    if (!client) {
      conn.close(CLOSE_VIOLATED_POLICY, 'user not found');
      return;
    }

    if (command in this.clientActions) {
      this.clientActions[command].call(this, client, data);
    } else {
      conn.send(createCommand('error', 'unknown command'));
    }
  }

  /**
   * Handle command messages coming in from Redis.
   * Some commands are intended to broadcast immediately to all connected
   * clients, but others require special action.
   */
  async _handleMessage(channel, rawCommand) {
    const { command, data } = WSServer.parseMessage(rawCommand);

    if (channel === 'v1') {
      this.broadcast(command, data);
    } else if (channel === 'uwave') {
      if (command in this.serverActions) {
        this.serverActions[command].call(this, data);
      }
    }
  }

  destroy() {
    clearInterval(this.heartbeatInt);
    this.sub.removeAllListeners();
    this.sub.unsubscribe('v1', 'uwave');
    this.sub.close();
    this.wss.shutdown();
  }

  /**
   * Run a callback for every connected client.
   *
   * @param {Function} fn Callback. Client object in the first parameter, ID
   *     in the second.
   * @param {Object} [bind] `this` for the callback.
   */
  eachClient(fn, bind = null) {
    Object.keys(this.clients).forEach(id => {
      fn.call(bind, this.clients[id], id);
    });
  }

  /**
   * Broadcast a command to all connected clients.
   *
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  broadcast(command, data) {
    this.eachClient(({ conn }) => {
      conn.send(JSON.stringify({
        command, data
      }));
    });
  }

  /**
   * Send a command to a single user.
   *
   * @param {Object|string} user User or user ID to send the command to.
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  sendTo(user, command, data) {
    const userID = typeof user === 'object' ? user._id : user;
    this.eachClient(client => {
      if (client._id === userID) {
        client.conn.send(JSON.stringify({
          command, data
        }));
      }
    });
  }
}
