import clamp from 'clamp';

import { createCommand } from '../sockets';
import {
  APIError,
  HTTPError,
  NotFoundError,
  PermissionError,
} from '../errors';
import {
  ROLE_MODERATOR,
} from '../roles';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';

function isInWaitlist(waitlist, userID) {
  return waitlist.some(waitingID => waitingID === userID);
}

function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

async function isBoothEmpty(uw) {
  return !(await uw.redis.get('booth:historyID'));
}

async function isCurrentDJ(uw, userID) {
  const dj = await getCurrentDJ(uw);
  return dj !== null && dj === userID;
}

async function hasValidPlaylist(uw, userID) {
  const active = await uw.redis.get(`playlist:${userID}`);

  if (!active) return false;

  const Playlist = uw.model('Playlist');
  const playlist = await Playlist.findById(active);
  return playlist && playlist.size > 0;
}

function getWaitingUserIDs(uw) {
  return uw.redis.lrange('waitlist', 0, -1);
}

function isWaitlistLocked(uw) {
  return uw.redis.get('waitlist:lock').then(Boolean);
}

export async function getWaitlist(req) {
  const waitlist = await getWaitingUserIDs(req.uwave);
  return toListResponse(waitlist, { url: req.fullUrl });
}

// POST waitlist/ handler for joining the waitlist.
async function doJoinWaitlist(uw, user) {
  await uw.redis.rpush('waitlist', user.id);

  const waitlist = await getWaitingUserIDs(uw);

  uw.redis.publish('v1', createCommand('waitlistJoin', {
    userID: user.id,
    waitlist,
  }));

  return waitlist;
}

// POST waitlist/ handler for adding a (different) user to the waitlist.
async function doModerateAddToWaitlist(uw, user, { moderator, waitlist, position }) {
  const clampedPosition = clamp(position, 0, waitlist.length);

  if (clampedPosition < waitlist.length) {
    await uw.redis.linsert('waitlist', 'BEFORE', waitlist[clampedPosition], user.id);
  } else {
    await uw.redis.rpush('waitlist', user.id);
  }

  const newWaitlist = await getWaitingUserIDs(uw);

  uw.redis.publish('v1', createCommand('waitlistAdd', {
    userID: user.id,
    moderatorID: moderator.id,
    position: clampedPosition,
    waitlist: newWaitlist,
  }));

  return newWaitlist;
}

// POST waitlist/ entry point: used both for joining the waitlist,  and for
// adding someone else to the waitlist.
export async function addToWaitlist(req) {
  const uw = req.uwave;
  const User = uw.model('User');

  const moderator = req.user;
  const { userID } = req.body;

  const user = await User.findById(userID);
  if (!user) throw new PermissionError('User not found.');

  const canForceJoin = moderator.role >= ROLE_MODERATOR;
  if (!canForceJoin && await isWaitlistLocked(uw)) {
    throw new PermissionError('The waitlist is locked. Only staff can join.');
  }

  let waitlist = await getWaitingUserIDs(uw);
  if (isInWaitlist(waitlist, user.id)) {
    throw new PermissionError('You are already in the waitlist.');
  }
  if (await isCurrentDJ(uw, user.id)) {
    throw new PermissionError('You are already currently playing.');
  }
  if (!(await hasValidPlaylist(uw, user.id))) {
    throw new HTTPError(400,
      'You don\'t have anything to play. Please add some songs to your ' +
      'playlist and try again.');
  }

  if (user.id === moderator.id) {
    waitlist = await doJoinWaitlist(uw, user);
  } else {
    waitlist = await doModerateAddToWaitlist(uw, user, {
      moderator,
      waitlist,
      position: waitlist.length,
    });
  }

  if (await isBoothEmpty(uw)) {
    await uw.advance();
  }

  return toListResponse(waitlist, { url: req.fullUrl });
}

export async function moveWaitlist(req) {
  const uw = req.uwave;
  const User = uw.model('User');

  const moderator = req.user;
  const { userID, position } = req.body;

  let waitlist = await getWaitingUserIDs(uw);

  if (!isInWaitlist(waitlist, userID)) {
    throw new PermissionError('That user is not in the waitlist.');
  }
  if (await isCurrentDJ(uw, userID)) {
    throw new PermissionError('That user is currently playing.');
  }
  if (!(await hasValidPlaylist(uw, userID))) {
    throw new HTTPError(400, 'That user does not have anything to play.');
  }

  const user = await User.findById(userID.toLowerCase());
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const clampedPosition = clamp(position, 0, waitlist.length);
  const beforeID = waitlist[clampedPosition] || null;

  if (beforeID === user.id) {
    // No change.
    return toListResponse(waitlist, { url: req.fullUrl });
  }

  await uw.redis.lrem('waitlist', 0, user.id);
  if (beforeID) {
    await uw.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
  } else {
    await uw.redis.rpush('waitlist', user.id);
  }

  waitlist = await getWaitingUserIDs(uw);

  uw.redis.publish('v1', createCommand('waitlistMove', {
    userID: user.id,
    moderatorID: moderator.id,
    position: clampedPosition,
    waitlist,
  }));

  return toListResponse(waitlist, { url: req.fullUrl });
}

export async function removeFromWaitlist(req) {
  const uw = req.uwave;
  const moderator = req.user;
  const user = await uw.getUser(req.params.id);

  const isRemoving = user.id !== moderator.id;
  if (isRemoving && moderator.role < ROLE_MODERATOR) {
    throw new PermissionError('You need to be a moderator to do this.');
  }

  let waitlist = await getWaitingUserIDs(uw);
  if (!isInWaitlist(waitlist, user.id)) {
    throw new NotFoundError('That user is not in the waitlist.');
  }

  await uw.redis.lrem('waitlist', 0, user.id);

  waitlist = await getWaitingUserIDs(uw);
  if (isRemoving) {
    uw.publish('waitlist:remove', {
      userID: user.id,
      moderatorID: moderator.id,
      waitlist,
    });
  } else {
    uw.publish('waitlist:leave', {
      userID: user.id,
      waitlist,
    });
  }

  return toListResponse(waitlist, { url: req.fullUrl });
}

export async function clearWaitlist(req) {
  const uw = req.uwave;
  const moderator = req.user;

  await uw.redis.del('waitlist');

  const waitlist = await getWaitingUserIDs(uw);
  if (waitlist.length !== 0) {
    throw new APIError('Could not clear the waitlist. Please try again.');
  }

  uw.redis.publish('v1', createCommand('waitlistClear', {
    moderatorID: moderator.id,
  }));

  return toListResponse(waitlist, { url: req.fullUrl });
}

export async function lockWaitlist(req) {
  const uw = req.uwave;
  const moderator = req.user;

  const { lock } = req.body;

  if (lock) {
    await uw.redis.set('waitlist:lock', lock);
  } else {
    await uw.redis.del('waitlist:lock');
  }

  const isLocked = await isWaitlistLocked(uw);

  if (isLocked !== lock) {
    throw new APIError(
      `Could not ${lock ? 'lock' : 'unlock'} the waitlist. Please try again.`);
  }

  uw.redis.publish('v1', createCommand('waitlistLock', {
    moderatorID: moderator.id,
    locked: isLocked,
  }));

  return toItemResponse({
    locked: lock,
  }, { url: req.fullUrl });
}
