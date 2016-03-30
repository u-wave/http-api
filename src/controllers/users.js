import clamp from 'clamp';
import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { paginate } from '../utils';
import { HTTPError } from '../errors';
import { ROLE_DEFAULT, ROLE_ADMIN } from '../roles';

import { skipIfCurrentDJ } from './booth';
import { leaveWaitlist } from './waitlist';

const ObjectId = mongoose.Types.ObjectId;

export function getUsers(uw, page, limit) {
  const User = uw.model('User');
  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 50 : Math.min(limit, 50);

  return User.find().setOptions({ limit: _limit, page: _limit * _page });
}

export function getUser(uw, id) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id));
}

export function banUser(uw, moderatorID, id, time, exiled) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new HTTPError(404, `user with ID ${id} not found`);

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
        uw.redis.publish('v1', createCommand(time > 0 ? 'ban' : 'unban', {
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

export async function muteUser(uw, moderatorID, userID, duration) {
  const User = uw.model('User');

  const user = await User.findById(userID);
  if (!user) throw new HTTPError(404, `user with ID ${userID} not found`);

  await uw.redis.set(`mute:${userID}`, moderatorID, 'PX', duration);
  uw.publish('chat:mute', {
    moderatorID,
    userID: user.id,
    duration
  });

  return user;
}

export async function unmuteUser(uw, moderatorID, userID) {
  const User = uw.model('User');

  const user = await User.findById(userID);
  if (!user) throw new HTTPError(404, `user with ID ${userID} not found`);

  await uw.redis.del(`mute:${user.id}`);
  uw.publish('chat:unmute', {
    moderatorID,
    userID: user.id
  });

  return user;
}

export function changeRole(uw, moderatorID, id, role) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new HTTPError(404, `user with ID ${id} not found`);

    user.role = clamp(role, ROLE_DEFAULT, ROLE_ADMIN);

    uw.redis.publish('v1', createCommand('roleChange', {
      moderatorID,
      userID: user.id,
      role: user.role
    }));
    return user.save();
  });
}

export function changeUsername(uw, moderatorID, id, name) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) {
      throw new HTTPError(404, `user with ID ${id} not found`);
    }
    if (user.id !== id && user.role < ROLE_ADMIN) {
      throw new HTTPError(403, 'you need to be an admin to do this');
    }

    user.username = name;
    user.slug = name.toLowerCase();

    return user.save();
  })
  .tap(user => {
    uw.redis.publish('v1', createCommand('nameChange', {
      moderatorID,
      userID: id,
      username: user.username
    }));
  });
}

export function setStatus(uw, id, status) {
  uw.redis.publish('v1', createCommand('statusChange', {
    userID: id,
    status: clamp(status, 0, 3)
  }));
}

export async function disconnectUser(uw, user) {
  const userID = typeof user === 'object' ? `${user._id}` : user;

  await skipIfCurrentDJ(uw, userID);

  try {
    await leaveWaitlist(uw, userID);
  } catch (e) {
    // Ignore
  }

  await uw.redis.lrem('users', 0, userID);

  uw.publish('user:leave', { userID });
}

export function getHistory(uw, id, page, limit) {
  const History = uw.model('History');

  const _page = !isNaN(page) ? page : 0;
  const _limit = !isNaN(limit) ? limit : 25;

  return History.find({ user: id })
    .skip(_page * _limit)
    .limit(_limit)
    .sort({ played: -1 })
    .populate('media.media user')
    .then(history => paginate(_page, _limit, history));
}
