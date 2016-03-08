import Mongoose from 'mongoose';
import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import debug from 'debug';

import advance from './advance';
import { vote } from './controllers/booth';
import { getWaitlist } from './controllers/waitlist';

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
    this.advanceTimer = null;

    this.sub.on('ready', () => this.sub.subscribe('v1'));
    this.sub.on('message', (channel, command) => {
      this._handleMessage(channel, command)
        .catch(e => { throw e; });
    });

    this.wss.on('connection', this._onConnection.bind(this));
  }

  static parseMessage(str) {
    let payload = null;

    try {
      payload = JSON.parse(str);
    } catch (e) {
      log(e);
    }

    return payload;
  }

  async _removeUser(id) {
    const uw = this.uw;
    const History = uw.model('History');
    // Currently `this` doesn't work well in async arrow functions:
    // https://phabricator.babeljs.io/T2765
    // So we'll use `sThis` as a workaround for now.
    const sThis = this;

    const skipIfCurrentDJ = async () => {
      const historyID = await uw.redis.get('booth:historyID');
      const entry = await History.findOne({ _id: historyID });
      if (entry && `${entry.user}` === id) {
        uw.publish('advance', { remove: true });
      }
    };

    const removeFromWaitlist = async () => {
      const waitlist = await getWaitlist(uw);
      const i = waitlist.indexOf(id);
      if (i !== -1) {
        waitlist.splice(i, 1);
        uw.redis.lrem('waitlist', 0, id);
        sThis.broadcast('waitlistLeave', {
          userID: id,
          waitlist
        });
      }
    };

    await skipIfCurrentDJ();
    await removeFromWaitlist();
    await uw.redis.lrem('users', 0, id);
  }

  _close(id, code) {
    if (code !== CLOSE_NORMAL) log(`connection ${id} closed with error.`);
    delete this.clients[id];
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
      const client = sThis.clients[conn.id];

      sThis._close(conn.id, code);
      await sThis._removeUser(client._id);
      sThis.broadcast('leave', client._id);
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

  async _handleIncomingCommands(conn, msg) {
    log('incoming', msg);
    const uw = this.uw;
    const payload = WSServer.parseMessage(msg);
    const user = this.clients[conn.id];

    if (!payload || typeof payload !== 'object' || typeof payload.command !== 'string') {
      conn.send(createCommand('error', 'command invalid'));
      return;
    }

    if (!user) {
      conn.close(CLOSE_VIOLATED_POLICY, 'user not found');
      return;
    }

    switch (payload.command) {
    case 'sendChat':
      this.broadcast('chatMessage', {
        _id: user._id,
        message: payload.data,
        timestamp: Date.now()
      });
      break;

    case 'vote':
      await vote(uw, user._id, payload.data);
      break;

    default:
      conn.send(createCommand('error', 'unknown command'));
    }
  }

  async _handleMessage(channel, command) {
    const uw = this.uw;
    const _command = JSON.parse(command);

    const getDuration = playlistItem => playlistItem.end - playlistItem.start;

    if (channel === 'v1') {
      this.broadcast(_command.command, _command.data);
    } else if (channel === 'uwave') {
      if (_command.command === 'advance') {
        clearTimeout(this.advanceTimer);
        this.advanceTimer = null;

        const { historyEntry, waitlist } = await advance(uw, _command.data);
        uw.redis.publish('v1', createCommand('waitlistUpdate', waitlist));
        if (historyEntry) {
          uw.redis.publish('v1', createCommand('advance', {
            historyID: historyEntry.id,
            userID: historyEntry.user.id,
            item: historyEntry.item.id,
            media: historyEntry.media,
            played: new Date(historyEntry.played).getTime()
          }));

          this.advanceTimer = setTimeout(
            () => uw.publish('advance'),
            getDuration(historyEntry.media) * 1000
          );
        } else {
          this.broadcast('advance', null);
        }
      } else if (_command.command === 'advance:check') {
        const isLocked = await uw.redis.get('waitlist:lock');
        const userRole = _command.data;
        const skipIsAllowed = !isLocked || userRole > 3;
        if (this.advanceTimer === null && skipIsAllowed) {
          uw.publish('advance');
        }
      } else if (_command.command === 'booth:vote') {
        const { userID, direction } = _command.data;
        this.broadcast('vote', {
          _id: userID,
          value: direction
        });
      } else if (_command.command === 'playlist:cycle') {
        const { userID, playlistID } = _command.data;
        this.sendTo(userID, 'playlistCycle', { playlistID });
      } else if (_command.command === 'api-v1:socket:close') {
        this._close(_command.data, CLOSE_NORMAL);
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
