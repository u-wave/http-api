import escapeStringRegExp from 'escape-string-regexp';
import { HTTPError, NotFoundError } from '../errors';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';

function isValidBan(user) {
  return !!(user.banned && user.banned.expiresAt > Date.now());
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

export async function getBans(req) {
  const uw = req.uwave;
  const User = uw.model('User');

  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query);

  const query = User.find().where({
    banned: { $ne: null },
    'banned.expiresAt': { $gt: Date.now() },
  })
    .skip(pagination.offset)
    .limit(pagination.limit)
    .populate('banned.moderator')
    .lean();

  if (filter) {
    query.where('username').regex(RegExp(escapeStringRegExp(filter), 'i'));
  }

  const bannedUsers = await query.exec();
  const bans = bannedUsers.map((user) => {
    const ban = user.banned;
    delete user.banned;
    ban.user = user;
    return ban;
  });

  return toListResponse(bans, {
    included: {
      user: ['user'],
    },
    baseUrl: req.fullUrl,
  });
}

export async function addBan(req) {
  const uw = req.uwave;
  const User = uw.model('User');

  const moderatorID = req.user.id;
  const {
    duration = 0,
    userID,
    permanent = false,
  } = req.body;

  const userModel = await User.findById(userID);

  if (!userModel) {
    throw new NotFoundError('User not found.');
  }
  if (duration <= 0 && !permanent) {
    throw new HTTPError(400, 'Ban duration should be at least 0ms.');
  }

  userModel.banned = {
    duration: permanent ? -1 : duration,
    expiresAt: permanent ? 0 : Date.now() + duration,
    moderator: moderatorID,
    reason: '',
  };

  await userModel.save();
  await userModel.populate('banned.moderator').execPopulate();

  uw.publish('user:ban', {
    userID: userModel.id,
    moderatorID: userModel.banned.moderator.id,
    duration: userModel.banned.duration,
    expiresAt: userModel.banned.expiresAt,
    permanent,
  });

  return toItemResponse(userModel.banned, {
    url: req.fullUrl,
  });
}

export async function removeBan(req) {
  const uw = req.uwave;
  const User = uw.model('User');

  const moderatorID = req.user.id;
  const { userID } = req.params;

  const user = await User.findById(userID);

  if (!user) {
    throw new NotFoundError('User not found.');
  }
  if (!user.banned) {
    throw new NotFoundError(`User "${user.username}" is not banned.`);
  }

  await user.update({ banned: null });

  uw.publish('user:unban', {
    userID: user.id,
    moderatorID,
  });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}
