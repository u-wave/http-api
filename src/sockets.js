import debounce from 'debounce';
import find from 'array-find';
import isEmpty from 'is-empty-object';
import tryJsonParse from 'try-json-parse';
import WebSocket from 'ws';

import { vote } from './controllers/booth';
import { disconnectUser } from './controllers/users';

import GuestConnection from './sockets/GuestConnection';
import AuthedConnection from './sockets/AuthedConnection';
import LostConnection from './sockets/LostConnection';

const debug = require('debug')('uwave:api:sockets');

export function createCommand(command, data) {
  return JSON.stringify({ command, data });
}

export default class SocketServer {
  connections = [];
  options = {
    timeout: 30,
  };

  lastGuestCount = 0;

  pinger = setInterval(() => {
    this.ping();
  }, 10000);

  /**
   * Create a socket server.
   *
   * @param {UWaveServer} uw üWave Core instance.
   * @param {object} options Socket server options.
   * @param {number} options.timeout Time in seconds to wait for disconnected
   *     users to reconnect before removing them.
   */
  constructor(uw, options = {}) {
    this.uw = uw;
    this.sub = uw.subscription();
    Object.assign(this.options, options);

    this.wss = new WebSocket.Server({
      server: options.server,
      port: options.port,
      clientTracking: false,
    });

    this.sub.on('ready', () => this.sub.subscribe('v1'));
    this.sub.on('message', (channel, command) => {
      this.onServerMessage(channel, command)
        .catch((e) => { throw e; });
    });

    this.wss.on('connection', this.onSocketConnected.bind(this));

    this.initLostConnections();
  }

  /**
   * Create `LostConnection`s for every user that's known to be online, but that
   * is not currently connected to the socket server.
   */
  async initLostConnections() {
    const User = this.uw.model('User');
    const userIDs = await this.uw.redis.lrange('users', 0, -1);
    const disconnectedIDs = userIDs.filter(userID => !this.connection(userID));

    const disconnectedUsers = await User.where('_id').in(disconnectedIDs);
    disconnectedUsers.forEach((user) => {
      this.add(this.createLostConnection(user));
    });
  }

  onSocketConnected(socket) {
    debug('new connection');

    this.add(this.createGuestConnection(socket));
  }

  /**
   * Get a LostConnection for a user, if one exists.
   */
  getLostConnection(user) {
    return find(this.connections, connection =>
      connection instanceof LostConnection && connection.user.id === user.id,
    );
  }

  /**
   * Create a connection instance for an unauthenticated user.
   */
  createGuestConnection(socket) {
    const connection = new GuestConnection(this.uw, socket, {
      secret: this.options.secret,
    });
    connection.on('close', () => {
      this.remove(connection);
    });
    connection.on('authenticate', async (user) => { // eslint-disable-line arrow-parens
      debug('connecting', user.id, user.username);
      if (await connection.isReconnect(user)) {
        debug('is reconnection');
        const previousConnection = this.getLostConnection(user);
        if (previousConnection) this.remove(previousConnection);
      } else {
        this.uw.publish('user:join', { userID: user.id });
      }

      this.replace(connection, this.createAuthedConnection(socket, user));
    });
    return connection;
  }

  /**
   * Create a connection instance for an authenticated user.
   */
  createAuthedConnection(socket, user) {
    const connection = new AuthedConnection(this.uw, socket, user);
    connection.on('close', () => {
      debug('lost connection', user.id, user.username);
      this.replace(connection, this.createLostConnection(user));
    });
    connection.on('command', (command, data) => {
      debug('command', user.id, user.username, command, data);
      if (this.clientActions[command]) {
        this.clientActions[command].call(this, user, data);
      }
    });
    return connection;
  }

  /**
   * Create a connection instance for a user who disconnected.
   */
  createLostConnection(user) {
    const connection = new LostConnection(this.uw, user, this.options.timeout);
    connection.on('close', () => {
      debug('left', user.id, user.username);
      this.remove(connection);
      // Only register that the user left if they didn't have another connection
      // still open.
      if (!this.connection(user)) {
        disconnectUser(this.uw, user);
      }
    });
    return connection;
  }

  /**
   * Add a connection.
   */
  add(connection) {
    debug('adding', String(connection));

    this.connections.push(connection);
    this.recountGuests();
  }

  /**
   * Remove a connection.
   */
  remove(connection) {
    debug('removing', String(connection));

    const i = this.connections.indexOf(connection);
    this.connections.splice(i, 1);

    connection.removed();
    this.recountGuests();
  }

  /**
   * Replace a connection instance with another connection instance. Useful when
   * a connection changes "type", like GuestConnection → AuthedConnection.
   */
  replace(oldConnection, newConnection) {
    this.remove(oldConnection);
    this.add(newConnection);
  }

  /**
   * Handlers for commands that come in from clients.
   */
  clientActions = {
    sendChat(user, message) {
      debug('sendChat', user, message);
      return this.uw.sendChat(user, message);
    },
    vote(user, direction) {
      return vote(this.uw, user.id, direction);
    },
  };

  /**
   * Handlers for commands that come in from the server side.
   */
  serverActions = {
    /**
     * Broadcast the next track.
     */
    'advance:complete': (next) => {
      if (next) {
        this.broadcast('advance', {
          historyID: next._id,
          userID: next.user._id,
          item: next.item._id,
          media: next.media,
          playedAt: new Date(next.playedAt).getTime(),
        });
      } else {
        this.broadcast('advance', null);
      }
    },
    /**
     * Broadcast a chat message.
     */
    'chat:message': (message) => {
      this.broadcast('chatMessage', message);
    },
    /**
     * Delete chat messages. The delete filter can have an _id property to
     * delete a specific message, a userID property to delete messages by a
     * user, or be empty to delete all messages.
     */
    'chat:delete': ({ moderatorID, filter }) => {
      if (filter.id) {
        this.broadcast('chatDeleteByID', {
          moderatorID,
          _id: filter.id,
        });
      } else if (filter.userID) {
        this.broadcast('chatDeleteByUser', {
          moderatorID,
          userID: filter.userID,
        });
      } else if (isEmpty(filter)) {
        this.broadcast('chatDelete', { moderatorID });
      }
    },
    /**
     * Broadcast that a user was muted in chat.
     */
    'chat:mute': ({ moderatorID, userID, duration }) => {
      this.broadcast('chatMute', {
        userID,
        moderatorID,
        expiresAt: Date.now() + duration,
      });
    },
    /**
     * Broadcast that a user was unmuted in chat.
     */
    'chat:unmute': ({ moderatorID, userID }) => {
      this.broadcast('chatUnmute', { userID, moderatorID });
    },
    /**
     * Broadcast a vote for the current track.
     */
    'booth:vote': ({ userID, direction }) => {
      this.broadcast('vote', {
        _id: userID,
        value: direction,
      });
    },
    /**
     * Cycle a single user's playlist.
     */
    'playlist:cycle': ({ userID, playlistID }) => {
      this.sendTo(userID, 'playlistCycle', { playlistID });
    },
    /**
     * Broadcast that a user left the waitlist.
     */
    'waitlist:leave': ({ userID, waitlist }) => {
      this.broadcast('waitlistLeave', { userID, waitlist });
    },
    /**
     * Broadcast that a user was removed from the waitlist.
     */
    'waitlist:remove': ({ userID, moderatorID, waitlist }) => {
      this.broadcast('waitlistRemove', { userID, moderatorID, waitlist });
    },
    /**
     * Broadcast a waitlist update.
     */
    'waitlist:update': (waitlist) => {
      this.broadcast('waitlistUpdate', waitlist);
    },
    'user:update': ({ userID, moderatorID, new: update }) => {
      if ('role' in update) {
        this.broadcast('roleChange', {
          moderatorID,
          userID,
          role: update.role,
        });
      }
      if ('username' in update) {
        this.broadcast('nameChange', {
          moderatorID,
          userID,
          username: update.username,
        });
      }
    },
    'user:join': async ({ userID }) => { // eslint-disable-line arrow-parens
      const User = this.uw.model('User');

      await this.uw.redis.rpush('users', userID);
      this.broadcast('join', await User.findById(userID).lean());
    },
    /**
     * Broadcast that a user left the server.
     */
    'user:leave': ({ userID }) => {
      this.broadcast('leave', userID);
    },
    /**
     * Broadcast a ban event.
     */
    'user:ban': ({ moderatorID, userID, permanent, duration, expiresAt }) => {
      this.broadcast('ban', { moderatorID, userID, permanent, duration, expiresAt });
    },
    /**
     * Broadcast an unban event.
     */
    'user:unban': ({ moderatorID, userID }) => {
      this.broadcast('unban', { moderatorID, userID });
    },
    /**
     * Force-close a connection.
     */
    'api-v1:socket:close': (userID) => {
      this.connections.forEach((connection) => {
        if (connection.user && connection.user.id === userID) {
          connection.close();
        }
      });
    },
  };

  /**
   * Handle command messages coming in from Redis.
   * Some commands are intended to broadcast immediately to all connected
   * clients, but others require special action.
   */
  async onServerMessage(channel, rawCommand) {
    const { command, data } = tryJsonParse(rawCommand) || {};

    if (channel === 'v1') {
      this.broadcast(command, data);
    } else if (channel === 'uwave') {
      if (command in this.serverActions) {
        this.serverActions[command].call(this, data);
      }
    }
  }

  /**
   * @return Number of active guest connections.
   */
  getGuestCount() {
    return this.lastGuestCount;
  }

  /**
   * Stop the socket server.
   */
  destroy() {
    clearInterval(this.pinger);
    this.sub.removeAllListeners();
    this.sub.unsubscribe('v1', 'uwave');
    this.sub.close();
    this.wss.shutdown();
  }

  /**
   * Get the connection instance for a specific user.
   *
   * @param {object|string} user The user.
   * @return {Connection}
   */
  connection(user) {
    const userID = typeof user === 'object' ? user.id : user;
    return find(this.connections, connection =>
      connection.user && connection.user.id === userID,
    );
  }

  ping() {
    this.connections.forEach((connection) => {
      if (connection.socket) {
        connection.ping();
      }
    });
  }

  /**
   * Broadcast a command to all connected clients.
   *
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  broadcast(command: string, data: any) {
    debug('broadcast', command, data);

    this.connections.forEach((connection) => {
      connection.send(command, data);
    });
  }

  /**
   * Send a command to a single user.
   *
   * @param {Object|string} user User or user ID to send the command to.
   * @param {string} command Command name.
   * @param {*} data Command data.
   */
  sendTo(user, command: string, data: any) {
    const userID = typeof user === 'object' ? user.id : user;

    this.connections.forEach((connection) => {
      if (connection.user && connection.user.id === userID) {
        connection.send(command, data);
      }
    });
  }

  /**
   * Update online guests count and broadcast an update if necessary.
   */
  recountGuests = debounce(() => {
    const guests = this.connections
      .filter(connection => connection instanceof GuestConnection)
      .length;

    if (guests !== this.lastGuestCount) {
      this.broadcast('guests', guests);
      this.lastGuestCount = guests;
    }
  }, 2000);
}
