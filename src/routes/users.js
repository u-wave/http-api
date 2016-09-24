import createRouter from 'router';

import protect from '../middleware/protect';
import rateLimit from '../middleware/rateLimit';
import * as controller from '../controllers/users';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';
import { HTTPError, NotFoundError, PermissionError } from '../errors';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';
import getOffsetPagination from '../utils/getOffsetPagination';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export default function userRoutes() {
  const router = createRouter();

  router.get('/', protect(ROLE_MANAGER), (req, res, next) => {
    const limit = isFinite(req.query.limit) ? Math.min(req.query.limit, 50) : 50;
    const offset = isFinite(req.query.page) ? limit * req.query.page : 0;

    req.uwave.getUsers({ offset, limit })
      .then(users => res.json(users))
      .catch(next);
  });

  router.get('/:id', (req, res, next) => {
    req.uwave.getUser(req.params.id)
      .then(user => res.json(user))
      .catch(next);
  });

  router.post('/:id/mute', protect(ROLE_MODERATOR), (req, res, next) => {
    if (typeof req.body.time !== 'number' || !isFinite(req.body.time)) {
      next(new HTTPError(400, 'Expected "time" to be a number.'));
      return;
    }
    if (req.user.id === req.params.id) {
      next(new PermissionError('You can\'t mute yourself.'));
      return;
    }

    const duration = req.body.time;
    req.uwave.getUser(req.params.id)
      .then((user) => {
        if (!user) throw new NotFoundError('User not found.');
        return user.mute(duration, { moderator: req.user });
      })
      .then(() => res.json({}))
      .catch(next);
  });

  router.delete('/:id/mute', protect(ROLE_MODERATOR), (req, res, next) => {
    if (req.user.id === req.params.id) {
      next(new PermissionError('You can\'t unmute yourself.'));
      return;
    }

    req.uwave.getUser(req.params.id)
      .then((user) => {
        if (!user) throw new NotFoundError('User not found.');
        return user.unmute({ moderator: req.user });
      })
      .then(() => res.json({}))
      .catch(next);
  });

  router.put('/:id/role', protect(ROLE_MANAGER), (req, res, next) => {
    if (typeof req.body.role !== 'number' || !isFinite(req.body.role)) {
      next(new HTTPError(400, 'Expected "role" to be a number.'));
      return;
    }
    if (req.user.role < req.body.role) {
      next(new PermissionError('You can\'t promote users above your rank.'));
      return;
    }

    req.uwave.updateUser(
      req.params.id,
      { role: req.body.role },
      { moderator: req.user }
    )
      .then(user => res.json(user))
      .catch(next);
  });

  router.put('/:id/username',
    rateLimit('change-username', {
      max: 5,
      duration: 60 * 60 * 1000,
      error: (_, retryAfter) =>
        `You can only change your username five times per hour. Try again in ${retryAfter}.`,
    }),
    (req, res, next) => {
      if (typeof req.body.username !== 'string') {
        next(new HTTPError(400, 'Expected "username" to be a string'));
        return;
      }

      req.uwave.updateUser(
        req.params.id,
        { username: req.body.username },
        { moderator: req.user }
      )
        .then(user => res.json(user))
        .catch(error => next(beautifyDuplicateKeyError(error)));
    }
  );

  router.put('/:id/avatar', (req, res, next) => {
    if (!req.body.avatar) {
      res.status(422).json('avatar is not set');
      return;
    }

    if (typeof req.body.avatar !== 'string') {
      res.status(422).json('avatar has to be of type string');
      return;
    }

    if (!req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
      res.status(403).json('you need to be a manager to do this');
      return;
    }

    controller.setAvatar(req.uwave, req.user.id, req.params.id, req.body.avatar)
      .then(user => res.json(user))
      .catch(next);
  });

  router.put('/:id/status', (req, res, next) => {
    if (typeof req.body.status === 'undefined') {
      res.status(422).json('status is not set');
      return;
    }

    if (typeof req.body.status !== 'number' || !isFinite(req.body.status)) {
      res.status(422).json('status has to be a number');
      return;
    }

    if (req.user.id !== req.params.id) {
      res.status(403).json('you can\'t change the status of another user');
      return;
    }

    controller.setStatus(req.uwave, req.user.id, req.body.status)
      .then(user => res.json(user))
      .catch(next);
  });

  router.get('/:id/history', (req, res, next) => {
    const pagination = getOffsetPagination(req.query, {
      defaultSize: 25,
      maxSize: 100,
    });
    controller.getHistory(req.uwave, req.params.id, pagination)
      .then(history => toPaginatedResponse(history, {
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
