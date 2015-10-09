import Mongoose from 'mongoose';
import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import WebSocket from 'ws';
import debug from 'debug';

import advance from './advance';

const OFFSET_NOAUTH = 20*1000;

// websocket error codes
const CLOSE_NORMAL = 1000;
const CLOSE_VIOLATED_POLICY = 1008;

const ObjectId = Mongoose.Types.ObjectId;

const log = debug('uwave:api:sockets');
const verify = bluebird.promisify(jwt.verify);

export const createCommand = function createCommand(key, value) {
  return JSON.stringify({
    'command': key,
    'data': value
  });
}

export default class WSServer {
  constructor(v1, uwave, config) {
    const mongo = uwave.getMongo();
    this.User = mongo.model('User');

    this.v1 = v1;
    this.redis = uwave.getRedis();
    this.sub = new Redis(config.redis.port, config.redis.host, config.redis.options);

    this.wss = new WebSocket.Server({
      'server': uwave.getServer(),
      'clientTracking': false
    });

    this.clients = {};
    this.ID = 0;

    this.heartbeatInt = setInterval(this._heartbeat.bind(this), 30*1000);
    this.advanceTimer = null;

    this.sub.on('ready', () => this.sub.subscribe('v1', 'v1p'));
    this.sub.on('message', this._handleMessage.bind(this));

    this.wss.on('connection', this._onConnection.bind(this));
  }

  static parseMessage(str) {
    let payload = null;

    try {
      payload = JSON.parse(str);
    } catch(e) {
      log(e);
    }

    return payload;
  }

  _removeUser(id) {
    this.redis.lrem('users', 0, id);
    this.redis.lrange('waitlist', 0, -1)
    .then(waitlist => {
      for (let i = waitlist.length - 1; i >= 0; i--) {
        if (waitlist[i] === id) {
          waitlist.splice(i, 1);
          this.redis.lrem('waitlist', 0, id);

          this.broadcast(createCommand('waitlistLeave', {
            'userID': id,
            'waitlist': waitlist
          }));
        }
      }
    });
  }

  _close(id, code, msg = '') {
    if (code !== CLOSE_NORMAL) log(`connection ${id} closed with error.`);
    delete this.clients[id];
  }

  generateID() {
    while(this.clients[++this.ID]) {
      if (this.ID >= Number.MAX_SAFE_INTEGER) {
        this.ID = 0;
      }
    }
    return this.ID;
  }

  _onConnection(conn) {
    conn.on('message', msg => this._authenticate(conn, msg));
    conn.on('close', code => {
      const client = this.clients[conn.id];
      this._close(conn.id, code);
    });

    conn.id = this.generateID();

    this.clients[conn.id] = {
      'heartbeat': Date.now(),
      'conn': conn,
      '_id': ''
    };
  }

  _heartbeat() {
    const keys = Object.keys(this.clients);

    for (let i = keys.length - 1; i >= 0; i--) {
      const client = this.clients[keys[i]];
      if (client) {
        if (client.heartbeat - Date.now() >= 60*1000) {
          client.conn.close(CLOSE_VIOLATED_POLICY, 'idled too long');
        }
      }
    }
  }

  _authenticate(conn, token) {
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

      this.clients[conn.id].id = user.id;
      this.User.findOne(ObjectId(user.id), { '__v': 0 })
      .then(user => {
        if (!user) return conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'unknown user'));
        this.redis.lpush('users', user.id);
        this.broadcast(createCommand('join', user));
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

    switch(payload.command) {
      case 'sendChat':
        this.broadcast(createCommand('chatMessage', {
          '_id': user._id,
          'message': payload.data,
          'timestamp': Date.now()
        }));
      break;

      case 'vote':
        this.redis.lrem('booth:upvotes', 0, user.id);
        this.redis.lrem('booth:downvotes', 0, user.id);
        this.redis.lpush(payload.data > 0 ? 'booth:upvotes' : 'booth:downvotes', user.id);

        this.broadcast(createCommand('vote', {
          '_id': user._id,
          'value': payload.data
        }));
      break;

      default:
        conn.send(createCommand('error', 'unknown command'));
    }
  }

  _handleMessage(channel, command) {
    if (channel === 'v1') {
      this.broadcast(command);
    } else if (channel === 'v1p') {
      if (command.command === 'advance') {
        clearTimeout(this.advanceTimer);
        this.advanceTimer = null;

        advance(this.mongo, this.redis)
        .then(booth => {
          this.redis.set('booth:historyID', booth.historyID);
          this.broadcast(createCommand('advance', booth));
          this.advanceTimer = setTimeout(
            advance,
            booth.media.duration * 1000,
            this.uwave.getMongo(), this.uwave.getRedis()
          );
        })
        .catch(e => {
          log(e);
          this.redis.del('booth:historyID');
          this.broadcast(createCommand('advance', null));
        });
      } else if (command.command === 'closeSocket') {
        this._close(command.data, CLOSE_NORMAL);
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