import debug from 'debug';

import * as controller from '../controllers/users';
import { checkFields, handleDuplicate } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:users');

export default function users(router) {
  router.get('/users/:id', (req, res) => {
    controller.getUser(req.params.id, req.uwave.mongo)
    .then(users => res.status(200).json(users))
    .catch(e => handleError(res, e, log));
  });

  router.route('/users/:id/ban')

  .post((req, res) => {
    if (!checkFields(req.body, res, ['time', 'exiled'])) return;
    if (req.user.role < 4) return res.status(403, 'you need to be at least manager to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t ban yourself');

    controller.banUser(req.params.id, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    if (req.user.role < 4) return res.status(403, 'you need to be at least manager to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t unban yourself');

    controller.banUser(req.params.id, 0, false, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.route('/users/:id/mute')

  .post((req, res) => {
    if (!req.body.time) return res.status(422).json('time is not set');
    if (req.user.role < 3) return res.status(403, 'you need to be at least bouncer to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t mute yourself');

    controller.muteUser(req.params.id, req.body.time, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    if (!req.body.time) return res.status(422).json('time is not set');
    if (req.user.role < 3) return res.status(403, 'you need to be at least bouncer to do this');
    if (req.user.id === req.params.id) return res.status(403, 'you can\'t mute yourself');

    controller.muteUser(req.params.id, 0, req.body.time, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/role', (req, res) => {
    if (typeof req.body.role === 'undefined') return res.status(422).json('role is not set');
    if (req.user.role < 3) return res.status(403).json('you need to be at least bouncer to do this');

    _role = parseInt(req.body.role, 10);

    if (req.user.role < _role) return res.status(403).json('you can\'t promote users above your own level');

    controller.changeRole(req.user, req.params.id, _role, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.put('/users/:id/username', (req, res) => {
    if (!req.body.username) return res.status(422).json('username is not set');
    if (req.user.id !== req.params.id && req.user.role < 5) return res.status(403).json('you need to be at least cohost to do this');

    const _username = String(req.body.username);
    controller.changeUsername(req.user, req.params.id, _username, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  /*
  router.put('/users/:id/avatar', (req, res) => {

  });
  */

  router.put('/users/:id/status', (req, res) => {
    if (typeof req.body.status === 'undefined') return res.status(422).json('status is not set');

    const _status = Number(req.body.status);
    controller.setStatus(req.user, _status, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });
}
