import mongoose from 'mongoose';
import Promise from 'bluebird';

import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const getWaitlist = function getWaitlist(redis) {
  return redis.lrange('waitlist', 0, -1);
};

export const joinWaitlist = function joinWaitlist(id, position, forceJoin, redis) {
  const User = mongoose.model('User');
  const _id = id.toLowerCase();

  return redis.get('waitlist:lock')
  .then(lock => {
    if (lock || !forceJoin) throw new GenericError(403, 'waitlist is locked');
    return redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    return new Promise((resolve, reject) => {
      const length = waitlist.length;

      for (let i = length - 1; i >= 0; i--) {
        if (waitlist[i] === _id) {
          return reject(new GenericError(403, 'already in waitlist'));
        }
      }

      User.findOne(ObjectId(_id))
      .then(user => {
        if (!user) return reject(new GenericError(404, 'user not found'));
        if (position) {
          const _position = Math.max(Math.min(position, length), 0);
          const beforeID = length > 0 ? waitlist[_position] : null;
          redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
          waitlist.splice(_position, 0, user.id);
        } else {
          redis.lpush('waitlist', user.id);
          waitlist.push(user.id);
        }

        resolve(waitlist);
      });
    });
  });
};

export const moveWaitlist = function moveWaitlist(id, position, redis) {
  const User = mongoose.model('User');

  return regis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    return new Promise((resolve, reject) => {
      const length = waitlist.length;

      User.findOne(ObjectId(id.toLowerCase()))
      .then(user => {
        if (!user) return reject(new GenericError(404, 'user not found'));

        for (let i = (length > 0 ? length - 1 : -1); i >= 0; i--) {
          if (waitlist[i] === user.id) {
            const _position = Math.max(Math.min(position, length), 0);
            const beforeID = length > 0 ? waitlist[_position] : null;

            if (beforeID) {
              redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
            } else {
              redis.lpush('waitlist', user.id);
            }

            waitlist.splice(_position, 0, user.id);
            return resolve(waitlist);
          }
        }
        reject(new GenericError(404, `user ${id} is not in waitlist`));
      });
    });
  });
};

export const leaveWaitlist = function leaveWaitlist(id, redis) {
  const User = mongoose.model('User');

  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    return new Promise((resolve, reject) => {
      const length = waitlist.length > 0 ? waitlist.length : 0;

      if (length === 0) return reject(new GenericError(412, 'waitlist is empty'));

      User.findOne(ObjectId(id.toLowerCase()))
      .then(user => {
        if (!user) return reject(new GenericError(404, `no user with id ${id}`));

        for (let i = length - 1; i >= 0; i--) {
          if (waitlist[i] === user.id) {
            redis.lrem('waitlist', i, user.id);
            waitlist.splice(i, 1);
            return resolve(waitlist);
          }
        }

        reject(new GenericError(404, `user ${user.username} is not in waitlist`));
      });
    });
  });
};

export const clearWaitlist = function clearWaitlist(redis) {
  let _locked = false;

  redis.del('waitlist');
  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    return new Promise((resolve, reject) => {
      if (waitlist.length === 0) {
        resolve('cleared waitlist');
      } else {
        reject(new GenericError(500, 'couldn\'t clear waitlist'));
      }
    });
  })
}

// TODO: decide whether to remove clear here or not
export const lockWaitlist = function lockWaitlist(lock, clear, redis) {
  if (clear) redis.del('waitlist');

  if (lock) {
    redis.set('waitlist:lock', lock);
  } else {
    redis.del('waitlist:lock')
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