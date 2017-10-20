import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getBans(req) {
  const uw = req.uwave;

  const { filter } = req.query;
  const pagination = getOffsetPagination(req.query);

  const bans = await uw.bans.getBans(filter, pagination);

  return toPaginatedResponse(bans, {
    included: {
      user: ['user'],
    },
    baseUrl: req.fullUrl,
  });
}

export async function addBan(req) {
  const uw = req.uwave;

  const {
    duration = 0,
    userID,
    permanent = false,
    reason = '',
  } = req.body;

  const ban = await uw.bans.ban(userID, {
    moderator: req.user,
    duration,
    permanent,
    reason,
  });

  return toItemResponse(ban, {
    url: req.fullUrl,
  });
}

export async function removeBan(req) {
  const uw = req.uwave;

  const { userID } = req.params;

  await uw.bans.unban(userID, {
    moderator: req.user,
  });

  return toItemResponse({}, {
    url: req.fullUrl,
  });
}
