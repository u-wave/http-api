import debug from 'debug';
import createRouter from 'router';

import * as controller from '../controllers/playlists';
import { checkFields } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:playlists');

export default function playlistRoutes() {
  const router = createRouter();

  router.get('/', (req, res) => {
    const { page, limit } = req.query;
    controller.getPlaylists(req.uwave, parseInt(page, 10), parseInt(limit, 10), req.user.id)
    .then(playlists => res.status(200).json(playlists))
    .catch(e => handleError(res, e, log));
  });

  router.post('/', (req, res) => {
    if (!checkFields(res, req.body, { name: 'string', description: 'string', shared: 'boolean' })) {
      return null;
    }

    const data = {
      name: req.body.name,
      description: req.body.description,
      shared: req.body.shared,
      author: req.user.id
    };

    controller.createPlaylist(req.uwave, data, [])
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.get('/:id', (req, res) => {
    controller.getPlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id', (req, res) => {
    controller.deletePlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/rename', (req, res) => {
    if (!req.body.name) {
      return res.status(422).json('name is not set');
    }
    if (typeof req.body.name !== 'string') {
      return res.status(422).json('name has to be of type string');
    }

    controller.renamePlaylist(req.uwave, req.user.id, req.params.id, req.body.name)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/share', (req, res) => {
    if (typeof req.body.share === 'undefined') {
      return res.status(422).json('share is not set');
    }
    if (typeof req.body.share !== 'boolean') {
      return res.status(422).json('share has to be of type boolean');
    }

    controller.sharePlaylist(req.uwave, req.user.id, req.params.id, req.body.share)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/move', (req, res) => {
    if (!checkFields(res, req.body, { items: 'object' })) {
      return null;
    }

    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(422).json('expected "items" to be an array');
    }

    controller.movePlaylistItems(req.uwave, req.user.id, req.params.id, after, items)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/activate', (req, res) => {
    controller.activatePlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.get('/:id/media', (req, res) => {
    const { page, limit } = req.query;
    controller.getPlaylistItems(
      req.uwave,
      parseInt(page, 10), parseInt(limit, 10),
      req.user.id, req.params.id
    )
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.post('/:id/media', (req, res) => {
    if (!checkFields(res, req.body, { items: 'object' })) {
      return null;
    }
    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(422).json('expected "items" to be an array');
    }

    controller.createPlaylistItems(req.uwave, req.user.id, req.params.id, after, items)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id/media', (req, res) => {
    if (!Array.isArray(req.body.items)) return res.status(422).json('items is not set');

    controller.deletePlaylistItems(req.uwave, req.user.id, req.params.id, req.body.items)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.get('/:id/media/:mediaID', (req, res) => {
    controller.getPlaylistItem(req.uwave, req.user.id, req.params.id, req.params.mediaID)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/media/:mediaID', (req, res) => {
    if (!checkFields(res, req.body, {
      artist: 'string',
      title: 'string',
      start: 'number',
      end: 'number'
    })) {
      return null;
    }

    const { body, params, user } = req;

    const metadata = {
      artist: body.artist,
      title: body.title,
      start: body.start,
      end: body.end
    };

    controller.updatePlaylistItem(req.uwave, user.id, params.id, params.mediaID, metadata)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id/media/:mediaID', (req, res) => {
    const { params, user } = req;
    controller.deletePlaylistItems(req.uwave, user.id, params.id, [params.mediaID])
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.post('/:id/media/:mediaID/copy', (req, res) => {
    if (!checkFields(res, req.body, { toPlaylistID: 'string' })) return;

    controller.copyPlaylistItem(req.uwave, req.user.id, req.params.id, req.params.mediaID)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  return router;
}
