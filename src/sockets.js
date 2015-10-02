import Redis from 'ioredis';
import WebSocket from 'ws';
import debug from 'debug';

const OFFSET_NOAUTH = 20*1000;

// websocket error codes
const CLOSE_NORMAL = 1000;
const CLOSE_VIOLATED_POLICY = 1008;

const log = debug('uwave:api:sockets');

export const createCommand = function createCommand(key, value) {
  return JSON.stringify({
    'command': key,
    'data': value
  });
}

export default class WSServer {
  constructor(server, redis, config) {
    this.sub = new Redis(config.redis.port, config.redis.host, config.redis.options);
    // TODO: remove second redis instance.
    this.redis = redis;
    this.wss = new WebSocket.Server({
      'server': server,
      'clientTracking': false
    });

    this.clients = {};
    this.ID = 0;

    this.heartbeatInt = setInterval(this._heartbeat.bind(this), 30*1000);

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

      if (client && client.id.length > 0) {
        this.broadcast(createCommand('leave', client.id));
      }
      this._close(conn.id, code);
    });

    conn.id = this.generateID();

    this.clients[conn.id] = {
      'heartbeat': Date.now(),
      'conn': conn,
      'id': ''
    };
  }

  _heartbeat() {
    const keys = Object.keys(this.clients);

    for(let i = keys.length - 1; i >= 0; i--) {
      const client = this.clients[keys[i]];
      if (client) {
        if (client.heartbeat - Date.now() >= 60*1000) {
          client.conn.close(CLOSE_VIOLATED_POLICY, 'idled too long');
        }
      }
    }
  }

  _authenticate(conn, token) {
    return this.redis.hget(`user:${token}`, 'id')
    .then(id => {
      if (!Object.keys(id).length) throw new Error('violated policy');

      conn.removeAllListeners();
      conn.on('message', msg => this._handleIncomingCommands(conn, msg));
      conn.on('close', code => this._close(conn.id, code));
      conn.on('error', e => log(e));

      conn.on('ping', () => {
        conn.pong();
        if (this.clients[conn.id]) {
          this.clients[conn.id].heartbeat = Date.now();
        } else {
          conn.close(CLOSE_VIOLATED_POLICY, createCommand('error', 'unknown user'));
        }
      });

      this.clients[conn.id].id = id;
      this.broadcast(createCommand('join', id));
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
          'id': user.id,
          'message': payload.data,
          'timestamp': Date.now()
        }));
      break;

      case 'vote':
        this.broadcast(createCommand('vote', {
          'id': user.id,
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
      if (command.command === 'closeSocket') {
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

    for(let i = keys.length - 1; i >= 0; i--) {
      this.clients[keys[i]].conn.send(command);
    }
  }
}