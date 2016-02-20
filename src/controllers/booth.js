import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { paginate } from '../utils';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export async function getBooth(uw) {
  const History = uw.mongo.model('History');

  const historyID = await uw.redis.get('booth:historyID');
  const historyEntry = await History.findOne(new ObjectId(historyID))
    .populate('media.media');

  if (!historyEntry || !historyEntry.user) {
    return null;
  }

  const stats = await Promise.props({
    upvotes: uw.redis.lrange('booth:upvotes', 0, -1),
    downvotes: uw.redis.lrange('booth:downvotes', 0, -1),
    favorites: uw.redis.lrange('booth:favorites', 0, -1)
  });

  return {
    historyID,
    playlistID: `${historyEntry.playlist}`,
    played: Date.parse(historyEntry.played),
    userID: `${historyEntry.user}`,
    media: historyEntry.media,
    stats
  };
}

export function skipBooth(uw, moderatorID, userID, reason) {
  uw.redis.publish('v1', createCommand('skip', { moderatorID, userID, reason }));
  uw.redis.publish('v1p', createCommand('advance', null));
}

export async function replaceBooth(uw, moderatorID, id) {
  let waitlist = await uw.redis.lrange('waitlist', 0, -1);

  if (!waitlist.length) throw new GenericError(404, 'waitlist is empty');

  if (waitlist.some(userID => userID === id)) {
    uw.redis.lrem('waitlist', 1, id);
    await uw.redis.lpush('waitlist', id);
    waitlist = await uw.redis.lrange('waitlist', 0, -1);
  }

  uw.redis.publish('v1', createCommand('boothReplace', {
    moderatorID,
    userID: id
  }));
  uw.redis.publish('v1p', createCommand('advance', null));
  return waitlist;
}

export async function favorite(uw, id, playlistID, historyID) {
  const Playlist = uw.mongo.model('Playlist');
  const History = uw.mongo.model('History');

  const historyEntry = await History.findOne(new ObjectId(historyID));

  if (!historyEntry) {
    throw new GenericError(404, `history entry with ID ${historyID} not found`);
  }
  if (`${historyEntry.user}` === id) {
    throw new GenericError(403, 'you can\'t grab your own song');
  }

  const playlistItem = `${historyEntry.item}`;
  const playlist = Playlist.findOne(new ObjectId(playlistID));

  if (!playlist) throw new GenericError(404, `Playlist with ID ${playlistID} not found`);
  if (playlist.author + '' !== id) {
    throw new GenericError(403, 'you are not allowed to edit playlists of other users');
  }

  playlist.media.push(playlistItem);

  uw.redis.lrem('booth:favorites', 0, id);
  uw.redis.lpush('booth:favorites', id);
  uw.redis.publish('v1', createCommand('favorite', {
    userID: id,
    playlistID
  }));

  return await playlist.save();
}

export async function getHistory(uw, page, limit) {
  const History = uw.mongo.model('History');

  const _page = !isNaN(page) ? page : 0;
  const _limit = !isNaN(limit) ? limit : 25;

  const history = await History.find({})
    .skip(_page * _limit)
    .limit(_limit)
    .sort({ played: -1 })
    .populate('media.media user');

  return paginate(_page, _limit, history);
}
