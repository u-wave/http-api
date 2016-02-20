import Promise from 'bluebird';
import mongoose from 'mongoose';
import debug from 'debug';

import { GenericError } from './errors';

const ObjectId = mongoose.Types.ObjectId;

const log = debug('uwave:advance');

async function savePreviousStats(uw) {
  const History = uw.mongo.model('History');
  const historyID = await uw.redis.get('booth:historyID');
  if (!historyID) {
    return null;
  }

  const entry = await History.findOne(new ObjectId(historyID));
  if (!entry) {
    return null;
  }
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

export default async function advance(uw) {
  const PlaylistItem = uw.mongo.model('PlaylistItem');
  const Playlist = uw.mongo.model('Playlist');
  const History = uw.mongo.model('History');
  const User = uw.mongo.model('User');

  log('advancing');

  try {
    await savePreviousStats(uw);
  } catch (e) {
    // Continue advancing even if stats could not be saved
    log('Could not save play stats:');
    log(e.stack);
  }

  const userID = await uw.redis.lpop('waitlist');
  if (!userID) {
    return null;
  }

  const user = await User.findOne(new ObjectId(userID));
  if (!user) throw new GenericError(404, 'user not found');

  const playlistID = await uw.redis.get(`playlist:${user.id}`);
  if (!playlistID) throw new GenericError(404, 'user does not have an active playlist');

  const playlist = await Playlist.findOne(new ObjectId(playlistID));
  if (!playlist) throw new GenericError(404, 'playlist not found');

  const itemID = playlist.media.shift();
  playlist.media.push(itemID);
  await playlist.save();

  const playlistItem = await PlaylistItem.findOne(itemID).populate('media');
  if (!playlistItem) {
    throw new GenericError(404, 'media not found');
  }

  log('next track:', playlistItem.artist, '—', playlistItem.title);

  const media = {
    media: playlistItem.media,
    artist: playlistItem.artist,
    title: playlistItem.title,
    start: playlistItem.start,
    end: playlistItem.end
  };

  const historyEntry = new History({
    user: user.id,
    playlist: playlist.id,
    item: playlistItem.id,
    media
  });
  await historyEntry.save();

  return {
    historyID: historyEntry.id,
    userID: user.id,
    played: Date.now(),
    playlistID: playlist.id,
    item: playlistItem.id,
    media
  };
}
