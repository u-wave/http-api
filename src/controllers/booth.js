import mongoose from 'mongoose';
import Promise from 'bluebird';

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

export const skipBooth = function skipBooth(redis) {
  getBooth(redis)
  .then(booth => {
    // TODO: websocket events
  });
};

export const replaceBooth = function replaceBooth(id, redis) {
  redis.lrange('waitlist')
  .then(waitlist => {
    return new Promise((resolve, reject) => {
      if (waitlist.length === 0) return reject(new GenericError(404, 'waitlist is empty'));

      for (let i = waitlist.length - 1; i >= 0; i--) {
        if (waitlist[i] === id) {
          // TODO: replace dj with user, do the appropiate websocket events
          return resolve(booth);
        }
      }
      reject(new GenericError(404, 'user not found'));
    });
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
