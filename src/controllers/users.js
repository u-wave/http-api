import clamp from 'clamp';
import { createCommand } from '../sockets';
import { skipIfCurrentDJ } from './booth';
import { leaveWaitlist } from './waitlist';
import {
  HTTPError,
  PermissionError,
} from '../errors';
import { ROLE_MANAGER } from '../roles';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
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

export async function changeRole(req) {
  const uw = req.uwave;
  const { id } = req.params;
  const { role } = req.body;
  if (req.user.role < req.body.role) {
    throw new PermissionError('You can\'t promote users above your rank.');
  }

  const user = await uw.updateUser(
    id,
    { role },
    { moderator: req.user },
  );

  return toItemResponse(user);
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

export async function changeAvatar(req) {
  if (!req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
    throw new PermissionError('You need to be a manager to do this');
  }

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
    await leaveWaitlist(uw, userID);
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
