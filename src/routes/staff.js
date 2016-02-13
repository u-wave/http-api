import debug from 'debug';

import * as controller from '../controllers/staff';
import { checkFields } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:staff');

export default function staffRoutes(router) {
  router.get('/staff/media', (req, res) => {
    const { page, limit } = req.query;
    controller.getAllMedia(parseInt(page, 10), parseInt(limit, 10), req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.route('/staff/media/:id')
  .get((req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      return null;
    }

    controller.getMedia(req.body.sourceType, req.body.sourceID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      return null;
    }

    controller.addMedia(req.body.sourceType, req.body.sourceID, req.uwave.keys, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .put((req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }
    if (!req.body.auto) {
      if (!checkFields(res, req.body, {
        sourceType: 'string',
        sourceID: 'string',
        artist: 'string',
        title: 'string'
      })) {
        return null;
      }

      if (!Array.isArray(req.body.restricted)) {
        res.status(422).json('restricted has to be an array of strings');
      }
    } else if (!checkFields(res, req.body, {
      sourceType: 'string',
      sourceID: 'string',
      auto: 'boolean'
    })) {
      return res.status(422).json(
        'expected sourceType to be a string, sourceID to be a string and auto to be boolean'
      );
    }

    controller.editMedia(req.body, req.uwave.keys, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      return res.status(422).json('expected sourceType to be a string and sourceID to be a string');
    }

    controller.removeMedia(req.body.sourceType, req.body.sourceID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });
}
