import createRouter from 'router';

import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/booth';
import {
  HTTPError,
  PermissionError,
} from '../errors';
import { ROLE_MODERATOR } from '../roles';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export default function boothRoutes() {
  const router = createRouter();

  router.get('/', (req, res, next) => {
    controller.getBooth(req.uwave)
      .then(booth => toItemResponse(booth, { url: req.fullUrl }))
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  router.post('/skip', protect(), (req, res, next) => {
    const skippingSelf = (!req.body.userID && !req.body.reason) ||
      req.body.userID === req.user.id;
    const opts = { remove: !!req.body.remove };

    if (skippingSelf) {
      controller.getCurrentDJ(req.uwave)
        .then((currentDJ) => {
          if (!currentDJ || currentDJ !== req.user.id) {
            throw new HTTPError(412, 'You are not currently playing');
          }

          return controller.skipBooth(req.uwave, null, req.user.id, null, opts);
        })
        .then(() => toItemResponse({}))
        .then(item => res.status(200).json(item))
        .catch(next);
    } else {
      const errors = [];
      if (req.user.role < ROLE_MODERATOR) {
        errors.push(new PermissionError('You need to be a moderator to do this'));
      }
      if (typeof req.body.userID !== 'string') {
        errors.push(new HTTPError(422, 'userID: Expected a string'));
      }
      if (typeof req.body.reason !== 'string') {
        errors.push(new HTTPError(422, 'reason: Expected a string'));
      }
      if (errors.length > 0) {
        next(errors);
        return;
      }

      controller.skipBooth(req.uwave, req.user.id, req.body.userID, req.body.reason, opts)
        .then(() => toItemResponse({}))
        .then(item => res.status(200).json(item))
        .catch(next);
    }
  });

  router.post('/replace',
    protect(ROLE_MODERATOR),
    checkFields({ userID: 'string' }),
    (req, res, next) => {
      controller.replaceBooth(req.uwave, req.user.id, req.body.userID)
        .then(() => toItemResponse({}))
        .then(item => res.status(200).json(item))
        .catch(next);
    },
  );

  router.post('/favorite', protect(), checkFields({
    playlistID: 'string',
    historyID: 'string',
  }), (req, res, next) => {
    controller.favorite(req.uwave, req.user.id, req.body.playlistID, req.body.historyID)
      .then(({ added, playlistSize }) => toListResponse(added, {
        meta: { playlistSize },
      }))
      .then(playlist => res.status(200).json(playlist))
      .catch(next);
  });

  router.get('/history', (req, res, next) => {
    const pagination = getOffsetPagination(req.query, {
      defaultSize: 25,
      maxSize: 100,
    });
    controller.getHistory(req.uwave, pagination)
      .then(history => toPaginatedResponse(history, {
        baseUrl: req.fullUrl,
        included: {
          media: ['media.media'],
          user: ['user'],
        },
      }))
      .then(page => res.json(page))
      .catch(next);
  });

  return router;
}
