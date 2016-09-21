import clamp from 'clamp';

import { createCommand } from '../sockets';

import { paginate } from '../utils';
import { skipIfCurrentDJ } from './booth';
import { leaveWaitlist } from './waitlist';

export function setStatus(uw, id, status) {
  uw.redis.publish('v1', createCommand('statusChange', {
    userID: id,
    status: clamp(status, 0, 3),
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
