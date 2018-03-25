import EventEmitter from 'events';
import Ultron from 'ultron';
import WebSocket from 'ws';
import createDebug from 'debug';

const debug = createDebug('uwave:api:sockets:guest');

type ConnectionOptions = { timeout: number };

export default class GuestConnection extends EventEmitter {
  lastMessage = Date.now();

  constructor(uw, socket: WebSocket, req?, options: ConnectionOptions) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.options = options;

    this.events = new Ultron(socket);

    this.events.on('close', () => {
      this.emit('close');
    });

    this.events.on('message', (token) => {
      this.attemptAuth(token).then(() => {
        this.send('authenticated');
      }).catch((error) => {
        this.send('error', error.message);
      });
    });
  }

  async getTokenSession(token) {
    if (token.length !== 128) {
      throw new Error('Invalid token');
    }
    const [sessionID] = await this.uw.redis
      .multi()
      .get(`api-v1:socketAuth:${token}`)
      .del(`api-v1:socketAuth:${token}`)
      .exec();

    return sessionID[1];
  }

  async attemptAuth(token) {
    const sessionToken = await this.getTokenSession(token);
    if (!sessionToken) {
      throw new Error('Invalid token');
    }
    const tokenBuf = Buffer.from(sessionToken, 'hex');
    const userModel = await this.uw.sessions.getSecureUser(tokenBuf);
    if (!userModel) {
      throw new Error('Invalid session');
    }

    // Users who are banned can still join as guests, but cannot log in. So we
    // ignore their socket login attempts, and just keep their connections
    // around as guest connections.
    if (await userModel.isBanned()) {
      throw new Error('You have been banned');
    }

    this.emit('authenticate', userModel, tokenBuf);
  }

  isReconnect(user) {
    return this.uw.redis.exists(`api-v1:disconnected:${user.id}`);
  }

  send(command: string, data: any) {
    this.socket.send(JSON.stringify({ command, data }));
    this.lastMessage = Date.now();
  }

  ping() {
    if (Date.now() - this.lastMessage > 5000) {
      this.socket.send('-');
      this.lastMessage = Date.now();
    }
  }

  close() {
    debug('close');
    this.socket.close();
  }

  removed() {
    this.events.remove();
  }

  // eslint-disable-next-line class-methods-use-this
  toString() {
    return 'Guest';
  }
}
