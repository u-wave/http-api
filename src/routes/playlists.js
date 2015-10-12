import debug from 'debug';

import * as controller from '../controllers/playlists';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:playlists');

export default function playlists(router) {
  router.route('/playlists')
  .get((req, res) => {

    controller.getPlaylists(parseInt(req.query.page, 10), parseInt(req.query.limit, 10), req.user.id, req.uwave.mongo)
    .then(playlists => res.status(200).json(playlists))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (!checkFields(req.body, res, [
      'name',
      'description',
      'shared'
    ], [
      'string',
      'string',
      'boolean'
    ])) return;

    const data = {
      'name': req.body.name,
      'description': req.body.description,
      'shared': req.body.shared,
      'author': req.user.id
    };

    controller.createPlaylist(data, [], req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id')
  .get((req, res) => {
    controller.getPlaylist(req.user.id, req.params.id, false, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.deletePlaylist(req.user.id, req.params.id, req.uwave)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/rename', (req, res) => {
    if (!req.body.name) return res.status(422).json('name is not set');
    if (typeof req.body.name !== 'string') return res.status(422).json('name has to be of type string');

    controller.renamePlaylist(req.user.id, req.params.id, req.body.name, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/share', (req, res) => {
    if (typeof req.body.share === 'undefined') return res.status(422).json('share is not set');
    if (typeof req.body.share !== 'boolean') return res.status(422).json('share has to be of type boolean');

    controller.sharePlaylist(req.user.id, req.params.id, req.body.share, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/move', (req, res) => {
    if (!checkFields(req.body, res, ['items', 'after']))
    if (!Array.isArray(req.body.items)) return res.status(422).json('items has to be an array');

    controller.movePlaylistItems(req.user.id, req.params.id, req.body.after, req.body.items, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/activate', (req, res) => {
    controller.activatePlaylist(req.user.id, req.params.id, req.uwave)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media')
  .get((req, res) => {
    controller.getPlaylist(parseInt(req.query.page, 10), parseInt(req.query.limit, 10), req.user.id, req.params.id, true, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist.media))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (!req.body.items) return res.status(422).json('items is not set');
    if (!Array.isArray(req.body.items)) return res.status(422).json('items has to be an array');

    controller.createPlaylistItem(req.user.id, req.params.id, req.body.items, req.uwave)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media/:mediaID')
  .get((req, res) => {
    controller.getPlaylistItem(req.user.id, req.params.id, req.params.mediaID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .put((req, res) => {
    if (!checkFields(req.body, res, [
      'artist',
      'title',
      'start',
      'end'
    ], [
      'string',
      'string',
      'number',
      'number'
    ])) return;

    const metadata = {
      'artist': req.body.name,
      'title': req.body.title,
      'start': req.body.start,
      'end': req.body.end
    };

    controller.updatePlaylistItem(req.user.id, req.params.id, req.params.mediaID, metadata, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.deletePlaylistItem(req.user.id, req.params.id, req.params.mediaID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.post('/playlists/:id/media/:mediaID/copy', (req, res) => {
    if (!checkFields(req.body, res, ['toPlaylistID'], 'string')) return;

    controller.copyPlaylistItem(req.user.id, req.params.id, req.params.mediaID, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });
}
