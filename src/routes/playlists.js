import debug from 'debug';
import createRouter from 'router';

import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import { serializePlaylist } from '../utils/serialize';
import { HTTPError } from '../errors';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

const log = debug('uwave:api:v1:playlists');

export default function playlistRoutes() {
  const router = createRouter().use(protect());

  router.get('/', (req, res, next) => {
    req.user.getPlaylists()
      .then(playlists => playlists.map(serializePlaylist))
      .then(playlists => toListResponse(playlists, { url: req.fullUrl }))
      .then(list => res.json(list))
      .catch(next);
  });

  router.post('/', checkFields({ name: 'string' }), (req, res, next) => {
    async function activateIfFirst(playlist) {
      try {
        await req.user.getActivePlaylist();
      } catch (e) {
        log(`activating first playlist for ${req.user.id} ${req.user.username}`);
        await req.user.setActivePlaylist(playlist);
      }
      return playlist;
    }

    req.user.createPlaylist({
      name: req.body.name,
      description: req.body.description,
      shared: req.body.shared,
    })
      .then(activateIfFirst)
      .then(serializePlaylist)
      .then(playlist => toItemResponse(playlist, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.get('/:id', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(serializePlaylist)
      .then(playlist => toItemResponse(playlist, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.delete('/:id', (req, res, next) => {
    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.deletePlaylist(playlist))
      .then(toItemResponse)
      .then(result => res.json(result))
      .catch(next);
  });

  const patchableKeys = ['name', 'shared', 'description'];
  router.patch('/:id', (req, res, next) => {
    const patches = Object.keys(req.body);
    for (const patchKey of patches) {
      if (patchableKeys.indexOf(patchKey) === -1) {
        next(new HTTPError(400, `Key "${patchKey}" cannot be updated.`));
        return;
      }
    }

    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, req.body))
      .then(serializePlaylist)
      .then(playlist => toItemResponse(playlist, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/rename', checkFields({ name: 'string' }), (req, res, next) => {
    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, { name: req.body.name }))
      .then(serializePlaylist)
      .then(playlist => toItemResponse(playlist, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/share', checkFields({ shared: 'string' }), (req, res, next) => {
    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, { shared: req.body.shared }))
      .then(serializePlaylist)
      .then(playlist => toItemResponse(playlist, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/move', (req, res, next) => {
    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.moveItems(items, { afterID: after }))
      .then(result => toItemResponse(result))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/activate', (req, res, next) => {
    req.user.setActivePlaylist(req.params.id)
      .then(() => toItemResponse({}))
      .then(item => res.json(item))
      .catch(next);
  });

  router.get('/:id/media', (req, res, next) => {
    const filter = req.query.filter || null;

    const pagination = getOffsetPagination(req.query);

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.getItems(filter, pagination))
      .then(page => toPaginatedResponse(page, {
        baseUrl: req.fullUrl,
        included: {
          media: ['media'],
        },
      }))
      .then(page => res.json(page))
      .catch(next);
  });

  router.post('/:id/media', checkFields({ items: 'object' }), (req, res, next) => {
    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array.'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.addItems(items, { after }))
      .then(({ added, afterID, playlistSize }) => toListResponse(added, {
        included: {
          media: ['media'],
        },
        meta: { afterID, playlistSize },
      }))
      .then(patch => res.json(patch))
      .catch(next);
  });

  router.delete('/:id/media', (req, res, next) => {
    const items = req.query.items || req.body.items;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist =>
        playlist.removeItems(items).then(() => playlist)
      )
      .then(playlist => toItemResponse({}, {
        meta: {
          playlistSize: playlist.size,
        },
      }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.post('/:id/shuffle', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.shuffle())
      .then(() => toItemResponse({}))
      .catch(next);
  });

  router.get('/:id/media/:itemID', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.getItem(req.params.itemID))
      .then(playlistItem => toItemResponse(playlistItem, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/media/:itemID', checkFields({
    artist: 'string',
    title: 'string',
    start: 'number',
    end: 'number',
  }), (req, res, next) => {
    const patch = {
      artist: req.body.artist,
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
    };

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.updateItem(req.params.itemID, patch))
      .then(playlistItem => toItemResponse(playlistItem, { url: req.fullUrl }))
      .then(item => res.json(item))
      .catch(next);
  });

  router.delete('/:id/media/:mediaID', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.removeItem(req.params.mediaID))
      .then(toItemResponse)
      .then(item => res.json(item))
      .catch(next);
  });

  return router;
}
