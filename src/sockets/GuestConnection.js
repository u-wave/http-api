import EventEmitter from 'events';
import Ultron from 'ultron';
import WebSocket from 'ws';
import { verify } from 'jsonwebtoken';

type ConnectionOptions = { timeout: number };

export default class GuestConnection extends EventEmitter {
  constructor(uw, socket: WebSocket, options: ConnectionOptions) {
    super();
    this.uw = uw;
    this.socket = socket;
    this.options = options;

    this.events = new Ultron(socket);

    this.events.on('close', () => {
      this.emit('close');
    });

    this.events.on('message', jwt => {
      this.attemptAuth(jwt);
    });
  }

  async attemptAuth(token) {
    const User = this.uw.model('User');
    const session = await verify(token, this.options.secret);
    if (!session) {
      throw new Error('Invalid token');
    }
    const userModel = await User.findById(session.id);
    if (!userModel) {
      throw new Error('Invalid session');
    }

    this.emit('authenticate', userModel);
  }

  isReconnect(user) {
    return this.uw.redis.exists(`api-v1:disconnected:${user.id}`);
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
    return `Guest`;
  }
}
