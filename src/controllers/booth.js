import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const getBooth = function getBooth(uwave) {
  const History = uwave.mongo.model('History');

  const booth = {
    'historyID': null,
    'playlistID': null,
    'played': 0,
    'userID': null,
    'media': null,
    'stats': {
      'upvotes': 0,
      'downvotes': 0,
      'favorite': 0
    }
  };

  return uwave.redis.get('booth:historyID')
  .then(historyID => {
    booth.historyID = historyID;
    return History.findOne(ObjectId(historyID)).populate('media')
    .then(entry => {
      if (!entry) return null;
      return History.populate(entry, { 'path': 'media.media', 'model': 'Media' });
    });
  })
  .then(entry => {
    if (entry) {
      booth.userID = entry.user.toString();
      booth.playlistID = entry.playlist.toString();
      booth.played = entry.played;
      booth.media = entry.media;
    }

    return uwave.redis.llen('booth:upvotes');
  })
  .then(upvotes => {
    booth.stats.upvotes = upvotes;
    return uwave.redis.llen('booth:downvotes');
  })
  .then(downvotes => {
    booth.stats.downvotes = downvotes;
    return uwave.redis.llen('booth:favorite');
  })
  .then(favorite => {
    booth.stats.favorite = favorite;
    return (booth.userID !== null ? booth : null);
  });
};

export const skipBooth = function skipBooth(moderatorID, id, reason, uwave) {
  uwave.redis.publish('v1', createCommand('skip', {
    'moderatorID': moderatorID,
    'userID': id,
    'reason': reason
  }));
  uwave.redis.publish('v1p', createCommand('advance', null));
};

export const replaceBooth = function replaceBooth(moderatorID, id, uwave) {
  let next = null;

  uwave.redis.lrange('waitlist')
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
      'moderatorID': moderatorID,
      'userID': id
    }));
    uwave.redis.publish('v1p', createCommand('advance', null));
    return waitlist;
  });
};

export const favorite = function favorite(id, playlistID, historyID, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  const History = uwave.mongo.model('History');
  const User = uwave.mongo.model('User');

  let _mediaID;

  return History.findOne(ObjectId(historyID))
  .then(history => {
    if (!history) throw new GenericError(404, `history entry with ID ${historyID} not found`);
    if (history.user.toString() === id) throw new GenericError(403, 'you can\'t grab your own song');

    _mediaID = history.media.toString();
    return Playlist.findOne(ObjectId(playlistID));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `Playlist with ID ${playlistID} not found`);
    if (playlist.author !== id) {
      throw new GenericError(403, 'you are not allowed to edit playlists of other users');
    }

    playlist.media.push(_mediaID);

    this.redis.lrem('booth:favorite', 0, id);
    this.redis.lpush('booth:favorite', id);
    uwave.redis.publish('v1', createCommand('favorite', {
      'userID': id,
      'playlistID': playlistID
    }));
    return playlist.save();
  });
};
