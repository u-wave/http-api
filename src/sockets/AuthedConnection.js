import EventEmitter from 'events';
import Ultron from 'ultron';
import WebSocket from 'ws';
import tryJsonParse from 'try-json-parse';

const debug = require('debug')('uwave:api:sockets:authed');

export default class AuthedConnection extends EventEmitter {
  constructor(uw, socket: WebSocket, user) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.events = new Ultron(this.socket);
    this.user = user;

    this.events.on('close', () => {
      this.emit('close');
    });
    this.events.on('message', this.onMessage.bind(this));

    this.sendWaiting();
  }

  get key() {
    return `api-v1:disconnected:${this.user.id}`;
  }

  async sendWaiting() {
    // Queued command list starts at index 1, see LostConnection#initQueued.
    const messages = await this.uw.redis.lrange(this.key, 1, -1);
    if (messages.length) {
      debug('queued', this.user.id, this.user.username, ...messages);
    } else {
      debug('no queued messages', this.user.id, this.user.username);
    }
    messages.forEach(message => {
      const { command, data } = JSON.parse(message);
      this.send(command, data);
    });
    await this.uw.redis.del(this.key);
  }

  onMessage(raw: string) {
    const { command, data } = tryJsonParse(raw) || {};
    if (!command) {
      return null;
    }

    this.emit('command', command, data);
  }

  send(command: string, data: any) {
    this.socket.send(JSON.stringify({ command, data }));
  }

  close() {
    this.socket.close();
  }

  removed() {
    this.events.remove();
  }

  toString() {
    return `Authed { user: ${this.user.id} ${this.user.username} }`;
  }
}
