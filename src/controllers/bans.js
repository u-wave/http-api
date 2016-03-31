import escapeStringRegExp from 'escape-string-regexp';

import { HTTPError, NotFoundError } from '../errors';

function isValidBan(user) {
  return !!(user.banned && user.banned.expires > Date.now());
}

export async function isBanned(uw, user) {
  const User = uw.model('User');

  if (user instanceof User && 'banned' in user) {
    return isValidBan(user);
  }

  const userID = typeof user === 'object' ? user._id : user;
  const userModel = await User.findById(userID, { banned: true });

  return isValidBan(userModel);
}

export async function getBans(uw, filter = null, pagination = {}) {
  const User = uw.model('User');

  const page = isFinite(pagination.page) ? pagination.page : 0;
  const limit = isFinite(pagination.limit) ? pagination.limit : 50;

  const query = User.find()
    .where('banned').ne(null)
    .where('expires').gt(Date.now())
    .skip(page * limit)
    .limit(limit)
    .populate('banned.moderator')
    .lean();

  if (filter) {
    query.where('username').regex(RegExp(escapeStringRegExp(filter), 'i'));
  }

  const bannedUsers = await query.exec();
  return bannedUsers.map(user => {
    const ban = user.banned;
    delete user.banned;
    ban.user = user;
    return ban;
  });
}

export async function addBan(uw, user, { duration, moderatorID, permanent = false }) {
  const User = uw.model('User');

  const userID = typeof user === 'object' ? user._id : user;
  const userModel = await User.findById(userID);

  if (!userModel) {
    throw new NotFoundError('User not found.');
  }
  if (duration <= 0 && !permanent) {
    throw new HTTPError(400, 'Ban duration should be at least 0ms.');
  }

  userModel.banned = {
    duration: permanent ? -1 : duration,
    expires: permanent ? 0 : Date.now() + duration,
    moderator: moderatorID,
    reason: ''
  };

  await userModel.save();
  await userModel.populate('banned.moderator').execPopulate();

  uw.publish('user:ban', {
    userID: userModel.id,
    moderatorID: userModel.banned.moderator.id,
    duration: userModel.banned.duration,
    expires: userModel.banned.expires,
    permanent
  });

  return userModel.banned;
}

export async function removeBan(uw, user, { moderatorID }) {
  const User = uw.model('User');

  const userID = typeof user === 'object' ? user._id : user;

  const userModel = await User.findById(userID);

  if (!userModel) {
    throw new NotFoundError(`User not found.`);
  }
  if (!userModel.banned) {
    throw new NotFoundError(`User "${user.username}" is not banned.`);
  }

  delete userModel.banned;

  await userModel.save();

  uw.publish('user:unban', {
    userID: `${userModel.id}`,
    moderatorID
  });

  return {};
}
