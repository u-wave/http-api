import mongoose from 'mongoose';
import Promise from 'bluebird';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';
import advance from '../advance';

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

export const skipBooth = function skipBooth(moderatorID, id, reason, mongo, redis) {
  advance(mongo, redis);
  redis.publish('v1', createCommand('skip', {
    'moderatorID': moderatorID,
    'userID': id,
    'reason': reason
  }));
};

export const replaceBooth = function replaceBooth(moderatorID, id, mongo, redis) {
  let next = null;

  redis.lrange('waitlist')
  .then(waitlist => {
    if (!waitlist.length) throw new GenericError(404, 'waitlist is empty');

    for (let i = waitlist.length - 1; i >= 0; i--) {
      if (waitlist[i] === id) {
        redis.lrem('waitlist', 1, id);
        return redis.lpush('waitlist', id);
      }
    }
  })
  .then(waitlist => {
    advance(mongo, redis);
    redis.publish('v1', createCommand('boothReplace', {
      'moderatorID': moderatorID,
      'userID': id
    }));
    return new Promise(resolve => resolve(waitlist));
  });
};

export const favorite = function favorite(data, mongo, redis) {
  const Playlist = mongo.model('Playlist');
  const User = mongo.model('User');

  Playlist.findOne(ObjectId(data.playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `Playlist with ID ${id} not found`);
    if (playlist.author !== data.user.id) {
      throw new GenericError(403, 'you are not allowed to edit playlists of other users');
    }

    // TODO: evaluate Media ID
    playlist.media.push(data.mediaID);
    return playlist.save();
  });
};
