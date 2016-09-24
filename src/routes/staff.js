import createRouter from 'router';

import protect from '../middleware/protect';
import * as controller from '../controllers/staff';
import { checkFields } from '../utils';
import { HTTPError } from '../errors';
import { ROLE_MANAGER } from '../roles';

export default function staffRoutes() {
  const router = createRouter();

  router.get('/media', protect(ROLE_MANAGER), (req, res, next) => {
    const { page, limit } = req.query;
    controller.getAllMedia(req.uwave, parseInt(page, 10), parseInt(limit, 10))
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.get('/media/:id', protect(ROLE_MANAGER), (req, res, next) => {
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      return;
    }

    controller.getMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.post('/media/:id', protect(ROLE_MANAGER), (req, res, next) => {
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      return;
    }

    controller.addMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.put('/media/:id', protect(ROLE_MANAGER), (req, res, next) => {
    if (!req.body.auto) {
      if (!checkFields(res, req.body, {
        sourceType: 'string',
        sourceID: 'string',
        artist: 'string',
        title: 'string',
      })) {
        return;
      }

      if (!Array.isArray(req.body.restricted)) {
        next(new HTTPError(422, 'restricted: Expected an array of strings'));
        return;
      }
    } else if (!checkFields(res, req.body, {
      sourceType: 'string',
      sourceID: 'string',
      auto: 'boolean',
    })) {
      next(new HTTPError(422,
        'expected sourceType to be a string, sourceID to be a string and auto to be boolean'
      ));
      return;
    }

    controller.editMedia(req.uwave, req.body)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.delete('/media/:id', protect(ROLE_MANAGER), (req, res, next) => {
    if (!checkFields(res, req.body, { sourceType: 'string', sourceID: 'string' })) {
      res.status(422).json('expected sourceType to be a string and sourceID to be a string');
      return;
    }

    controller.removeMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  return router;
}
