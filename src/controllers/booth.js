import props from 'p-props';
import {
  CombinedError,
  HTTPError,
  NotFoundError,
  PermissionError,
} from '../errors';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export async function getBoothData(uw) {
  const historyEntry = await uw.booth.getCurrentEntry();

  if (!historyEntry || !historyEntry.user) {
    return null;
  }

  await historyEntry.populate('media.media').execPopulate();

  const stats = await props({
    upvotes: uw.redis.smembers('booth:upvotes'),
    downvotes: uw.redis.smembers('booth:downvotes'),
    favorites: uw.redis.smembers('booth:favorites'),
  });

  return {
    historyID: historyEntry.id,
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
  uw.publish('booth:skip', {
    moderatorID,
    userID,
    reason,
  });

  await uw.advance({
    remove: opts.remove === true,
  });
}

export async function skipBooth(req) {
  const skippingSelf = (!req.body.userID && !req.body.reason)
    || req.body.userID === req.user.id;
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
  if (!(await req.user.can('booth.skip.other'))) {
    errors.push(new PermissionError('You need to be a moderator to do this'));
  }
  if (typeof req.body.userID !== 'string') {
    errors.push(new HTTPError(422, 'userID: Expected a string'));
  }
  if (typeof req.body.reason !== 'string') {
    errors.push(new HTTPError(422, 'reason: Expected a string'));
  }
  if (errors.length > 0) {
    throw new CombinedError(errors);
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

  uw.publish('booth:replace', {
    moderatorID,
    userID,
  });

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
  const PlaylistItem = uw.model('PlaylistItem');
  const History = uw.model('History');

  const { id } = req.user;
  const { playlistID, historyID } = req.body;

  const historyEntry = await History.findById(historyID)
    .populate('media.media');

  if (!historyEntry) {
    throw new NotFoundError('History entry not found.');
  }
  if (`${historyEntry.user}` === id) {
    throw new PermissionError('You can\'t favorite your own plays.');
  }

  const playlist = await req.user.getPlaylist(playlistID);

  if (!playlist) throw new NotFoundError('Playlist not found.');

  // `.media` has the same shape as `.item`, but is guaranteed to exist and have
  // the same properties as when the playlist item was actually played.
  const playlistItem = new PlaylistItem(historyEntry.media.toJSON());

  await playlistItem.save();

  playlist.media.push(playlistItem.id);

  await uw.redis.sadd('booth:favorites', id);
  uw.publish('booth:favorite', {
    userID: id,
    playlistID,
  });

  await playlist.save();

  return toListResponse([playlistItem], {
    meta: {
      playlistSize: playlist.media.length,
    },
    included: {
      media: ['media'],
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
