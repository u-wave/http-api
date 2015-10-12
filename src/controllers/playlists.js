import mongoose from 'mongoose';
import Promise from 'bluebird';
import debug from 'debug';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';
import { fetchMedia } from './search';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:playlists');

const addMedia = function addMedia(sourceType, sourceID, keys, Media) {
  return fetchMedia(sourceType, sourceID, keys)
  .then(media => {
    return new Media(media).save();
  });
};

export const getPlaylists = function getPlaylists(page, limit, id, mongo) {
  const Playlist = mongo.model('Playlist');

  const _page = (page === NaN ? 0 : page);
  const _limit = (limit === NaN ? 50 : Math.ceil(limit, 50));

  return Playlist.find({'author': id}).setOptions({ 'limit': _limit, 'skip': _limit * _page });
};

export const createPlaylist = function createPlaylist(data, mediaArray, mongo) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');

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
      new PlaylistItem(mediaArray[i]).save();
    }
  });
};

export const getPlaylist = function getPlaylist(page, limit, id, playlistID, populate, mongo) {
  const Playlist = mongo.model('Playlist');
  const _page = (page === NaN ? 0 : page);
  const _limit = (limit === NaN ? 100 : Math.min(limit, 100));

  return (
    !populate ?
    Playlist.findOne(ObjectId(playlistID)) :
    Playlist.findOne(ObjectId(playlistID), { 'media': { '$slice': [_limit * _page, _limit] }}).populate('media')
  )
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'this playlist is private');
    }

    return playlist.populate('media');
  });
};

export const deletePlaylist = function deletePlaylist(id, playlistID, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  let _active = null;

  return uwave.redis.get(`playlist:${id}`)
  .then(active => {
    _active = active;
    return Playlist.findOne(ObjectId(playlistID));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t delete the playlist of another user');
    }
    if (_active && _active === playlist.id) {
      throw new GenericError(403, 'you can\'t delete an active playlist');
    }

    return playlist.remove();
  });
};

export const renamePlaylist = function renamePlaylist(id, playlistID, name, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t rename the playlist of another user');
    }

    playlist.name = name;
    return playlist.save();
  });
};

export const sharePlaylist = function sharePlaylist(id, playlistID, shared, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t share the playlist of another user');
    }

    playlist.shared = shared;
    return playlist.save();
  });
};

export const movePlaylistItems = function movePlaylistItems(id, playlistID, after, items, mongo) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');
  let pos = -1;

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t edit the playlist of another user');
    }

    const _items = [];

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      const _id = playlist.media[i].toString();

      for (let j = items.length - 1; j >= 0; j--) {
        if (_id === items[j]) {
          _items.push(playlist.media.splice(i, 1)[0]);
          items.splice(j, 1);
          break;
        }
      }
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].toString() === after) {
        pos = i;
        break;
      }
    }

    playlist.media.splice(pos + 1, 0, ..._items);
    return playlist.save();
  });
};

export const activatePlaylist = function activatePlaylist(id, playlistID, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  return Playlist.findOne(ObjectId(playlistID)).populate('author')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.id && playlist.shared) {
      throw new GenericError(403, `${playlist.author.username} has made ${playlist.name} private`);
    }

    uwave.redis.set(`playlist:${id}`, playlist.id);
    return uwave.redis.get(`playlist:${id}`);
  });
};

export const createPlaylistItem = function createPlaylistItem(id, playlistID, items, uwave) {
  const PlaylistItem = uwave.mongo.model('PlaylistItem');
  const Playlist = uwave.mongo.model('Playlist');
  const Media = uwave.mongo.model('Media');

  const _items = [];

  const _addMedia = function(sourceType, sourceID) {
    let _playlistItem = null;

    return Media.findOne({ 'sourceType': sourceType, 'sourceID': sourceID })
    .then(media => {
      if (!media) {
        return addMedia(sourceType, sourceID, uwave.keys, Media);
      } else {
        return media;
      }
    })
    .then(media => {
      _playlistItem = new PlaylistItem({
        'media': media.id,
        'artist': media.artist,
        'title': media.title
      });

      return _playlistItem.save();
    })
    .then(playlistItem => {
      if (!playlistItem) throw new Error('couldn\'t save media');

      return playlistItem.id;
    }, e => {
      if (_playlistItem) _playlistItem.remove();
      throw e;
    });
  };

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (playlist.author.toString() !== id) throw new GenericError(403, 'you can\'t edit the playlist of another user');

    for (let i = 0, l = items.length; i < l; i++) {
      if (typeof items[i] !== 'object') continue;
      if (typeof items[i].sourceType !== 'string' || typeof items[i].sourceID !== 'string') continue;

      _items.push(_addMedia(items[i].sourceType, items[i].sourceID));
    }

    return Promise.all(_items)
    .then(playlistItems => {
      playlist.media = playlist.media.concat(playlistItems);
      return playlist.save();
    });
  });
};

export const getPlaylistItem = function getPlaylistItem(id, playlistID, mediaID, mongo) {
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(playlistID)).populate('media')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'this playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].id === mediaID) {
        return playlist.media[i];
      }
    }
    throw new GenericError(404, 'media not found');
  });
};

export const updatePlaylistItem = function updatePlaylistItem(id, playlistID, mediaID, metadata, mongo) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString() && playlist.shared) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].toString() === mediaID) {
        return PlaylistItem.findOneAndUpdate(playlist.media[i], metadata, { 'new': true });
      }
    }

    throw new GenericError(404, 'media not found');
  });
};

export const deletePlaylistItem = function deletePlaylistItem(id, playlistID, mediaID, mongo) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');

  return Playlist.findOne(ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${id} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'playlist is private');
    }

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlist.media[i].toString() === mediaID) {
        PlaylistItem.findOneAndRemove(playlist.media[i]);

        playlist.media.splice(i, 1);
        return playlist.save();
      }
    }

    throw new GenericError(404, 'media not found');
  });
};

export const copyPlaylistItem = function copyPlaylistItem(id, fromPlaylistID, mediaID, toPlaylistID, mongo) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');

  let _playlistItem = null;

  return Playlist.findOne(ObjectId(fromPlaylistID)).populate('media')
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'originating playlist not found');
    if (playlist.author.toString() !== id && !playlist.shared) throw new GenericError(403, 'originating playlist is private');

    for (let i = playlist.media.length - 1; i >= 0; i--) {
      if (playlists.media[i].id === mediaID) {
        return PlaylistItem.findOne(ObjectId(mediaID), '-id');
      }
    }
  })
  .then(playlistItem => {
    return new PlaylistItem(playlistItem);
  })
  .then(playlistItem => {
    _playlistItem = playlistItem;
    return Playlist.findOne(ObjectId(toPlaylistID));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not found');
    if (!playlist.author.toString() !== id) throw new GenericError(403, 'you can\'t copy media to another user\'s playlist');
    playlist.media.push(_playlistItem.id);
    return playlist.save();
  });
}
