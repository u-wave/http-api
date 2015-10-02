import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const getBooth = function getBooth(redis) {
  return redis.get('booth')
  .then(booth => {
    return new Promise((resolve, reject) => {
      if (!Object.keys(booth).length) return reject(new GenericError(404, 'booth is empty'));

      resolve(booth);
    });
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
    return new Promise(resolve => resolve(waitlist));
  });
};

export const favorite = function favorite(id, playlistID, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  const User = uwave.mongo.model('User');

  Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `Playlist with ID ${playlistID} not found`);
    if (playlist.author !== id) {
      throw new GenericError(403, 'you are not allowed to edit playlists of other users');
    }

    // TODO: evaluate Media ID
    //playlist.media.push(...);
    uwave.redis.publish('v1', createCommand('favorite', {
      'userID': id,
      'playlistID': playlistID
    }));
    return playlist.save();
  });
};
