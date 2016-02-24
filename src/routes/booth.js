import debug from 'debug';

import * as controller from '../controllers/booth';
import { checkFields } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:booth');

export default function boothRoutes(router) {
  router.get('/booth', (req, res) => {
    controller.getBooth(req.uwave)
    .then(booth => res.status(200).json(booth))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/skip', (req, res) => {
    if (!req.user) {
      return res.status(403).json('you need to be logged in');
    }

    if (Object.keys(req.body).length === 0) {
      controller.getBooth(req.uwave)
      .then(booth => {
        if (!booth || booth.userID !== req.user.id) {
          return res.status(412).json('you are not currently playing');
        }

        controller.skipBooth(req.uwave, null, req.user.id, null)
        .then(skipped => res.status(200).json(skipped))
        .catch(e => handleError(res, e, log));
      })
      .catch(e => handleError(res, e, log));
    } else {
      if (req.user.role < 3) {
        return res.status(412).json('you need to be at least bouncer to do this');
      }

      if (!checkFields(res, req.body, { userID: 'string', reason: 'string' })) {
        return null;
      }

      controller.skipBooth(req.uwave, req.user.id, req.body.userID, req.body.reason)
      .then(skipped => res.status(200).json(skipped))
      .catch(e => handleError(res, e, log));
    }
  });

  router.post('/booth/replace', (req, res) => {
    if (!req.user) {
      return res.status(403).json('you need to be logged in');
    }

    if (req.user.role < 3) {
      return res.status(412).json('you need to be at least bouncer to do this');
    }
    if (typeof req.body.userID === 'undefined') {
      return res.status(422).json('userID is not set');
    }
    if (typeof req.body.userID !== 'string') {
      return res.status(422).json('userID has to be of type string');
    }

    controller.replaceBooth(req.uwave, req.user.id, req.body.userID)
    .then(replaced => res.status(200).json(replaced))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/favorite', (req, res) => {
    if (!req.user) {
      return res.status(403).json('you need to be logged in');
    }

    if (!checkFields(res, req.body, { playlistID: 'string', historyID: 'string' })) {
      return null;
    }

    controller.favorite(req.uwave, req.user.id, req.body.playlistID, req.body.historyID)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.get('/booth/history', (req, res) => {
    const { page, limit } = req.query;
    controller.getHistory(req.uwave, parseInt(page, 10), parseInt(limit, 10))
    .then(history => res.status(200).json(history))
    .catch(e => handleError(res, e, log));
  });
}
