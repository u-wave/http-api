import clamp from 'clamp';
import { createCommand } from '../sockets';
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

export async function getUsers(req) {
  const uw = req.uwave;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 50,
  });

  const users = await uw.getUsers(pagination);

  return toPaginatedResponse(users, {
    baseUrl: req.fullUrl,
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

export async function changeAvatar() {
  throw new HTTPError(500, 'Not implemented');
}

export function changeStatus(req) {
  const uw = req.uwave;
  const { status } = req.body;

  // TODO implement this in core? Or remove?
  uw.redis.publish('v1', createCommand('statusChange', {
    userID: req.user.id,
    status: clamp(status, 0, 3),
  }));

  return toItemResponse({});
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
