import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const getWaitlist = function getWaitlist(redis) {
  return redis.lrange('waitlist', 0, -1);
};

export const joinWaitlist = function joinWaitlist(moderatorID, id, position, forceJoin, uwave) {
  const User = uwave.mongo.model('User');
  const History = uwave.mongo.model('History');
  let beforeID = null;

  return uwave.redis.get('waitlist:lock')
  .then(lock => {
    if (lock || !forceJoin) throw new GenericError(403, 'waitlist is locked');
    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    for (let i = waitlist.length - 1; i >= 0; i--) {
      if (waitlist[i] === id) {
        throw new GenericError(403, 'already in waitlist');
      }

      if (position === i) {
        beforeID = waitlist[Math.max(position - 1, 0)];
      }
    }

    return User.findOne(ObjectId(id)).exec();
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    if (beforeID) {
      uwave.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      uwave.redis.lpush('waitlist', user.id);
    }

    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    for (let i = waitlist.length - 1; i >= 0; i--) {
      if (waitlist[i] === id) {
        if (moderatorID !== id) {
          uwave.redis.publish('v1', createCommand('waitlistAdd', {
            'userID': id,
            'moderatorID': moderatorID,
            'position': i || waitlist.length - 1,
            'waitlist': waitlist
          }));
        } else {
          uwave.redis.publish('v1', createCommand('waitlistJoin', {
            'userID': id,
            'waitlist': waitlist
          }));
        }

        return new Promise((resolve, reject) => {
          if (waitlist.length === 1) {
            History.find().sort({'played': -1}).limit(1).populate('media')
            .then(lastPlayed => {
              if (!lastPlayed.length || Date.now() - (lastPlayed.played + lastPlayed.media.duration * 1000) >= 0) {
                uwave.redis.publish('v1p', createCommand('advance', null));
                waitlist.shift();
              }
              resolve(waitlist);
            });
          }
        });
      }
    }
    throw new Error(`couldn't add user ${id} to waitlist`);
  });
};

export const moveWaitlist = function moveWaitlist(moderatorID, id, position, uwave) {
  const User = uwave.mongo.model('User');
  let beforeID = null;
  let _position = null;

  return uwave.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length;

    for (let i = (length > 0 ? length - 1 : -1); i >= 0; i--) {
      if (waitlist[i] === user.id) {
        _position = Math.max(Math.min(position, length), 0);
        beforeID = length > 0 ? waitlist[_position] : null;

        return User.findOne(ObjectId(id.toLowerCase()));
      }
    }

    throw new GenericError(404, `user ${id} is not in waitlist`);
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    if (beforeID) {
      uwave.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      uwave.redis.lpush('waitlist', user.id);
    }

    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uwave.redis.publish('v1', createCommand('waitlistAdd', {
      'userID': id,
      'moderatorID': moderatorID,
      'position': _position,
      'waitlist': waitlist
    }));

    return new Promise(resolve => resolve(waitlist));
  });
};

export const leaveWaitlist = function leaveWaitlist(moderatorID, id, uwave) {
  const User = uwave.mongo.model('User');
  let _waitlist = null;

  return uwave.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length > 0 ? waitlist.length : 0;

    if (length === 0) throw new GenericError(412, 'waitlist is empty');

    _waitlist = waitlist;
    return User.findOne(ObjectId(id.toLowerCase()));
  })
  .then(user => {
    if (!user) throw new GenericError(404, `no user with id ${id}`);

    for (let i = length - 1; i >= 0; i--) {
      if (_waitlist[i] === user.id) {
        uwave.redis.lrem('waitlist', i, user.id);
        return uwave.redis.lrange('waitlist', 0, -1);
      }
    }

    throw new GenericError(404, `user ${user.username} is not in waitlist`);
  })
  .then(waitlist => {
    if (moderatorID !== id) {
      uwave.redis.publish('v1', createCommand('waitlistRemove', {
        'userID': id,
        'moderatorID': moderatorID,
        'waitlist': waitlist
      }));
    } else {
      uwave.redis.publish('v1', createCommand('waitlistLeave', {
        'userID': id,
        'waitlist': waitlist
      }));
    }

    return new Promise(resolve => resolve(waitlist));
  });
};

export const clearWaitlist = function clearWaitlist(moderatorID, redis) {
  redis.del('waitlist');
  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    if (waitlist.length === 0) {
      redis.publish('v1', createCommand('waitlistClear', { 'moderatorID': moderatorID }));
      return new Promise(resolve => resolve(waitlist));
    } else {
      throw new GenericError(500, 'couldn\'t clear waitlist');
    }
  });
};

// TODO: decide whether to remove clear here or not
export const lockWaitlist = function lockWaitlist(moderatorID, lock, clear, redis) {
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
        redis.publish('v1', createCommand('waitlistLock', {
          'moderatorID': moderatorID,
          'locked': lock,
          'cleared': clear
        }));
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
