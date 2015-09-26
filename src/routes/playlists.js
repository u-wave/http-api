import debug from 'debug';

import * as controller from '../controllers/playlists';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:playlists');

export default function playlists(router) {
  router.route('/playlists')
  .get((req, res) => {

    controller.getPlaylists()
    .then(playlists => res.status(200).json(playlists))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (!checkFields(req.body, res, ['name', 'description', 'private'])) return;

    const data = {
      'name': String(name),
      'description': String(description),
      'private': Boolean(private)
    };

    controller.createPlaylist(data, req.user, [])
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id')
  .get((req, res) => {
    controller.getPlaylist(req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.deletePlaylist(req.user, req.params.id, req.query.token, req.uwave.redis)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/rename', (req, res) => {
    if (!req.body.name) return res.status(422).json('name is not set');

    const _name = String(req.body.name);

    controller.renamePlaylist(_name req.user, req.params.id)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/share', (req, res) => {
    if (!req.body.share) return res.status(422).json('share is not set');

    const _share = Boolean(req.body.share);

    controller.sharePlaylist(req.user, req.params.id, _share)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/playlists/:id/activate', (req, res) => {
    controller.activatePlaylist(req.user, req.params.id, req.query.token, req.uwave.redis)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media')
  .get((req, res) => {
    if (!checkFields(req.body, res, ['playlistID'])) return;

    const _playlistID = String(req.body.playlistID);

    controller.getMedia(req.user, _playlistID, true)
    .then(mediaArray => res.status(200).json(mediaArray))
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

    const _mediaID = String(req.body.mediaID);

    controller.createMedia(data, req.user, req.params.id, _mediaID)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.route('/playlists/:id/media/:mediaID')
  .get((req, res) => {
    controller.getMedia(req.user, req.params.id, req.params.mediaID)
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

    controller.updateMedia(data, req.user, req.params.id, req.params.mediaID)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    controller.getMedia(req.user, req.params.id, req.params.mediaID)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });
}