import Mongoose from 'mongoose';
import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import WebSocket from 'ws';
import debug from 'debug';

import advance from './advance';
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
  constructor(v1, uw, config) {
    this.v1 = v1;
    this.uw = uw;
    this.sub = new Redis(config.redis.port, config.redis.host, config.redis.options);

    this.wss = new WebSocket.Server({
      server: uw.server,
      clientTracking: false
    });

    this.clients = {};
    this.ID = 0;

    this.heartbeatInt = setInterval(this._heartbeat.bind(this), 30 * 1000);
    this.advanceTimer = null;

    this.sub.on('ready', () => this.sub.subscribe('v1', 'v1p'));
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
        uw.redis.publish('v1p', createCommand('advance', {
          remove: true
        }));
      }
    };

    const removeFromWaitlist = async () => {
      const waitlist = await getWaitlist(uw);
      const i = waitlist.indexOf(id);
      if (i !== -1) {
        waitlist.splice(i, 1);
        uw.redis.lrem('waitlist', 0, id);
        sThis.broadcast(createCommand('waitlistLeave', {
          userID: id,
          waitlist
        }));
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
    Object.keys(this.clients).forEach(id => {
      const client = this.clients[id];
      if (client) {
        if (client.heartbeat - Date.now() >= 60 * 1000) {
          client.conn.close(CLOSE_VIOLATED_POLICY, 'idled too long');
        }
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
      sThis.broadcast(createCommand('leave', client._id));
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

    this.broadcast(createCommand('join', userModel));
  }

  async _handleIncomingCommands(conn, msg) {
    log('incoming', msg);
    const uw = this.uw;
    const payload = WSServer.parseMessage(msg);
    const user = this.clients[conn.id];
    // Currently `this` doesn't work well in async arrow functions:
    // https://phabricator.babeljs.io/T2765
    // So we'll use `sThis` as a workaround for now.
    const sThis = this;

    if (!payload || typeof payload !== 'object' || typeof payload.command !== 'string') {
      conn.send(createCommand('error', 'command invalid'));
      return;
    }

    if (!user) {
      conn.close(CLOSE_VIOLATED_POLICY, 'user not found');
      return;
    }

    const sendVote = async direction => {
      await Promise.all([
        uw.redis.lrem('booth:upvotes', 0, user._id),
        uw.redis.lrem('booth:downvotes', 0, user._id)
      ]);
      await uw.redis.lpush(
        direction > 0 ? 'booth:upvotes' : 'booth:downvotes',
        user._id
      );
      sThis.broadcast(createCommand('vote', {
        _id: user._id,
        value: direction
      }));
    };

    switch (payload.command) {
    case 'sendChat':
      this.broadcast(createCommand('chatMessage', {
        _id: user._id,
        message: payload.data,
        timestamp: Date.now()
      }));
      break;

    case 'vote':
      const currentDJ = await uw.redis.get('booth:currentDJ');
      if (currentDJ !== null && currentDJ !== user._id) {
        const historyID = await uw.redis.get('booth:historyID');
        if (historyID === null) return;
        if (payload.data > 0) {
          const upvoted = await uw.redis.lrange('booth:upvotes', 0, -1);
          if (upvoted.indexOf(user._id) === -1) {
            await sendVote(1);
          }
        } else {
          const downvoted = await uw.redis.lrange('booth:downvotes', 0, -1);
          if (downvoted.indexOf(user._id) === -1) {
            await sendVote(-1);
          }
        }
      }
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
      this.broadcast(command);
    } else if (channel === 'v1p') {
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
            () => {
              uw.redis.publish('v1p', createCommand('advance'));
            },
            getDuration(historyEntry.media) * 1000
          );
        } else {
          this.broadcast(createCommand('advance', null));
        }
      } else if (_command.command === 'checkAdvance') {
        const isLocked = await uw.redis.get('waitlist:lock');
        const userRole = _command.data;
        const skipIsAllowed = !isLocked || userRole > 3;
        if (this.advanceTimer === null && skipIsAllowed) {
          uw.redis.publish('v1p', createCommand('advance'));
        }
      } else if (_command.command === 'closeSocket') {
        this._close(_command.data, CLOSE_NORMAL);
      }
    }
  }

  destroy() {
    clearInterval(this.heartbeatInt);
    this.sub.removeAllListeners();
    this.sub.unsubscribe('v1', 'v1p');
    this.sub.close();
    this.wss.shutdown();
  }

  broadcast(command) {
    Object.keys(this.clients).forEach(id => {
      this.clients[id].conn.send(command);
    });
  }
}
