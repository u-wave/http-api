import debug from 'debug';

import * as controller from '../controllers/playlists';
import { checkFields } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:playlists');

export default function playlistRoutes(router) {
  router.route('/playlists')
  .get((req, res) => {
    const { page, limit } = req.query;
    controller.getPlaylists(req.uwave, parseInt(page, 10), parseInt(limit, 10), req.user.id)
    .then(playlists => res.status(200).json(playlists))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
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

  router.route('/playlists/:id')
  .get((req, res) => {
    controller.getPlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.deletePlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/rename', (req, res) => {
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

  router.put('/playlists/:id/share', (req, res) => {
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

  router.put('/playlists/:id/move', (req, res) => {
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

  router.put('/playlists/:id/activate', (req, res) => {
    controller.activatePlaylist(req.uwave, req.user.id, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media')
  .get((req, res) => {
    const { page, limit } = req.query;
    controller.getPlaylistItems(
      req.uwave,
      parseInt(page, 10), parseInt(limit, 10),
      req.user.id, req.params.id
    )
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
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
  })

  .delete((req, res) => {
    if (!Array.isArray(req.body.items)) return res.status(422).json('items is not set');

    controller.deletePlaylistItems(req.uwave, req.user.id, req.params.id, req.body.items)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media/:mediaID')
  .get((req, res) => {
    controller.getPlaylistItem(req.uwave, req.user.id, req.params.id, req.params.mediaID)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .put((req, res) => {
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
  })

  .delete((req, res) => {
    const { params, user } = req;
    controller.deletePlaylistItems(req.uwave, user.id, params.id, [params.mediaID])
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.post('/playlists/:id/media/:mediaID/copy', (req, res) => {
    if (!checkFields(res, req.body, { toPlaylistID: 'string' })) return;

    controller.copyPlaylistItem(req.uwave, req.user.id, req.params.id, req.params.mediaID)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });
}
