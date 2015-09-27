import mongoose from 'mongoose';
import Promise from 'bluebird';

import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const getWaitlist = function getWaitlist(redis) {
  return redis.lrange('waitlist', 0, -1);
};

export const joinWaitlist = function joinWaitlist(id, position, forceJoin, mongo, redis) {
  const User = mongo.model('User');
  const _id = id.toLowerCase();
  let beforeID = null;

  return redis.get('waitlist:lock')
  .then(lock => {
    if (lock || !forceJoin) throw new GenericError(403, 'waitlist is locked');
    return redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    for (let i = waitlist.length - 1; i >= 0; i--) {
      if (waitlist[i] === _id) {
        throw new GenericError(403, 'already in waitlist');
      }

      if (position === i) {
        beforeID = waitlist[_position];
      }
    }

    return User.findOne(ObjectId(_id)).exec();
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    if (beforeID) {
      redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      redis.lpush('waitlist', user.id);
    }

    return redis.lrange('waitlist', 0, -1);
  });
};

export const moveWaitlist = function moveWaitlist(id, position, mongo, redis) {
  const User = mongo.model('User');
  let beforeID = null;

  return regis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length;

    for (let i = (length > 0 ? length - 1 : -1); i >= 0; i--) {
      if (waitlist[i] === user.id) {
        const _position = Math.max(Math.min(position, length), 0);
        beforeID = length > 0 ? waitlist[_position] : null;

        return User.findOne(ObjectId(id.toLowerCase()));
      }
    }

    throw new GenericError(404, `user ${id} is not in waitlist`);
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    if (beforeID) {
      redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      redis.lpush('waitlist', user.id);
    }

    return redis.lrange('waitlist', 0, -1);
  });
};

export const leaveWaitlist = function leaveWaitlist(id, mongo, redis) {
  const User = mongo.model('User');

  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length > 0 ? waitlist.length : 0;

    if (length === 0) throw new GenericError(412, 'waitlist is empty');

    return User.findOne(ObjectId(id.toLowerCase()))
    .then(user => {
      if (!user) throw new GenericError(404, `no user with id ${id}`);

      for (let i = length - 1; i >= 0; i--) {
        if (waitlist[i] === user.id) {
          redis.lrem('waitlist', i, user.id);
          return redis.lrange('waitlist', 0, -1);
        }
      }

      throw new GenericError(404, `user ${user.username} is not in waitlist`);
    });
  });
};

export const clearWaitlist = function clearWaitlist(redis) {
  redis.del('waitlist');
  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    if (waitlist.length === 0) {
      return new Promise(resolve => resolve(waitlist));
    } else {
      throw new GenericError(500, 'couldn\'t clear waitlist');
    }
  });
};

// TODO: decide whether to remove clear here or not
export const lockWaitlist = function lockWaitlist(lock, clear, redis) {
  if (clear) redis.del('waitlist');

  if (lock) {
    redis.set('waitlist:lock', lock);
  } else {
    redis.del('waitlist:lock');
  }

  return redis.get('waitlist:lock')
  .then(locked => {
    return new Promise(resolve => {
      if (Boolean(locked) === lock) {
        resolve({
          'locked': lock,
          'cleared': clear
        });
      } else {
        reject(new GenericError(500, `couldn't ${lock ? 'lock' : 'unlock'} waitlist`));
      }
    });
  });
};
