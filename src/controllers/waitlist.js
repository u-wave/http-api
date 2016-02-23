import clamp from 'clamp';
import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

function isInWaitlist(waitlist, userID) {
  return waitlist.some(waitingID => waitingID === userID);
}

export function getWaitlist(uw) {
  return uw.redis.lrange('waitlist', 0, -1);
}

function _getWaitlist(uw, forceJoin) {
  return uw.redis.get('waitlist:lock')
  .then(lock => {
    if (lock && !forceJoin) throw new GenericError(403, 'waitlist is locked');
    return uw.redis.lrange('waitlist', 0, -1);
  });
}

export function appendToWaitlist(uw, userID, forceJoin) {
  const User = uw.mongo.model('User');
  let role = 0;

  return User.findOne(new ObjectId(userID))
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    role = user.role;
    return _getWaitlist(uw, forceJoin);
  })
  .then(waitlist => {
    if (isInWaitlist(waitlist, userID)) {
      throw new GenericError(403, 'already in waitlist');
    }

    uw.redis.rpush('waitlist', userID);
    return uw.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uw.redis.publish('v1', createCommand('waitlistJoin', { userID, waitlist }));

    uw.redis.publish('v1p', createCommand('checkAdvance', role));

    return waitlist;
  });
}

export function insertWaitlist(uw, moderatorID, id, position, forceJoin) {
  const User = uw.mongo.model('User');
  let role = 0;
  let clampedPosition = position;

  return User.find(new ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    role = user.role;
    return _getWaitlist(uw, forceJoin);
  })
  .then(waitlist => {
    const length = waitlist.length;
    clampedPosition = clamp(position, 0, length - 1);

    if (isInWaitlist(waitlist, id)) {
      throw new GenericError(403, 'already in waitlist');
    }

    if (length > clampedPosition) {
      uw.redis.linsert('waitlist', 'BEFORE', waitlist[clampedPosition], id);
    } else {
      uw.redis.lpush('waitlist', id);
    }

    return uw.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uw.redis.publish('v1', createCommand('waitlistAdd', {
      userID: id,
      moderatorID,
      position: clampedPosition,
      waitlist
    }));

    uw.redis.publish('v1p', createCommand('checkAdvance', role));

    return waitlist;
  });
}

export function moveWaitlist(uw, moderatorID, userID, position) {
  const User = uw.mongo.model('User');
  let beforeID = null;
  let _position = null;

  return uw.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    _position = clamp(position, 0, waitlist.length);
    beforeID = waitlist[_position] || null;

    if (isInWaitlist(waitlist, userID)) {
      return User.findOne(new ObjectId(userID.toLowerCase()));
    }

    throw new GenericError(404, `user ${userID} is not in waitlist`);
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');

    if (beforeID) {
      uw.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
    } else {
      uw.redis.lpush('waitlist', user.id);
    }

    return uw.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    uw.redis.publish('v1', createCommand('waitlistAdd', {
      userID,
      moderatorID,
      position: _position,
      waitlist
    }));

    return waitlist;
  });
}

export function leaveWaitlist(uw, moderatorID, id) {
  const User = uw.mongo.model('User');
  let _waitlist = null;

  return uw.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    const length = waitlist.length > 0 ? waitlist.length : 0;

    if (length === 0) throw new GenericError(412, 'waitlist is empty');

    _waitlist = waitlist;
    return User.findOne(new ObjectId(id.toLowerCase()));
  })
  .then(user => {
    if (!user) throw new GenericError(404, `no user with id ${id}`);

    if (isInWaitlist(_waitlist, user.id)) {
      uw.redis.lrem('waitlist', 0, user.id);
      return uw.redis.lrange('waitlist', 0, -1);
    }

    throw new GenericError(404, `user ${user.username} is not in waitlist`);
  })
  .then(waitlist => {
    if (moderatorID !== id) {
      uw.redis.publish('v1', createCommand('waitlistRemove', {
        userID: id,
        moderatorID, waitlist
      }));
    } else {
      uw.redis.publish('v1', createCommand('waitlistLeave', {
        userID: id,
        waitlist
      }));
    }

    return waitlist;
  });
}

export function clearWaitlist(uw, moderatorID) {
  uw.redis.del('waitlist');
  return uw.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    if (waitlist.length === 0) {
      uw.redis.publish('v1', createCommand('waitlistClear', { moderatorID }));
      return waitlist;
    }
    throw new GenericError(500, 'couldn\'t clear waitlist');
  });
}

export function lockWaitlist(uw, moderatorID, lock, clear) {
  if (clear) uw.redis.del('waitlist');

  if (lock) {
    uw.redis.set('waitlist:lock', lock);
  } else {
    uw.redis.del('waitlist:lock');
  }

  return uw.redis.get('waitlist:lock')
  .then(locked => {
    return new Promise((resolve, reject) => {
      if (Boolean(locked) === lock) {
        uw.redis.publish('v1', createCommand('waitlistLock', { moderatorID, locked }));

        if (clear) {
          uw.redis.publish('v1', createCommand('waitlistClear', { moderatorID }));
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
