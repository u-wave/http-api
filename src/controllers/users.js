import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { paginate } from '../utils';
import { GenericError, PaginateError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export function getUsers(page, limit, mongo) {
  const User = mongo.model('User');
  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 50 : Math.min(limit, 50);

  return User.find().setOptions({ limit: _limit, page: _limit * _page });
}

export function getUser(id, mongo) {
  const User = mongo.model('User');

  return User.findOne(new ObjectId(id));
}

export function banUser(moderatorID, id, time, exiled, uwave) {
  const User = uwave.mongo.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    user.banned = time;
    user.exiled = exiled;

    return user.save();
  })
  .then(user => {
    return new Promise((resolve, reject) => {
      if (user.banned !== time) {
        return reject(new Error(`couldn't ${time > 0 ? 'ban' : 'unban'} user`));
      }
      if (user.exiled !== exiled) {
        return reject(new Error(`couldn't ${exiled ? 'exile' : 'unban'} user`));
      }

      if (time !== 0) {
        uwave.redis.publish('v1', createCommand(time > 0 ? 'ban' : 'unban', {
          moderatorID,
          userID: user.id,
          banned: user.banned,
          exiled: user.exiled
        }));
      }
      resolve(user);
    });
  });
}

export function muteUser(moderatorID, id, time, uwave) {
  const User = uwave.mongo.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    uwave.redis.set(`mute:${id}`, 'expire', Date.now() + time);

    return new Promise(resolve => {
      uwave.redis.publish('v1', createCommand(time > 0 ? 'mute' : 'unmute', {
        moderatorID,
        userID: id,
        expires: time
      }));
      resolve(time > 0 ? true : false);
    });
  });
}

export function changeRole(moderatorID, id, role, uwave) {
  const User = uwave.mongo.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    user.role = Math.max(Math.min(role, 6), 0);

    uwave.redis.publish('v1', createCommand('roleChange', {
      moderatorID,
      userID: user.id,
      role: user.role
    }));
    return user.save();
  });
}

export function changeUsername(moderatorID, id, name, uwave) {
  const User = uwave.mongo.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);
    if (user.id !== id && user.role < 3) {
      throw new GenericError(403, 'you need to be at least a bouncer to do this');
    }

    user.username = name;
    user.slug = name.toLowerCase();

    return user.save();
  })
  .tap(user => {
    uwave.redis.publish('v1', createCommand('nameChange', {
      moderatorID,
      userID: id,
      username: user.username
    }));
  });
}

export function setStatus(id, status, redis) {
  redis.publish('v1', createCommand('statusChange', {
    userID: id,
    status: Math.max(Math.min(status, 3), 0)
  }));
}

export function getHistory(id, page, limit, mongo) {
  const History = mongo.model('History');

  const _page = (!isNaN(page) ? page : 0);
  const _limit = (!isNaN(limit) ? limit : 25);

  return History.find({ user: id })
    .skip(_page * _limit)
    .limit(_limit)
    .sort({ played: -1 })
    .populate('media user')
    .then(history => paginate(_page, _limit, history))
    .catch(e => {
      throw new PaginateError(e);
    });
}
