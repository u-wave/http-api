import clamp from 'clamp';
import mongoose from 'mongoose';

import {
  getCurrentDJ,
  isEmpty as boothIsEmpty
} from '../controllers/booth';
import { createCommand } from '../sockets';
import { APIError, HTTPError, NotFoundError, PermissionError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

function isInWaitlist(waitlist, userID) {
  return waitlist.some(waitingID => waitingID === userID);
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

export async function getWaitlist(uw) {
  return await uw.redis.lrange('waitlist', 0, -1);
}

async function _getWaitlist(uw, forceJoin) {
  const isLocked = await uw.redis.get('waitlist:lock');
  if (isLocked && !forceJoin) {
    throw new PermissionError('The waitlist is locked. Only staff can join.');
  }
  return await getWaitlist(uw);
}

export async function appendToWaitlist(uw, userID, forceJoin) {
  const User = uw.model('User');

  const user = await User.findOne(new ObjectId(userID));

  if (!user) throw new PermissionError('User not found.');

  let waitlist = await _getWaitlist(uw, forceJoin);

  if (isInWaitlist(waitlist, user.id)) {
    throw new PermissionError('You are already in the waitlist.');
  }

  if (await isCurrentDJ(uw, user.id)) {
    throw new PermissionError('You are already currently playing.');
  }

  if (!(await hasValidPlaylist(uw, user.id))) {
    throw new HTTPError(400,
      'You don\'t have anything to play. Please add some songs to your ' +
      'playlist and try again.'
    );
  }

  await uw.redis.rpush('waitlist', user.id);

  waitlist = await getWaitlist(uw);

  uw.redis.publish('v1', createCommand('waitlistJoin', {
    userID: user.id,
    waitlist
  }));

  if (await boothIsEmpty(uw)) {
    uw.advance();
  }

  return waitlist;
}

export async function insertWaitlist(uw, moderatorID, id, position, forceJoin) {
  const User = uw.model('User');

  const user = await User.find(new ObjectId(id));

  if (!user) throw new NotFoundError('User not found.');

  let waitlist = await _getWaitlist(uw, forceJoin);

  const clampedPosition = clamp(position, 0, waitlist.length - 1);

  if (isInWaitlist(waitlist, id)) {
    throw new PermissionError('You are already in the waitlist.');
  }

  if (await isCurrentDJ(uw, id)) {
    throw new PermissionError('You are already currently playing.');
  }

  if (!(await hasValidPlaylist(uw, id))) {
    throw new HTTPError(400,
      'You don\'t have anything to play. Please add some songs to your ' +
      'playlist and try again.'
    );
  }

  if (waitlist.length > clampedPosition) {
    await uw.redis.linsert('waitlist', 'BEFORE', waitlist[clampedPosition], id);
  } else {
    await uw.redis.lpush('waitlist', id);
  }

  waitlist = await getWaitlist(uw);

  uw.redis.publish('v1', createCommand('waitlistAdd', {
    userID: id,
    moderatorID,
    position: clampedPosition,
    waitlist
  }));

  if (await boothIsEmpty(uw)) {
    uw.advance();
  }

  return waitlist;
}

export async function moveWaitlist(uw, moderatorID, userID, position) {
  const User = uw.model('User');

  let waitlist = await getWaitlist(uw);

  if (!isInWaitlist(waitlist, userID)) {
    throw new PermissionError('That user is not in the waitlist.');
  }

  if (await isCurrentDJ(uw, userID)) {
    throw new PermissionError('That user is currently playing.');
  }

  if (!(await hasValidPlaylist(uw, userID))) {
    throw new HTTPError(400, 'That user does not have anything to play');
  }

  const user = await User.findOne(new ObjectId(userID.toLowerCase()));
  if (!user) {
    throw new NotFoundError('User not found.');
  }

  const clampedPosition = clamp(position, 0, waitlist.length);
  const beforeID = waitlist[clampedPosition] || null;

  if (beforeID === user.id) {
    // No change.
    return waitlist;
  }

  await uw.redis.lrem('waitlist', 0, user.id);
  if (beforeID) {
    await uw.redis.linsert('waitlist', 'BEFORE', beforeID, user.id);
  } else {
    await uw.redis.lpush('waitlist', user.id);
  }

  waitlist = await getWaitlist(uw);

  uw.redis.publish('v1', createCommand('waitlistMove', {
    userID,
    moderatorID,
    position: clampedPosition,
    waitlist
  }));

  return waitlist;
}

async function removeUser(uw, userID) {
  const waitlist = await getWaitlist(uw);
  if (!isInWaitlist(waitlist, userID)) {
    throw new NotFoundError('That user is not in the waitlist.');
  }

  await uw.redis.lrem('waitlist', 0, userID);
}

export async function leaveWaitlist(uw, user) {
  const userID = typeof user === 'object' ? `${user._id}` : user;

  await removeUser(uw, userID);

  const waitlist = await getWaitlist(uw);
  uw.publish('waitlist:leave', { userID, waitlist });

  return waitlist;
}

export async function removeFromWaitlist(uw, user, moderator) {
  const userID = typeof user === 'object' ? `${user._id}` : user;
  const moderatorID = typeof moderator === 'object' ? `${moderator._id}` : moderator;

  await removeUser(uw, userID);

  const waitlist = await getWaitlist(uw);
  uw.publish('waitlist:remove', { userID, moderatorID, waitlist });

  return waitlist;
}

export async function clearWaitlist(uw, moderatorID) {
  await uw.redis.del('waitlist');
  const waitlist = await getWaitlist(uw);

  if (waitlist.length !== 0) {
    throw new APIError('Could not clear the waitlist. Please try again.');
  }

  uw.redis.publish('v1', createCommand('waitlistClear', { moderatorID }));

  return waitlist;
}

export async function lockWaitlist(uw, moderatorID, lock) {
  if (lock) {
    await uw.redis.set('waitlist:lock', lock);
  } else {
    await uw.redis.del('waitlist:lock');
  }

  const isLocked = Boolean(await uw.redis.get('waitlist:lock'));

  if (isLocked !== lock) {
    throw new APIError(
      `Could not ${lock ? 'lock' : 'unlock'} the waitlist. Please try again.`
    );
  }

  uw.redis.publish('v1', createCommand('waitlistLock', {
    moderatorID,
    locked: isLocked
  }));

  return { locked: lock };
}
