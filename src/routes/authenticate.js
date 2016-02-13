import debug from 'debug';

import * as controller from '../controllers/authenticate';
import { checkFields, handleDuplicate } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:auth');
const rx = /\s|%20/;

export default function authenticateRoutes(v1, router) {
  router.get('/auth', (req, res) => {
    controller.getCurrentUser(req.user.id, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  /* ========== REGISTER ========== */
  router.post('/auth/register', (req, res) => {
    if (!checkFields(res, req.body, {
      email: 'string',
      username: 'string',
      password: 'string',
      passwordRepeat: 'string'
    })) {
      return null;
    }

    if (req.body.password !== req.body.passwordRepeat) {
      return res.status(422).json('passwords don\'t match');
    }

    if (rx.test(req.body.username)) {
      return res.status(422).json('username contains invalid characters e.g. space');
    }

    controller.createUser(req.body.email, req.body.username, req.body.password, req.uwave.mongo)
    .then(user => res.status(200).json(user))
    .catch(e => {
      if (!e.errmsg || !handleDuplicate(res, e.errmsg, ['email', 'username'])) {
        handleError(res, e, log);
      }
    });
  });

  /* ========== LOGIN ========== */
  router.post('/auth/login', (req, res) => {
    if (!checkFields(res, req.body, { email: 'string', password: 'string' })) {
      return null;
    }

    controller.login(req.body.email, req.body.password, v1.getCert(), req.uwave)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  /* ========== PASSWORD RESET ========== */
  router.post('/auth/password/reset', (req, res) => {
    if (!checkFields(res, req.body, { email: 'string' })) {
      return null;
    }

    controller.reset(req.body.email, req.uwave)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  /* ========== PASSWORD RESET :RESET ========== */
  router.post('/auth/password/reset/:reset', (req, res) => {
    if (!checkFields(res, req.body, {
      email: 'string',
      password: 'string',
      passwordRepeat: 'string'
    })) {
      return null;
    }

    if (req.body.password !== req.body.passwordRepeat) {
      return res.status(422).json('passwords don\'t match');
    }

    controller.changePassword(req.body.email, req.body.password, req.params.reset, req.uwave)
    .then(auth => res.status(200).json(auth))
    .catch(e => handleError(res, e, log));
  });

  /* ========== AUTH SESSION :ID ========== */
  router.delete('/auth/session/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < 4) {
      return res.status(403).json('you need to be at least a manager to do this');
    }

    controller.removeSession(req.params.id, req.uwave)
    .then(user => {
      if (!Object.keys(user).length) {
        res.status(200).json('logged out');
      } else {
        res.status(500).json('couldn\'t delete session');
      }
    })
    .catch(e => handleError(res, e, log));
  });
}
