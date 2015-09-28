import mongoose from 'mongoose';
import Promise from 'bluebird';
import debug from 'debug';

import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:playlists');

export const createPlaylist = function createPlaylist(data, mediaArray, mongo) {
  const Playlist = mongo.model('Playlist');
  const Media = mongo.model('Media');

  const playlist = new Playlist(data);

  return playlist.validate()
  .then(() => {
    let pending = mediaArray.length;
    const cb = (err, media) => {
      if (err) {
        playlist.remove();
        throw err;
      }

      pending--;
      playlist.media.push(media.id);
      if (!pending) return playlist.save();
    };

    if (!pending) return playlist.save();

    for (let i = 0, l = mediaArray.length; i < l; i++) {
      const media = new Media(mediaArray[i]);
      media.save(cb);
    }
  });
};

export const getPlaylists = function getPlaylists(user, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.find({'author': user.id});
};

export const getPlaylist = function getPlaylist(user, id, populate, mongo) {
  const Playlist = mongo.model('Playlist');

  return (
    populate ?
    Playlist.findOne(ObjectId(id)) :
    Playlist.findOne(ObjectId(id)).populate('media')
  )
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'this playlist is private');
    }

    return playlist.populate('media');
  });
};

export const deletePlaylist = function deletePlaylist(user, id, token, mongo, redis) {
  const Playlist = mongo.model('Playlist');
  let _active = null;

  return redis.get(`playlist:${user.email}`)
  .then(active => {
    _active = active;
    return Playlist.findOne(ObjectId(id));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t delete the playlist of another user');
    }
    if (_active && _active === playlist.id) {
      throw new GenericError(403, 'you can\'t delete an active playlist');
    }

    return playlist.remove();
  });
};

export const renamePlaylist = function renamePlaylist(user, id, name, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t rename the playlist of another user');
    }

    playlist.name = name;
    return playlist.save();
  });
};

export const sharePlaylist = function sharePlaylist(user, id, shared, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t share the playlist of another user');
    }

    playlist.shared = shared;
    return playlist.save();
  });
};

export const activatePlaylist = function activatePlaylist(user, id, token, mongo, redis) {
  const Playlist = mongo.model('Playlist');
  return Playlist.findOne(ObjectId(id)).populate('author')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.id && playlist.shared) {
      throw new GenericError(403, `${playlist.author.username} has made ${playlist.name} private`);
    }

    redis.set(`playlist:${user.email}`, playlist.id);
    return redis.get(`playlist:${user.email}`);
  });
};

export const createMedia = function createMedia(user, id, data, mongo) {
  const Playlist = mongo.model('Playlist');
  const Media = mongo.model('Media');

  const media = new Media(data);

  return media.save()
  .then(media => {
    return Playlist.findOne(ObjectId(id));
  },
  e => {
    log(e);
    media.remove();
    throw new GenericError(500, 'couldn\'t save media');
  })
  .then(playlist => {
    playlist.media.push(media.id);
    return playlist.save();
  },
  e => {
    log(e);
    media.remove();
    throw new GenericError(500, 'couldn\'t save media');
  });
};

export const getMedia = function getMedia(user, id, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(id)).populate('media')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'this playlist is private');
    }

    return new Promise((resolve, reject) => {
      for (let i = playlist.media.length - 1; i >= 0; i--) {
        if (playlist.media[i].id === mediaID) {
          return resolve(playlist.media[i]);
        }
      }
      reject(new GenericError(404, 'media not found'));
    });
  });
};

export const updateMedia = function updateMedia(user, id, mediaID, metadata, mongo) {
  const Playlist = mongo.model('Playlist');
  const Media = mongo.model('Media');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].toString() === mediaID) {
        return Media.findOneAndUpdate(playlist.media[i], metadata, { 'new': true });
      }
    }

    throw new GenericError(404, 'media not found');
  });
};

export const deleteMedia = function deleteMedia(user, id, mediaID, mongo) {
  const Playlist = mongo.model('Playlist');
  const Media = mongo.model('Media');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.toString()) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].toString() === mediaID) {
        Media.findOneAndRemove(playlist.media[i]);

        playlist.media.splice(i, 1);
        return playlist.save();
      }
    }

    throw new GenericError(404, 'media not found');
  });
};
