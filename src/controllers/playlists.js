import debug from 'debug';
import escapeRegExp from 'escape-string-regexp';
import find from 'array-find';
import findIndex from 'array-findindex';
import mongoose from 'mongoose';
import Promise from 'bluebird';

import { APIError, NotFoundError, PermissionError } from '../errors';
import { paginate } from '../utils';

const log = debug('uwave:api:v1:playlists');
const ObjectId = mongoose.Types.ObjectId;

async function addMedia(uw, sourceType, sourceID) {
  const Media = uw.model('Media');
  const media = await uw.source(sourceType).getOne(sourceID);
  return await new Media(media).save();
}

const toPlaylistResponse = model => ({
  _id: model.id,
  name: model.name,
  author: model.author,
  created: model.created,
  description: model.description,
  shared: model.shared,
  nsfw: model.nsfw,
  size: model.media.length
});

export function getPlaylists(uw, page, limit, id) {
  const Playlist = uw.model('Playlist');

  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 50 : Math.min(limit, 50);

  return Playlist.find({ author: id })
  .setOptions({ limit: _limit, skip: _limit * _page })
  .exec()
  .then(playlists => playlists.map(toPlaylistResponse));
}

export function getPlaylist(uw, id, playlistID) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne({ _id: playlistID, author: id })
  .then(playlist => {
    if (!playlist) throw new NotFoundError('Playlist not found.');

    return toPlaylistResponse(playlist);
  });
}

export function deletePlaylist(uw, id, playlistID) {
  const Playlist = uw.model('Playlist');
  let _active = null;

  return uw.redis.get(`playlist:${id}`)
  .then(active => {
    _active = active;
    return Playlist.findOne(new ObjectId(playlistID));
  })
  .then(playlist => {
    if (!playlist) throw new NotFoundError('Playlist not found.');
    if (id !== playlist.author.toString()) {
      throw new PermissionError('You can\'t delete another user\'s playlist.');
    }
    if (_active && _active === playlist.id) {
      throw new PermissionError('You can\'t delete your active playlist.');
    }

    return playlist.remove().then(toPlaylistResponse);
  });
}

export function renamePlaylist(uw, id, playlistID, name) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new NotFoundError('Playlist not found.');
    if (id !== playlist.author.toString()) {
      throw new PermissionError('You can\'t edit another user\'s playlist.');
    }

    playlist.name = name;
    return playlist.save().then(toPlaylistResponse);
  });
}

export function sharePlaylist(uw, id, playlistID, shared) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID)).then(playlist => {
    if (!playlist) throw new NotFoundError('Playlist not found.');
    if (id !== playlist.author.toString()) {
      throw new PermissionError('You can\'t edit another user\'s playlist.');
    }

    playlist.shared = shared;
    return playlist.save().then(toPlaylistResponse);
  });
}

export function getPlaylistItems(uw, userID, playlistID, pagination, filter = null) {
  const Playlist = uw.model('Playlist');
  const PlaylistItem = uw.model('PlaylistItem');
  const page = isFinite(pagination.page) ? pagination.page : 0;
  const limit = isFinite(pagination.limit) && pagination.limit < 100
    ? pagination.limit
    : 100;

  return Playlist.findOne(
    { _id: playlistID, author: userID },
    { media: { $slice: [limit * page, limit] } }
  )
  .then(playlist => {
    if (!playlist) throw new NotFoundError('Playlist not found.');

    return playlist.media;
  })
  .then(itemIDs => {
    const query = { _id: { $in: itemIDs } };
    if (filter) {
      const rx = escapeRegExp(filter);
      query.$or = [
        { artist: RegExp(rx, 'i') },
        { title: RegExp(rx, 'i') }
      ];
    }
    return PlaylistItem.find(query)
      .populate('media')
      .then(items =>
        // MongoDB returns the playlist items in whichever order it likes, which
        // is usually not the current playlist order. So we need to sort the
        // playlist items according to the itemIDs list here.
        itemIDs
          .map(itemID => find(items, item => item._id + '' === itemID + ''))
          .filter(Boolean)
      );
  })
  .then(media => paginate(page, limit, media));
}

export function movePlaylistItems(uw, id, playlistID, afterID, movingItems) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) {
      throw new NotFoundError('Playlist not found');
    }
    if (id !== playlist.author.toString()) {
      throw new PermissionError('You can\'t edit another user\'s playlist.');
    }

    const newMedia = playlist.media.filter(item =>
      movingItems.indexOf(`${item}`) === -1
    );
    const insertIndex = findIndex(newMedia, item => `${item}` === afterID);
    newMedia.splice(insertIndex + 1, 0, ...movingItems);
    playlist.media = newMedia;

    return playlist.save();
  });
}

export async function activatePlaylist(uw, id, playlistID) {
  const Playlist = uw.model('Playlist');
  const playlist = await Playlist.findOne(new ObjectId(playlistID)).populate('author');

  if (!playlist) throw new NotFoundError('Playlist not found.');
  if (id !== playlist.author.id && !playlist.shared) {
    throw new PermissionError('You can\'t activate another user\'s playlist.');
  }

  await uw.redis.set(`playlist:${id}`, playlist.id);
  return await uw.redis.get(`playlist:${id}`);
}

export function createPlaylist(uw, data, mediaArray) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = new Playlist(data);

  return playlist.validate()
  .then(() => {
    if (!mediaArray.length) {
      return Playlist.count({ author: data.author })
      .then(count => {
        return playlist.save()
        .then(_playlist => {
          if (!count) {
            log(`activating first playlist for ${_playlist.author}`);
            activatePlaylist(uw, `${_playlist.author}`, _playlist.id);
          }

          return _playlist;
        })
        .then(toPlaylistResponse);
      });
    }

    // TODO save Playlist, too.
    return PlaylistItem.create(mediaArray);
  });
}

function isValidPlaylistItem(item) {
  return typeof item === 'object' &&
    typeof item.sourceType === 'string' &&
    (typeof item.sourceID === 'string' || typeof item.sourceID === 'number');
}

export async function createPlaylistItems(uw, id, playlistID, after, items) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');
  const Media = uw.model('Media');

  const createItem = async props => {
    const { sourceType, sourceID, artist, title } = props;
    let { start, end } = props;

    let media = await Media.findOne({ sourceType, sourceID });
    if (!media) {
      media = await addMedia(uw, sourceType, sourceID);
    }

    // Fix up custom start/end times
    if (!start || start < 0) {
      start = 0;
    } else if (start > media.duration) {
      start = media.duration;
    }
    if (!end || end > media.duration) {
      end = media.duration;
    } else if (end < start) {
      end = start;
    }

    const playlistItem = new PlaylistItem({
      media,
      artist: artist || media.artist,
      title: title || media.title,
      start, end
    });

    try {
      await playlistItem.save();
    } catch (e) {
      throw new APIError('Could not save playlist items. Please try again later.');
    }

    return playlistItem;
  };

  const playlist = await Playlist.findOne(new ObjectId(playlistID));
  if (!playlist) {
    throw new NotFoundError('Playlist not found.');
  }
  if (playlist.author.toString() !== id) {
    throw new PermissionError('You can\'t edit another user\'s playlist.');
  }

  const addingItems = items.filter(isValidPlaylistItem).map(createItem);

  const playlistItems = await Promise.all(addingItems);
  const insertIndex = findIndex(playlist.media, item => `${item}` === after);
  playlist.media.splice(insertIndex + 1, 0, ...playlistItems);

  await playlist.save();

  return {
    added: playlistItems,
    playlistSize: playlist.media.length
  };
}

export async function getPlaylistItem(uw, id, playlistID, mediaID) {
  const Playlist = uw.model('Playlist');

  const playlist = await Playlist.findOne(new ObjectId(playlistID)).populate('media');

  if (!playlist) throw new NotFoundError('Playlist not found.');
  if (id !== playlist.author.toString() && playlist.shared) {
    throw new PermissionError('You can\'t acccess another user\'s playlist.');
  }

  const playlistItem = find(playlist.media, item => item.id === mediaID);

  if (!playlistItem) {
    throw new NotFoundError('Playlist item not found.');
  }

  return playlistItem;
}

export async function updatePlaylistItem(uw, id, playlistID, mediaID, metadata) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = await Playlist.findOne(new ObjectId(playlistID));

  if (!playlist) throw new NotFoundError('Playlist not found.');
  if (id !== playlist.author.toString() && playlist.shared) {
    throw new PermissionError('You can\'t edit another user\'s playlist.');
  }
  if (playlist.media.indexOf(mediaID) === -1) {
    throw new NotFoundError(
      'That playlist item does not seem to exist. ' +
      'Please reload your playlist and try again.'
    );
  }

  return await PlaylistItem.findOneAndUpdate({ _id: mediaID }, metadata, { new: true });
}

export async function deletePlaylistItems(uw, id, playlistID, items) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = await Playlist.findOneAndUpdate(
    { _id: playlistID, author: id },
    { $pullAll: { media: items } },
    { new: true }
  );

  if (!playlist) throw new NotFoundError('Playlist not found.');
  // return full PlaylistItem object to keep consitency with addMedia route
  const mediaItems = await PlaylistItem.find({ _id: { $in: items } }).populate('media');

  await PlaylistItem.remove({ _id: { $in: items } });

  return {
    removed: mediaItems,
    playlistSize: playlist.media.length
  };
}

export async function copyPlaylistItem(uw, id, fromPlaylistID, mediaID, toPlaylistID) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = await Playlist.findOne(new ObjectId(fromPlaylistID)).populate('media');

  if (!playlist || (playlist.author.toString() !== id && !playlist.shared)) {
    throw new NotFoundError('Originating playlist not found.');
  }

  if (!playlist.media.some(item => item.id === mediaID)) {
    throw new NotFoundError('Playlist item not found.');
  }

  const playlistItem = new PlaylistItem(
    await PlaylistItem.findOne(new ObjectId(mediaID), '-id').lean()
  );

  await playlistItem.save();

  const targetPlaylist = await Playlist.findOne(new ObjectId(toPlaylistID));
  if (!targetPlaylist) {
    throw new NotFoundError('Target playlist not found.');
  }
  if (!targetPlaylist.author.toString() !== id) {
    throw new PermissionError('You can\'t edit another user\'s playlist.');
  }

  targetPlaylist.media.push(playlistItem.id);

  return await targetPlaylist.save();
}
