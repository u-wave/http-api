import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

function isInWaitlist(waitlist, userID) {
  return waitlist.some(waitingID => waitingID === userID);
}

export function getWaitlist(redis) {
  return redis.lrange('waitlist', 0, -1);
}

function _getWaitlist(forceJoin, redis) {
  return redis.get('waitlist:lock')
  .then(lock => {
    if (lock && !forceJoin) throw new GenericError(403, 'waitlist is locked');
    return redis.lrange('waitlist', 0, -1);
  });
}

export function appendToWaitlist(userID, forceJoin, uwave) {
  const User = uwave.mongo.model('User');
  let role = 0;

  return User.findOne(new ObjectId(userID))
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    role = user.role;
    return _getWaitlist(forceJoin, uwave.redis);
  })
  .then(waitlist => {
    if (isInWaitlist(waitlist, userID)) {
      throw new GenericError(403, 'already in waitlist');
    }

    uwave.redis.rpush('waitlist', userID);
    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uwave.redis.publish('v1', createCommand('waitlistJoin', { userID, waitlist }));

    uwave.redis.publish('v1p', createCommand('checkAdvance', role));

    return waitlist;
  });
}

export function insertWaitlist(moderatorID, id, position, forceJoin, uwave) {
  const User = uwave.mongo.model('User');
  let role = 0;
  let clampedPosition = position;

  return User.find(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    role = user.role;
    return _getWaitlist(forceJoin, uwave.redis);
  })
  .then(waitlist => {
    const length = waitlist.length;
    clampedPosition = Math.max(Math.min(position, length - 1), 0);

    if (isInWaitlist(waitlist, id)) {
      throw new GenericError(403, 'already in waitlist');
    }

    if (length > clampedPosition) {
      uwave.redis.linsert('waitlist', 'BEFORE', waitlist[clampedPosition], id);
    } else {
      uwave.redis.lpush('waitlist', id);
    }

    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uwave.redis.publish('v1', createCommand('waitlistAdd', {
      userID: id,
      moderatorID,
      position: clampedPosition,
      waitlist
    }));

    uwave.redis.publish('v1p', createCommand('checkAdvance', role));

    return waitlist;
  });
}

export function moveWaitlist(moderatorID, userID, position, uwave) {
  const User = uwave.mongo.model('User');
  let beforeID = null;
  const _position = Math.max(Math.min(position, length), 0);

  return uwave.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    beforeID = waitlist[_position] || null;

    if (isInWaitlist(waitlist, userID)) {
      return User.findOne(new ObjectId(userID.toLowerCase()));
    }

    throw new GenericError(404, `user ${userID} is not in waitlist`);
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
      userID,
      moderatorID,
      position: _position,
      waitlist
    }));

    return waitlist;
  });
}

export function leaveWaitlist(moderatorID, id, uwave) {
  const User = uwave.mongo.model('User');
  let _waitlist = null;

  return uwave.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length > 0 ? waitlist.length : 0;

    if (length === 0) throw new GenericError(412, 'waitlist is empty');

    _waitlist = waitlist;
    return User.findOne(new ObjectId(id.toLowerCase()));
  })
  .then(user => {
    if (!user) throw new GenericError(404, `no user with id ${id}`);

    if (isInWaitlist(_waitlist, user.id)) {
      uwave.redis.lrem('waitlist', 0, user.id);
      return uwave.redis.lrange('waitlist', 0, -1);
    }

    throw new GenericError(404, `user ${user.username} is not in waitlist`);
  })
  .then(waitlist => {
    if (moderatorID !== id) {
      uwave.redis.publish('v1', createCommand('waitlistRemove', {
        userID: id,
        moderatorID, waitlist
      }));
    } else {
      uwave.redis.publish('v1', createCommand('waitlistLeave', {
        userID: id,
        waitlist
      }));
    }

    return waitlist;
  });
}

export function clearWaitlist(moderatorID, redis) {
  redis.del('waitlist');
  return redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    if (waitlist.length === 0) {
      redis.publish('v1', createCommand('waitlistClear', { moderatorID }));
      return waitlist;
    }
    throw new GenericError(500, 'couldn\'t clear waitlist');
  });
}

export function lockWaitlist(moderatorID, lock, clear, redis) {
  if (clear) redis.del('waitlist');

  if (lock) {
    redis.set('waitlist:lock', lock);
  } else {
    redis.del('waitlist:lock');
  }

  return redis.get('waitlist:lock')
  .then(locked => {
    return new Promise((resolve, reject) => {
      if (Boolean(locked) === lock) {
        redis.publish('v1', createCommand('waitlistLock', { moderatorID, locked }));

        if (clear) {
          redis.publish('v1', createCommand('waitlistClear', { moderatorID }));
        }
        resolve({
          locked: lock,
          cleared: clear
        });
      } else {
        reject(new GenericError(500, `couldn't ${lock ? 'lock' : 'unlock'} waitlist`));
      }
    });
  });
}
