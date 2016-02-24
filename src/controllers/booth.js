import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { paginate } from '../utils';
import { GenericError, PaginateError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export function getBooth(uwave) {
  const History = uwave.mongo.model('History');

  const booth = {
    historyID: null,
    playlistID: null,
    played: 0,
    userID: null,
    media: null,
    stats: {
      upvotes: 0,
      downvotes: 0,
      favorites: 0
    }
  };

  return uwave.redis.get('booth:historyID')
  .then(historyID => {
    booth.historyID = historyID;
    return History.findOne(new ObjectId(historyID))
      .populate('media.media');
  })
  .then(entry => {
    if (entry) {
      booth.userID = entry.user.toString();
      booth.played = Date.parse(entry.played);
      booth.media = entry.media;
    }

    return Promise.props({
      upvotes: uwave.redis.lrange('booth:upvotes', 0, -1),
      downvotes: uwave.redis.lrange('booth:downvotes', 0, -1),
      favorites: uwave.redis.lrange('booth:favorites', 0, -1)
    });
  })
  .then(stats => {
    booth.stats = stats;
    return booth.userID !== null ? booth : null;
  });
}

export function skipBooth(moderatorID, userID, reason, uwave) {
  uwave.redis.publish('v1', createCommand('skip', { moderatorID, userID, reason }));
  uwave.redis.publish('v1p', createCommand('advance', null));
  return Promise.resolve(true);
}

export function replaceBooth(moderatorID, id, uwave) {
  uwave.redis.lrange('waitlist', 0, -1)
  .then(waitlist => {
    if (!waitlist.length) throw new GenericError(404, 'waitlist is empty');

    for (let i = waitlist.length - 1; i >= 0; i--) {
      if (waitlist[i] === id) {
        uwave.redis.lrem('waitlist', 1, id);
        return uwave.redis.lpush('waitlist', id);
      }
    }
  })
  .then(waitlist => {
    uwave.redis.publish('v1', createCommand('boothReplace', {
      moderatorID,
      userID: id
    }));
    uwave.redis.publish('v1p', createCommand('advance', null));
    return waitlist;
  });
}

export function favorite(id, playlistID, historyID, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  const History = uwave.mongo.model('History');

  let playlistItem;

  return History.findOne(new ObjectId(historyID))
  .then(history => {
    if (!history) {
      throw new GenericError(404, `history entry with ID ${historyID} not found`);
    }
    if (history.user.toString() === id) {
      throw new GenericError(403, 'you can\'t grab your own song');
    }

    playlistItem = history.item.toString();
    return Playlist.findOne(new ObjectId(playlistID));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `Playlist with ID ${playlistID} not found`);
    if (playlist.author + '' !== id) {
      throw new GenericError(403, 'you are not allowed to edit playlists of other users');
    }

    playlist.media.push(playlistItem);

    uwave.redis.lrem('booth:favorites', 0, id);
    uwave.redis.lpush('booth:favorites', id);
    uwave.redis.publish('v1', createCommand('favorite', {
      userID: id,
      playlistID
    }));
    return playlist.save();
  });
}

export function getHistory(page, limit, mongo) {
  const History = mongo.model('History');

  const _page = (!isNaN(page) ? page : 0);
  const _limit = (!isNaN(limit) ? limit : 25);

  return History.find({})
    .skip(_page * _limit)
    .limit(_limit)
    .sort({ played: -1 })
    .populate('media.media user')
    .then(history => paginate(_page, _limit, history))
    .catch(e => {
      throw new PaginateError(e);
    });
}
