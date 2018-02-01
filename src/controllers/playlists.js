import createDebug from 'debug';
import {
  HTTPError,
} from '../errors';
import {
  serializePlaylist,
} from '../utils/serialize';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

const debug = createDebug('uwave:api:v1:playlists');

export async function getPlaylists(req) {
  const playlists = await req.user.getPlaylists();
  return toListResponse(
    playlists.map(serializePlaylist),
    { url: req.fullUrl },
  );
}

export async function getPlaylist(req) {
  const playlist = await req.user.getPlaylist(req.params.id);
  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function createPlaylist(req) {
  const playlist = await req.user.createPlaylist({
    name: req.body.name,
    description: req.body.description,
    shared: req.body.shared,
  });

  try {
    await req.user.getActivePlaylist();
  } catch (e) {
    debug(`activating first playlist for ${req.user.id} ${req.user.username}`);
    await req.user.setActivePlaylist(playlist);
  }

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function deletePlaylist(req) {
  const uw = req.uwave;
  const playlist = await req.user.getPlaylist(req.params.id);

  const result = await uw.playlists.deletePlaylist(playlist);

  return toItemResponse(result, { url: req.fullUrl });
}

const patchableKeys = ['name', 'shared', 'description'];
export async function updatePlaylist(req) {
  const uw = req.uwave;

  const patches = Object.keys(req.body);
  patches.forEach((patchKey) => {
    if (!patchableKeys.includes(patchKey)) {
      throw new HTTPError(400, `Key "${patchKey}" cannot be updated.`);
    }
  });

  const playlist = await req.user.getPlaylist(req.params.id);

  await uw.playlists.updatePlaylist(playlist, req.body);

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function renamePlaylist(req) {
  const uw = req.uwave;
  const playlist = await req.user.getPlaylist(req.params.id);

  await uw.playlists.updatePlaylist(playlist, { name: req.body.name });

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function sharePlaylist(req) {
  const uw = req.uwave;
  const playlist = await req.user.getPlaylist(req.params.id);

  await uw.playlists.updatePlaylist(playlist, { shared: req.body.shared });

  return toItemResponse(
    serializePlaylist(playlist),
    { url: req.fullUrl },
  );
}

export async function activatePlaylist(req) {
  await req.user.setActivePlaylist(req.params.id);

  return toItemResponse({});
}

function getSort(query, defaultSort) {
  if (!query.sort) return null;
  const sort = query.sort.replace(/^-/);
  const direction = query.sort[0] === '-' ? 'desc' : 'asc';
  return { sort, direction };
}
export async function getPlaylistItems(req) {
  const filter = req.query.filter || null;

  const pagination = getOffsetPagination(req.query);
  const sort = getSort(req.query);

  const playlist = await req.user.getPlaylist(req.params.id);
  const items = await playlist.getItems(filter, { ...pagination, ...sort });

  return toPaginatedResponse(items, {
    baseUrl: req.fullUrl,
    included: {
      media: ['media'],
    },
  });
}

export async function addPlaylistItems(req) {
  const { after, items } = req.body;
  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array.');
  }

  const playlist = await req.user.getPlaylist(req.params.id);
  const {
    added,
    afterID,
    playlistSize,
  } = await playlist.addItems(items, { after });

  return toListResponse(added, {
    included: {
      media: ['media'],
    },
    meta: { afterID, playlistSize },
  });
}

export async function removePlaylistItems(req) {
  const items = req.query.items || req.body.items;
  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await req.user.getPlaylist(req.params.id);

  await playlist.removeItems(items);

  return toItemResponse({}, {
    meta: {
      playlistSize: playlist.size,
    },
  });
}

export async function movePlaylistItems(req) {
  const { after, items } = req.body;
  if (!Array.isArray(items)) {
    throw new HTTPError(422, 'Expected "items" to be an array');
  }

  const playlist = await req.user.getPlaylist(req.params.id);

  const result = await playlist.moveItems(items, { afterID: after });
  return toItemResponse(result, { url: req.fullUrl });
}

export async function shufflePlaylistItems(req) {
  const playlist = await req.user.getPlaylist(req.params.id);

  await playlist.shuffle();

  return toItemResponse({});
}

export async function getPlaylistItem(req) {
  const playlist = await req.user.getPlaylist(req.params.id);

  const item = await playlist.getItem(req.params.itemID);

  return toItemResponse(item, { url: req.fullUrl });
}

export async function updatePlaylistItem(req) {
  const patch = {
    artist: req.body.artist,
    title: req.body.title,
    start: req.body.start,
    end: req.body.end,
  };

  const playlist = await req.user.getPlaylist(req.params.id);

  const item = await playlist.updateItem(req.params.itemID, patch);

  return toItemResponse(item, { url: req.fullUrl });
}

export async function removePlaylistItem(req) {
  const playlist = await req.user.getPlaylist(req.params.id);

  const result = await playlist.removeItem(req.params.itemID);

  return toItemResponse(result, { url: req.fullUrl });
}
