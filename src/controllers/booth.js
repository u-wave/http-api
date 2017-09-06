import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { NotFoundError, PermissionError } from '../errors';

export async function isEmpty(uw) {
  return !(await uw.redis.get('booth:historyID'));
}

export async function getBooth(uw) {
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

export function getCurrentDJ(uw) {
  return uw.redis.get('booth:currentDJ');
}

export function skipBooth(uw, moderatorID, userID, reason, opts = {}) {
  uw.redis.publish('v1', createCommand('skip', { moderatorID, userID, reason }));
  uw.advance({ remove: opts.remove === true });
  return Promise.resolve(true);
}

export async function skipIfCurrentDJ(uw, userID) {
  const currentDJ = await getCurrentDJ(uw);
  if (userID === currentDJ) {
    await uw.advance({ remove: true });
  }
}

export async function replaceBooth(uw, moderatorID, id) {
  let waitlist = await uw.redis.lrange('waitlist', 0, -1);

  if (!waitlist.length) throw new NotFoundError('Waitlist is empty.');

  if (waitlist.some(userID => userID === id)) {
    uw.redis.lrem('waitlist', 1, id);
    await uw.redis.lpush('waitlist', id);
    waitlist = await uw.redis.lrange('waitlist', 0, -1);
  }

  uw.redis.publish('v1', createCommand('boothReplace', {
    moderatorID,
    userID: id,
  }));
  uw.advance();
  return waitlist;
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

export async function favorite(uw, id, playlistID, historyID) {
  const Playlist = uw.model('Playlist');
  const PlaylistItem = uw.model('PlaylistItem');
  const History = uw.model('History');

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

  return {
    playlistSize: playlist.media.length,
    added: [playlistItem],
  };
}

export function getHistory(uw, pagination) {
  return uw.getHistory(pagination);
}
