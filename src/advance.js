import Promise from 'bluebird';
import mongoose from 'mongoose';
import debug from 'debug';

import { GenericError } from './errors';
import { getWaitlist } from './controllers/waitlist';

const ObjectId = mongoose.Types.ObjectId;

const log = debug('uwave:advance');

async function getPreviousEntry(uw) {
  const History = uw.model('History');
  const historyID = await uw.redis.get('booth:historyID');
  if (!historyID) {
    return null;
  }

  return await History.findOne(new ObjectId(historyID));
}

async function saveStats(uw, entry) {
  const stats = await Promise.props({
    upvotes: uw.redis.lrange('booth:upvotes', 0, -1),
    downvotes: uw.redis.lrange('booth:downvotes', 0, -1),
    favorites: uw.redis.lrange('booth:favorites', 0, -1)
  });

  log('previous track:', entry.media.artist, '—', entry.media.title,
    `👍 ${stats.upvotes.length} ` +
    `★ ${stats.favorites.length} ` +
    `👎 ${stats.downvotes.length}`
  );

  Object.assign(entry, stats);
  return await entry.save();
}

async function cyclePlaylist(uw, playlist) {
  const item = playlist.media.shift();
  playlist.media.push(item);
  await playlist.save();
}

async function getNextEntry(uw) {
  const HistoryEntry = uw.model('History');
  const User = uw.model('User');

  let userID = await uw.redis.lindex('waitlist', 0);
  if (!userID) {
    userID = await uw.redis.get('booth:currentDJ');
    return null;
  }

  const user = await User.findOne(new ObjectId(userID));
  if (!user) throw new GenericError(404, 'user not found');

  const playlist = await user.getActivePlaylist();
  if (!playlist) throw new GenericError(404, 'playlist not found');

  const playlistItem = await playlist.getItemAt(0);
  if (!playlistItem) throw new GenericError(404, 'media not found');

  await playlistItem.populate('media').execPopulate();

  await cyclePlaylist(uw, playlist);

  const media = {
    media: playlistItem.media,
    artist: playlistItem.artist,
    title: playlistItem.title,
    start: playlistItem.start,
    end: playlistItem.end
  };

  return new HistoryEntry({
    user,
    playlist,
    item: playlistItem,
    media
  });
}

function clearBooth(uw) {
  return uw.redis.del([
    'booth:historyID',
    'booth:currentDJ',
    'booth:upvotes',
    'booth:downvotes',
    'booth:favorites'
  ]);
}

function updateBooth(uw, historyEntry) {
  return Promise.all([
    uw.redis.del([
      'booth:upvotes',
      'booth:downvotes',
      'booth:favorites'
    ]),
    uw.redis.set('booth:historyID', historyEntry.id),
    uw.redis.set('booth:currentDJ', historyEntry.user.id)
  ]);
}

export default async function advance(uw, opts = {}) {
  log('advancing');

  const prev = await getPreviousEntry(uw);

  if (prev) {
    try {
      await saveStats(uw, prev);
    } catch (e) {
      // Continue advancing even if stats could not be saved
      log('Could not save play stats:');
      log(e.stack);
    }
  }

  const shouldAddToWaitlist = prev && !opts.remove;
  if (shouldAddToWaitlist) {
    await uw.redis.rpush('waitlist', prev.user);
  }

  let next;
  try {
    next = await getNextEntry(uw);
    if (next) {
      await next.save();
    }
  } catch (e) {
    log('Could not retrieve next entry');
    log(e.stack);
  }

  if (next) {
    log('next track:', next.media.artist, '—', next.media.title);
  } else {
    log('next track: none');
  }

  // Remove the new DJ from the wait list
  await uw.redis.lpop('waitlist');

  if (next) {
    await updateBooth(uw, next);
  } else {
    await clearBooth(uw);
  }

  const waitlist = await getWaitlist(uw);

  if (next) {
    await uw.publish('playlist:cycle', {
      userID: next.user.id,
      playlistID: next.playlist.id
    });
  }

  return {
    historyEntry: next,
    waitlist
  };
}
