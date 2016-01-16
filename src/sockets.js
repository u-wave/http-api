import Mongoose from 'mongoose';
import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import WebSocket from 'ws';
import debug from 'debug';

import advance from './advance';

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
  constructor(v1, uwave, config) {
    this.v1 = v1;
    this.mongo = uwave.getMongo();
    this.redis = uwave.getRedis();
    this.sub = new Redis(config.redis.port, config.redis.host, config.redis.options);

    this.wss = new WebSocket.Server({
      server: uwave.getServer(),
      clientTracking: false
    });

    this.clients = {};
    this.ID = 0;

    this.heartbeatInt = setInterval(this._heartbeat.bind(this), 30 * 1000);
    this.advanceTimer = null;

    this.sub.on('ready', () => this.sub.subscribe('v1', 'v1p'));
    this.sub.on('message', this._handleMessage.bind(this));

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

  _removeUser(id) {
    const History = this.mongo.model('History');
    const removeFromWaitlist = () => {
      return this.redis.lrange('waitlist', 0, -1).then(waitlist => {
        const i = waitlist.indexOf(id);
        if (i !== -1) {
          waitlist.splice(i, 1);
          this.redis.lrem('waitlist', 0, id);
          this.broadcast(createCommand('waitlistLeave', {
            userID: id,
            waitlist
          }));
        }
      });
    };
    const skipIfCurrentDJ = () => {
      return this.redis.get('booth:historyID')
        .then(historyID => History.findOne({ _id: historyID }))
        .then(entry => {
          if (entry && entry.user + '' === id) {
            this.redis.publish('v1p', createCommand('advance', null));
          }
        });
    };
    this.redis.lrem('users', 0, id);
    skipIfCurrentDJ()
      .then(removeFromWaitlist);
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
    conn.on('message', msg => this._authenticate(conn, msg));
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
    const keys = Object.keys(this.clients);

    for (let i = keys.length - 1; i >= 0; i--) {
      const client = this.clients[keys[i]];
      if (client) {
        if (client.heartbeat - Date.now() >= 60 * 1000) {
          client.conn.close(CLOSE_VIOLATED_POLICY, 'idled too long');
        }
      }
    }
  }

  _authenticate(conn, token) {
    const User = this.mongo.model('User');

    return verify(token, this.v1.getCert())
    .then(user => {
      conn.removeAllListeners();
      conn.on('message', msg => this._handleIncomingCommands(conn, msg));
      conn.on('error', e => log(e));
      conn.on('close', code => {
        const client = this.clients[conn.id];

        this._close(conn.id, code);
        this._removeUser(client._id);
        this.broadcast(createCommand('leave', client._id));
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
      User.findOne(new ObjectId(user.id), { __v: 0 })
      .then(userModel => {
        if (!userModel) {
          return conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'unknown user'));
        }
        this.redis.lpush('users', userModel.id);
        this.broadcast(createCommand('join', userModel));
      })
      .catch(e => {
        log(e);
        conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'internal server error'));
      });
    })
    .catch(jwt.JsonWebTokenError, e => {
      log(e);
      conn.close(CLOSE_VIOLATED_POLICY, 'token was not valid.');
    })
    .catch(e => {
      log(e);
      conn.close(CLOSE_VIOLATED_POLICY, 'that\'s no no');
    });
  }

  _handleIncomingCommands(conn, msg) {
    const payload = WSServer.parseMessage(msg);
    const user = this.clients[conn.id];

    if (!payload || typeof payload !== 'object' || typeof payload.command !== 'string') {
      return conn.send(createCommand('error', 'command invalid'));
    }

    if (!user) return conn.close(CLOSE_VIOLATED_POLICY, 'user not found');

    switch (payload.command) {
    case 'sendChat':
      this.broadcast(createCommand('chatMessage', {
        _id: user._id,
        message: payload.data,
        timestamp: Date.now()
      }));
      break;

    case 'vote':
      this.redis.lrem('booth:upvotes', 0, user._id);
      this.redis.lrem('booth:downvotes', 0, user._id);
      this.redis.lpush(payload.data > 0 ? 'booth:upvotes' : 'booth:downvotes', user._id);

      this.broadcast(createCommand('vote', {
        _id: user._id,
        value: payload.data
      }));
      break;

    default:
      conn.send(createCommand('error', 'unknown command'));
    }
  }

  _handleMessage(channel, command) {
    const _command = JSON.parse(command);

    if (channel === 'v1') {
      this.broadcast(command);
    } else if (channel === 'v1p') {
      if (_command.command === 'advance') {
        clearTimeout(this.advanceTimer);
        this.advanceTimer = null;

        advance(this.mongo, this.redis)
        .then(now => {
          if (now) {
            this.redis.set('booth:historyID', now.historyID);
            this.broadcast(createCommand('advance', now));
            this.advanceTimer = setTimeout(
              this._handleMessage.bind(this),
              now.media.media.duration * 1000,
              'v1p', createCommand('cycleWaitlist', null)
            );
          } else {
            this.redis.del('booth:historyID');
            this.broadcast(createCommand('advance', null));
          }
        })
        .catch(e => {
          log(e);
          this.redis.del('booth:historyID');
        });
      } else if (_command.command === 'checkAdvance') {
        this.redis.get('waitlist:lock')
        .then(lock => {
          if (this.advanceTimer === null && (!lock || (lock && _command.data > 3))) {
            this._handleMessage('v1p', createCommand('advance', null));
          }
        });
      } else if (_command.command === 'cycleWaitlist') {
        this.redis.get('booth:historyID')
        .then(historyID => {
          const History = this.mongo.model('History');

          return History.findOne(new ObjectId(historyID));
        })
        .then(entry => {
          if (!entry) return;

          this.redis.rpush('waitlist', entry.user.toString());
          this.redis.lrange('waitlist', 0, -1)
          .then(waitlist => {
            this.redis.publish('v1', createCommand('waitlistUpdate', waitlist));
            this.redis.publish('v1p', createCommand('advance', null));
          });
        });
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
    const keys = Object.keys(this.clients);

    for (let i = keys.length - 1; i >= 0; i--) {
      this.clients[keys[i]].conn.send(command);
    }
  }
}
