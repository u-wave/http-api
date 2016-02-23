import debug from 'debug';

import * as controller from '../controllers/users';
import { checkFields } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:users');

export default function userRoutes(router) {
  router.get('/users', (req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }

    const { page, limit } = req.query;

    controller.getUsers(req.uwave, parseInt(page, 10), parseInt(limit, 10))
    .then(users => res.status(200).json(users))
    .catch(e => handleError(res, e, log));
  });

  router.get('/users/:id', (req, res) => {
    controller.getUser(req.uwave, req.params.id)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.route('/users/:id/ban')

  .post((req, res) => {
    if (!checkFields(res, req.body, { time: 'number', exiled: 'boolean' })) {
      return null;
    }
    if (req.user.role < 4) {
      return res.status(403, 'you need to be at least manager to do this');
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
  })

  .delete((req, res) => {
    if (req.user.role < 4) return res.status(403, 'you need to be at least manager to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t unban yourself');

    controller.banUser(req.uwave, req.user.id, req.params.id, 0, false)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.route('/users/:id/mute')

  .post((req, res) => {
    if (typeof req.body.time === 'undefined') return res.status(422).json('time is not set');
    if (req.user.role < 3) return res.status(403, 'you need to be at least bouncer to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t mute yourself');

    if (typeof req.body.time !== 'number' || isNaN(req.body.time)) {
      return res.status(422).json('time is not set');
    }

    controller.muteUser(req.uwave, req.user.id, req.params.id, req.body.time)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    if (req.user.role < 3) return res.status(403, 'you need to be at least bouncer to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t unmute yourself');

    controller.muteUser(req.uwave, req.user.id, req.params.id, 0)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/role', (req, res) => {
    if (typeof req.body.role === 'undefined') return res.status(422).json('role is not set');

    if (typeof req.body.role !== 'number' || isNaN(req.body.role)) {
      return res.status(422).json('role has to be of type number and not NaN');
    }

    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least bouncer to do this');
    }

    if (req.user.role < req.body.role) {
      return res.status(403).json('you can\'t promote users above or equal to your own level');
    }

    controller.changeRole(req.uwave, req.user.id, req.params.id, req.body.role)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/username', (req, res) => {
    if (!req.body.username) return res.status(422).json('username is not set');

    if (typeof req.body.username !== 'string') {
      return res.status(422).json('username has to be of type string');
    }

    if (req.user.id !== req.params.id && req.user.role < 5) {
      return res.status(403).json('you need to be at least cohost to do this');
    }

    controller.changeUsername(req.uwave, req.user.id, req.params.id, req.body.username)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/avatar', (req, res) => {
    if (!req.body.avatar) return res.status(422).json('avatar is not set');

    if (typeof req.body.avatar !== 'string') {
      return res.status(422).json('avatar has to be of type string');
    }

    if (!req.user.id !== req.params.id && req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }

    controller.setAvatar(req.uwave, req.user.id, req.params.id, req.body.avatar)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/status', (req, res) => {
    if (typeof req.body.status === 'undefined') return res.status(422).json('status is not set');

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

  router.get('/users/:id/history', (req, res) => {
    const { page, limit } = req.query;
    controller.getHistory(req.uwave, req.params.id, parseInt(page, 10), parseInt(limit, 10))
    .then(history => res.status(200).json(history))
    .catch(e => handleError(res, e, log));
  });
}
