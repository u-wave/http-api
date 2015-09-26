import mongoose from 'mongoose';
import Promise from 'bluebird';

import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;

export const createPlaylist = function createPlaylist(data, user, mediaArray) {
  const Playlist = mongoose.model('Playlist');
  const Media = mongoose.model('Media');

  const playlist = new Playlist(data);

  return playlist.validate()
  .then(playlist => {
    let pending = mediaArray.length;
    const cb = (err, media) {
      if (err) {
        playlist.remove();
        throw new GenericError(500, 'database error');
      }

      pending--;
      playlist.media.push(media.id);
      if (!pending) {
        return playlist.save();
    };

    if (!pending) return playlist.save();

    for (let i = 0, l = mediaArray.length; i < l; i++) {
      const media = new Media(mediaArray[i]);
      media.save(cb);
    }
  });
};

export const getPlaylists = function getPlaylists(user) {
  const Playlist = mongoose.model('Playlist');

  return Playlist.find({'author': ObjectId(user.id)});
};

export const getPlaylist = function getPlaylist(user, id, populate = false) {
  const Playlist = mongoose.model('Playlist');

  return (
    populate ?
    Playlist.findOne(ObjectId(id)) :
    Playlist.findOne(ObjectId(id)).populate('media')
  )
  .then(playlist => {
    if (user.id !== playlist.author && playlist.private) {
      throw new GenericError(403, 'this playlist is private');
    }

    return playlist.populate('media').execPopulate;
  });
};

export const deletePlaylist = function deletePlaylist(user, id, token, redis) {
  const Playlist = mongoose.model('Playlist');
  let _active = null;

  return redis.hget(`user:${token}`, 'activePlaylist')
  .then(active => {
    _active = active;
    return Playlist.findOne(ObjectId(id));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author) {
      throw new GenericError(403, 'you can\'t delete the playlist of another user');
    }
    if (_active && _active === playlist.id) {
      throw new GenericError(403, 'you can\'t delete an active playlist');
    }

    return playlist.remove();
  });
};

export const renamePlaylist = function renamePlaylist(name, user, id) {
  const Playlist = mongoose.model('Playlist');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author) {
      throw new GenericError(403, 'you can\'t rename the playlist of another user');
    }

    playlist.name = name;
    return playlist.save();
  });
};

export const sharePlaylist = function sharePlaylist(user, id, private) {
  const Playlist = mongoose.model('Playlist');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author) {
      throw new GenericError(403, 'you can\'t share the playlist of another user');
    }

    playlist.private = private;
    return playlist.save();
  });
};

export const activatePlaylist = function activatePlaylist(user, id, token, redis) {
  const Playlist = mongoose.model('Playlist');

  return Playlist.findOne(ObjectId(id)).populate('author')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author.id && playlist.private) {
      throw new GenericError(403, `${playlist.author.username} has made ${playlist.name} private`);
    }

    redis.hset(`user:${token}`, 'activePlaylist', playlist.id);
    return redis.hget(`user:${token}`, 'activePlaylist');
  });
};

export const createMedia = function createMedia(data, user, id) {
  const Playlist = mongoose.model('Playlist');
  const Media = mongoose.model('Media');

  const media = new Media(data);

  return media.save()
  .then(media => {
    return Playlist.findOne(ObjectId(id));
  },
  e => {
    media.remove()
    throw new GenericError(500, 'couldn\'t save media');
  })
  .then(playlist => {
    playlist.media.push(media.id);
    return playlist.save();
  },
  e => {
    media.remove()
    throw new GenericError(500, 'couldn\'t save media');
  });
};

export const getMedia = function getMedia(user, id, mediaID) {
  const Playlist = mongoose.model('Playlist');

  return Playlist.findOne(ObjectId(id)).populate('media')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author && playlist.private) {
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

export const updateMedia = function updateMedia(metadata, user, id, mediaID) {
  const Playlist = mongoose.model('Playlist');
  const Media = mongoose.model('Media');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author && playlist.private) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i] === mediaID) {
        return Media.findOneAndUpdate(ObjectId(playlist.media[i]), metadata).exec();
      }
    }

    throw new GenericError(404, 'media not found');
  });
};

export const deleteMedia = function deleteMedia(user, id, mediaID) {
  const Playlist = mongoose.model('Playlist');
  const Media = mongoose.model('Media');

  return Playlist.findOne(ObjectId(id))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (user.id !== playlist.author) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].id === mediaID) {
        playlist.media.splice(i, 1);

        Media.findOneAndRemove(ObjectId(playlist.media[i].id));
        return playlist.save();
      }
    }

    throw new GenericError(404, 'media not found');
  });
};
