import createDebug from 'debug';
import {
  HTTPError,
  PermissionError,
} from '../errors';
import skipIfCurrentDJ from '../utils/skipIfCurrentDJ';
import removeFromWaitlist from '../utils/removeFromWaitlist';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';

export { muteUser, unmuteUser } from './chat';

const debug = createDebug('uwave:http:users');

export async function getUsers(req) {
  const uw = req.uwave;
  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 50,
  });

  debug('getUsers', filter, pagination);

  const users = await uw.getUsers(filter, pagination);

  return toPaginatedResponse(users, {
    baseUrl: req.fullUrl,
    filter,
  });
}

export async function getUser(req) {
  const uw = req.uwave;
  const userID = req.params.id;

  const user = await uw.getUser(userID);

  return toItemResponse(user, {
    url: req.fullUrl,
  });
}

export async function getUserRoles(req) {
  const uw = req.uwave;
  const { id } = req.params;

  const user = await uw.getUser(id);
  const roles = await user.getPermissions();

  return toListResponse(roles, {
    url: req.fullUrl,
  });
}

export async function addUserRole(req) {
  const uw = req.uwave;
  const { id, role } = req.params;

  const selfHasRole = await req.user.can(role);
  if (!selfHasRole) {
    throw new PermissionError('You cannot assign roles you do not have');
  }

  const user = await uw.getUser(id);

  await user.allow([role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function removeUserRole(req) {
  const uw = req.uwave;
  const { id, role } = req.params;

  const selfHasRole = await req.user.can(role);
  if (!selfHasRole) {
    throw new PermissionError('You cannot remove roles you do not have');
  }

  const user = await uw.getUser(id);

  await user.disallow([role]);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function changeUsername(req) {
  const uw = req.uwave;
  const { id } = req.params;
  const { username } = req.body;

  try {
    const user = await uw.updateUser(
      id,
      { username },
      { moderator: req.user },
    );

    return toItemResponse(user);
  } catch (error) {
    throw beautifyDuplicateKeyError(error);
  }
}

export async function getAvailableAvatars(req, res) {
  const { user } = req;
  const { avatars } = req.uwave;
  const { id } = req.params;

  if (user.id !== id) {
    throw new PermissionError('You can\'t change someone else\'s avatar.');
  }

  const list = await avatars.getAvailableAvatars(user);

  return toListResponse(list, {
    url: req.fullUrl,
  });
}

export async function setTypeAvatar(req, res) {
  const { user } = req;
  const { avatars } = req.uwave;
  const { id } = req.params;
  const avatar = req.body;

  if (user.id !== id) {
    throw new PermissionError('You can\'t change someone else\'s avatar.');
  }

  await avatars.setAvatar(user, avatar);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function setCustomAvatar(req, res) {
  const { user } = req;
  const { avatars } = req.uwave;
  const { id } = req.params;
  const stream = req;

  if (user.id !== id) {
    throw new PermissionError('You can\'t change someone else\'s avatar.');
  }

  await avatars.setCustomAvatar(user, stream);

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}

export async function disconnectUser(uw, user) {
  const userID = typeof user === 'object' ? `${user._id}` : user;

  await skipIfCurrentDJ(uw, userID);

  try {
    await removeFromWaitlist(uw, userID);
  } catch (e) {
    // Ignore
  }

  await uw.redis.lrem('users', 0, userID);

  uw.publish('user:leave', { userID });
}

export async function getHistory(req) {
  const uw = req.uwave;
  const { id } = req.params;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });

  const user = await uw.getUser(id);
  const history = await user.getHistory(pagination);

  return toPaginatedResponse(history, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}
