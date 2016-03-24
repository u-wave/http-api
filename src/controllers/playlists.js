import find from 'array-find';
import findIndex from 'array-findindex';
import mongoose from 'mongoose';
import Promise from 'bluebird';

import { GenericError } from '../errors';
import { paginate } from '../utils';

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

export function createPlaylist(uw, data, mediaArray) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = new Playlist(data);

  return playlist.validate()
  .then(() => {
    if (!mediaArray.length) return playlist.save().then(toPlaylistResponse);

    // TODO save Playlist, too.
    return PlaylistItem.create(mediaArray);
  });
}

export function getPlaylist(uw, id, playlistID) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne({ _id: playlistID, author: id })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not found or private');

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
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t delete the playlist of another user');
    }
    if (_active && _active === playlist.id) {
      throw new GenericError(403, 'you can\'t delete an active playlist');
    }

    return playlist.remove().then(toPlaylistResponse);
  });
}

export function renamePlaylist(uw, id, playlistID, name) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t rename the playlist of another user');
    }

    playlist.name = name;
    return playlist.save().then(toPlaylistResponse);
  });
}

export function sharePlaylist(uw, id, playlistID, shared) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID)).then(playlist => {
    if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t share the playlist of another user');
    }

    playlist.shared = shared;
    return playlist.save().then(toPlaylistResponse);
  });
}

export function getPlaylistItems(uw, page, limit, id, playlistID) {
  const Playlist = uw.model('Playlist');
  const PlaylistItem = uw.model('PlaylistItem');
  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 100 : Math.min(limit, 100);

  return Playlist.findOne(
    { _id: playlistID, author: id },
    { media: { $slice: [_limit * _page, _limit] } }
  )
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not found or private');

    return playlist.media;
  })
  .then(itemIDs => {
    return PlaylistItem.find({ _id: { $in: itemIDs } })
      .populate('media')
      .then(items =>
        // MongoDB returns the playlist items in whichever order it likes, which
        // is usually not the current playlist order. So we need to sort the
        // playlist items according to the itemIDs list here.
        itemIDs.map(itemID => find(items, item => item._id + '' === itemID + ''))
      );
  })
  .then(media => paginate(_page, _limit, media));
}

export function movePlaylistItems(uw, id, playlistID, afterID, movingItems) {
  const Playlist = uw.model('Playlist');

  return Playlist.findOne(new ObjectId(playlistID))
  .then(playlist => {
    if (!playlist) {
      throw new GenericError(404, `playlist with ID ${playlistID} not found`);
    }
    if (id !== playlist.author.toString()) {
      throw new GenericError(403, 'you can\'t edit the playlist of another user');
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

  if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
  if (id !== playlist.author.id && playlist.shared) {
    throw new GenericError(403, `${playlist.author.username} has made ${playlist.name} private`);
  }

  await uw.redis.set(`playlist:${id}`, playlist.id);
  return await uw.redis.get(`playlist:${id}`);
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
      throw new Error('couldn\'t save media');
    }

    return playlistItem;
  };

  const playlist = await Playlist.findOne(new ObjectId(playlistID));
  if (!playlist) {
    throw new GenericError(404, `playlist with ID ${playlistID} not found`);
  }
  if (playlist.author.toString() !== id) {
    throw new GenericError(403, 'you can\'t edit the playlist of another user');
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

  if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
  if (id !== playlist.author.toString() && playlist.shared) {
    throw new GenericError(403, 'this playlist is private');
  }

  const playlistItem = find(playlist.media, item => item.id === mediaID);

  if (!playlistItem) {
    throw new GenericError(404, 'media not found');
  }

  return playlistItem;
}

export async function updatePlaylistItem(uw, id, playlistID, mediaID, metadata) {
  const PlaylistItem = uw.model('PlaylistItem');
  const Playlist = uw.model('Playlist');

  const playlist = await Playlist.findOne(new ObjectId(playlistID));

  if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
  if (id !== playlist.author.toString() && playlist.shared) {
    throw new GenericError(403, 'playlist is private');
  }
  if (playlist.media.indexOf(mediaID) === -1) {
    throw new GenericError(404, 'media not found');
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

  if (!playlist) throw new GenericError(404, `playlist with ID ${playlistID} not found`);
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

  if (!playlist) {
    throw new GenericError(404, 'originating playlist not found');
  }
  if (playlist.author.toString() !== id && !playlist.shared) {
    throw new GenericError(403, 'originating playlist is private');
  }

  if (!playlist.media.some(item => item.id === mediaID)) {
    throw new GenericError(404, 'Playlist item not found');
  }

  const playlistItem = new PlaylistItem(
    await PlaylistItem.findOne(new ObjectId(mediaID), '-id').lean()
  );

  await playlistItem.save();

  const targetPlaylist = await Playlist.findOne(new ObjectId(toPlaylistID));
  if (!targetPlaylist) {
    throw new GenericError(404, 'playlist not found');
  }
  if (!targetPlaylist.author.toString() !== id) {
    throw new GenericError(403, 'you can\'t copy media to another user\'s playlist');
  }

  targetPlaylist.media.push(playlistItem.id);

  return await targetPlaylist.save();
}
