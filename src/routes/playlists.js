import debug from 'debug';

import * as controller from '../controllers/playlists';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:playlists');

export default function playlists(router) {
  router.route('/playlists')
  .get((req, res) => {

    controller.getPlaylists(req.user, req.uwave.mongo)
    .then(playlists => res.status(200).json(playlists))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (!checkFields(req.body, res, ['name', 'description', 'shared'])) return;

    const data = {
      'name': String(req.body.name),
      'description': String(req.body.description),
      'shared': Boolean(req.body.shared),
      'author': req.user.id
    };

    controller.createPlaylist(data, [], req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id')
  .get((req, res) => {
    controller.getPlaylist(req.user, req.params.id, false, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.deletePlaylist(req.user, req.params.id, req.query.token, req.uwave.mongo, req.uwave.redis)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/rename', (req, res) => {
    if (!req.body.name) return res.status(422).json('name is not set');

    const _name = String(req.body.name);

    controller.renamePlaylist(req.user, req.params.id, _name, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/share', (req, res) => {
    if (!req.body.share) return res.status(422).json('share is not set');

    const _share = Boolean(req.body.share);

    controller.sharePlaylist(req.user, req.params.id, _share, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/activate', (req, res) => {
    controller.activatePlaylist(req.user, req.params.id, req.query.token, req.uwave.mongo, req.uwave.redis)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media')
  .get((req, res) => {
    if (!checkFields(req.body, res, ['playlistID'])) return;

    const _playlistID = String(req.body.playlistID);

    controller.getPlaylist(req.user, _playlistID, true, req.uwave.mongo)
    .then(playlist => res.status(200).json(playlist.media))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (!checkFields(req.body, res, ['id', 'name', 'title', 'start', 'end', 'mediaID'])) return;

    const data = {
      'name': String(req.body.name),
      'title': String(req.body.title),
      'start': Number(req.body.start),
      'end': Number(req.body.end)
    };

    // TODO: add and validate source

    controller.createMedia(req.user, req.params.id, data, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media/:mediaID')
  .get((req, res) => {
    controller.getMedia(req.user, req.params.id, req.params.mediaID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .put((req, res) => {
    if (!checkFields(req.body, res, ['name', 'title', 'start', 'end'])) return;

    const data = {
      'name': String(req.body.name),
      'title': String(req.body.title),
      'start': Number(req.body.start),
      'end': Number(req.body.end)
    };

    controller.updateMedia(req.user, req.params.id, req.params.mediaID, data, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.getMedia(req.user, req.params.id, req.params.mediaID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });
}
