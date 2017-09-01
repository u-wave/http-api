import Promise from 'bluebird';

import { createCommand } from '../sockets';
import {
  HTTPError,
  NotFoundError,
  PermissionError,
} from '../errors';
import { ROLE_MODERATOR } from '../roles';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getBoothData(uw) {
  const History = uw.model('History');

  const historyID = await uw.redis.get('booth:historyID');
  const historyEntry = await History.findById(historyID)
    .populate('media.media');

  if (!historyEntry || !historyEntry.user) {
    return null;
  }

  const stats = await Promise.props({
    upvotes: uw.redis.smembers('booth:upvotes'),
    downvotes: uw.redis.smembers('booth:downvotes'),
    favorites: uw.redis.smembers('booth:favorites'),
  });

  return {
    historyID,
    playlistID: `${historyEntry.playlist}`,
    playedAt: Date.parse(historyEntry.playedAt),
    userID: `${historyEntry.user}`,
    media: historyEntry.media,
    stats,
  };
}
export async function getBooth(req) {
  const uw = req.uwave;

  const data = await getBoothData(uw);

  return toItemResponse(data, { url: req.fullUrl });
}

function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

async function doSkip(uw, moderatorID, userID, reason, opts = {}) {
  uw.redis.publish('v1', createCommand('skip', {
    moderatorID,
    userID,
    reason,
  }));

  await uw.advance({
    remove: opts.remove === true,
  });
}

export async function skipIfCurrentDJ(uw, userID) {
  const currentDJ = await getCurrentDJ(uw);
  if (userID === currentDJ) {
    await uw.advance({ remove: true });
  }
}

export async function skipBooth(req) {
  const skippingSelf = (!req.body.userID && !req.body.reason) ||
    req.body.userID === req.user.id;
  const opts = { remove: !!req.body.remove };

  if (skippingSelf) {
    const currentDJ = await getCurrentDJ(req.uwave);
    if (!currentDJ || currentDJ !== req.user.id) {
      throw new HTTPError(412, 'You are not currently playing');
    }

    await doSkip(req.uwave, null, req.user.id, null, opts);

    return toItemResponse({});
  }

  const errors = [];
  if (req.user.role < ROLE_MODERATOR) {
    errors.push(new PermissionError('You need to be a moderator to do this'));
  }
  if (typeof req.body.userID !== 'string') {
    errors.push(new HTTPError(422, 'userID: Expected a string'));
  }
  if (typeof req.body.reason !== 'string') {
    errors.push(new HTTPError(422, 'reason: Expected a string'));
  }
  if (errors.length > 0) {
    throw errors;
  }

  await doSkip(req.uwave, req.user.id, req.body.userID, req.body.reason, opts);

  return toItemResponse({});
}

export async function replaceBooth(req) {
  const uw = req.uwave;
  const moderatorID = req.user.id;
  const { userID } = req.body;
  let waitlist = await uw.redis.lrange('waitlist', 0, -1);

  if (!waitlist.length) throw new NotFoundError('Waitlist is empty.');

  if (waitlist.some(wlID => wlID === userID)) {
    uw.redis.lrem('waitlist', 1, userID);
    await uw.redis.lpush('waitlist', userID);
    waitlist = await uw.redis.lrange('waitlist', 0, -1);
  }

  uw.redis.publish('v1', createCommand('boothReplace', {
    moderatorID,
    userID,
  }));

  await uw.advance();

  return toItemResponse({});
}

async function addVote(uw, userID, direction) {
  await Promise.all([
    uw.redis.srem('booth:upvotes', userID),
    uw.redis.srem('booth:downvotes', userID),
  ]);
  await uw.redis.sadd(
    direction > 0 ? 'booth:upvotes' : 'booth:downvotes',
    userID,
  );
  uw.publish('booth:vote', {
    userID, direction,
  });
}

export async function vote(uw, userID, direction) {
  const currentDJ = await uw.redis.get('booth:currentDJ');
  if (currentDJ !== null && currentDJ !== userID) {
    const historyID = await uw.redis.get('booth:historyID');
    if (historyID === null) return;
    if (direction > 0) {
      const upvoted = await uw.redis.sismember('booth:upvotes', userID);
      if (!upvoted) {
        await addVote(uw, userID, 1);
      }
    } else {
      const downvoted = await uw.redis.sismember('booth:downvotes', userID);
      if (!downvoted) {
        await addVote(uw, userID, -1);
      }
    }
  }
}

export async function favorite(req) {
  const uw = req.uwave;
  const Playlist = uw.model('Playlist');
  const PlaylistItem = uw.model('PlaylistItem');
  const History = uw.model('History');

  const id = req.user.id;
  const { playlistID, historyID } = req.body;

  const historyEntry = await History.findById(historyID)
    .populate('media.media');

  if (!historyEntry) {
    throw new NotFoundError('History entry not found.');
  }
  if (`${historyEntry.user}` === id) {
    throw new PermissionError('You can\'t favorite your own plays.');
  }

  const playlist = await Playlist.findById(playlistID);

  if (!playlist) throw new NotFoundError('Playlist not found.');
  if (`${playlist.author}` !== id) {
    throw new PermissionError('You can\'t edit another user\'s playlist.');
  }

  // `.media` has the same shape as `.item`, but is guaranteed to exist and have
  // the same properties as when the playlist item was actually played.
  const playlistItem = new PlaylistItem(historyEntry.media.toJSON());

  await playlistItem.save();

  playlist.media.push(playlistItem.id);

  await uw.redis.sadd('booth:favorites', id);
  uw.redis.publish('v1', createCommand('favorite', {
    userID: id,
    playlistID,
  }));

  await playlist.save();

  return toListResponse(playlistItem, {
    meta: {
      playlistSize: playlist.media.length,
    },
  });
}

export async function getHistory(req) {
  const uw = req.uwave;
  const pagination = getOffsetPagination(req.query, {
    defaultSize: 25,
    maxSize: 100,
  });

  const history = await uw.getHistory(pagination);

  return toPaginatedResponse(history, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media.media'],
      user: ['user'],
    },
  });
}
