import EventEmitter from 'events';

const debug = require('debug')('uwave:api:sockets:lost');

export default class LostConnection extends EventEmitter {
  constructor(uw, user, timeout = 30) {
    super();
    this.uw = uw;
    this.user = user;

    this.initQueued();
    this.setTimeout(timeout);
  }

  get key() {
    return `api-v1:disconnected:${this.user.id}`;
  }

  initQueued() {
    // Hack to ensure that the key exists. This way other parts of the code can
    // use `redis.exists` to check for disconnected users.
    // FIXME Think of/use some other, less hacky way!
    this.uw.redis.rpush(this.key, 'z');
  }

  setTimeout(timeout) {
    this.timeout = setTimeout(() => {
      this.close();
      this.uw.redis.del(this.key);
    }, timeout * 1000);
  }

  send(command: string, data: any) {
    debug('queueing', command, data);

    this.uw.redis.rpush(
      this.key,
      JSON.stringify({ command, data })
    );
  }

  close() {
    this.emit('close');
  }

  removed() {
    clearTimeout(this.timeout);
  }

  toString() {
    return `Lost { user: ${this.user.id} ${this.user.username} }`;
  }
}
