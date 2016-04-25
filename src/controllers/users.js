import clamp from 'clamp';
import mongoose from 'mongoose';

import { createCommand } from '../sockets';
import { paginate } from '../utils';
import { NotFoundError, PermissionError } from '../errors';
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

export async function muteUser(uw, moderator, userID, duration) {
  const user = await uw.model('User').findById(userID);
  if (!user) throw new NotFoundError('User not found.');

  return await user.mute(duration, { moderator });
}

export async function unmuteUser(uw, moderator, userID) {
  const user = await uw.model('User').findById(userID);
  if (!user) throw new NotFoundError('User not found.');

  return await user.unmute({ moderator });
}

export function changeRole(uw, moderatorID, id, role) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id))
  .then(user => {
    if (!user) throw new NotFoundError('User not found.');

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
      throw new NotFoundError('User not found.');
    }
    if (user.id !== id && user.role < ROLE_ADMIN) {
      throw new PermissionError('You can\'t change another user\'s username.');
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
    .sort({ playedAt: -1 })
    .populate('media.media user')
    .then(history => paginate(_page, _limit, history));
}
