import debug from 'debug';
import createRouter from 'router';

import protect from '../middleware/protect';
import rateLimit from '../middleware/rateLimit';
import * as controller from '../controllers/users';
import { checkFields } from '../utils';
import handleError from '../errors';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

const log = debug('uwave:api:v1:users');

export default function userRoutes() {
  const router = createRouter();

  router.get('/', protect(ROLE_MANAGER), (req, res) => {
    const { page, limit } = req.query;

    controller.getUsers(req.uwave, parseInt(page, 10), parseInt(limit, 10))
    .then(users => res.status(200).json(users))
    .catch(e => handleError(res, e, log));
  });

  router.get('/:id', (req, res) => {
    controller.getUser(req.uwave, req.params.id)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.post('/:id/ban', protect(ROLE_MODERATOR), (req, res) => {
    if (!checkFields(res, req.body, { time: 'number', exiled: 'boolean' })) {
      return null;
    }
    if (req.user.id === req.params.id) {
      return res.status(403, 'you can\'t ban yourself');
    }
    if (isNaN(req.body.time)) {
      return res.status(422).json('time can only be a number');
    }

    controller.banUser(req.uwave, req.user.id, req.params.id, req.body.time, req.body.exiled)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id/ban', protect(ROLE_MANAGER), (req, res) => {
    if (req.user.id === req.params.id) {
      return res.status(403, 'you can\'t unban yourself');
    }

    controller.banUser(req.uwave, req.user.id, req.params.id, 0, false)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.post('/:id/mute', protect(ROLE_MODERATOR), (req, res) => {
    if (typeof req.body.time === 'undefined') {
      return res.status(422).json('time is not set');
    }
    if (req.user.id === req.params.id) {
      return res.status(403).json('you can\'t mute yourself');
    }

    if (typeof req.body.time !== 'number' || isNaN(req.body.time)) {
      return res.status(422).json('time is not set');
    }

    controller.muteUser(req.uwave, req.user.id, req.params.id, req.body.time)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id/mute', protect(ROLE_MODERATOR), (req, res) => {
    if (req.user.id === req.params.id) {
      return res.status(403, 'you can\'t unmute yourself');
    }

    controller.unmuteUser(req.uwave, req.user.id, req.params.id)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/role', protect(ROLE_MANAGER), (req, res) => {
    if (typeof req.body.role !== 'number' || isNaN(req.body.role)) {
      return res.status(422).json('expected role to be a number');
    }

    if (req.user.role < req.body.role) {
      return res.status(403).json('you can\'t promote users above or equal to your own level');
    }

    controller.changeRole(req.uwave, req.user.id, req.params.id, req.body.role)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/username',
    rateLimit('change-username', {
      max: 5,
      duration: 60 * 60 * 1000,
      error: (_, retryAfter) =>
        `You can only change your username five times per hour. Try again in ${retryAfter}.`
    }),
    (req, res, next) => {
      if (!req.body.username) {
        return res.status(422).json('username is not set');
      }

      if (typeof req.body.username !== 'string') {
        return res.status(422).json('username has to be of type string');
      }

      controller.changeUsername(req.uwave, req.user.id, req.params.id, req.body.username)
        .then(user => res.status(200).json(user))
        .catch(err => next(err));
    }
  );

  router.put('/:id/avatar', (req, res) => {
    if (!req.body.avatar) {
      return res.status(422).json('avatar is not set');
    }

    if (typeof req.body.avatar !== 'string') {
      return res.status(422).json('avatar has to be of type string');
    }

    if (!req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
      return res.status(403).json('you need to be a manager to do this');
    }

    controller.setAvatar(req.uwave, req.user.id, req.params.id, req.body.avatar)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/:id/status', (req, res) => {
    if (typeof req.body.status === 'undefined') {
      return res.status(422).json('status is not set');
    }

    if (typeof req.body.status !== 'number' || isNaN(req.body.status)) {
      return res.status(422).json('status has to be a number and not NaN');
    }

    if (req.user.id !== req.params.id) {
      return res.status(403).json('you can\'t change the status of another user');
    }

    controller.setStatus(req.uwave, req.user.id, req.body.status)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.get('/:id/history', (req, res) => {
    const { page, limit } = req.query;
    controller.getHistory(req.uwave, req.params.id, parseInt(page, 10), parseInt(limit, 10))
    .then(history => res.status(200).json(history))
    .catch(e => handleError(res, e, log));
  });

  return router;
}
