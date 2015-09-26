import debug from 'debug';

import * as controller from '../controllers/authenticate';
import { checkFields, handleDuplicate } from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:auth');

export default function authenticate(router) {
  /* ========== REGISTER ========== */
  router.post('/auth/register', (req, res) => {
    if (!checkFields(req.body, res, [
      'email',
      'username',
      'password',
      'passwordRepeat'
    ])) return;

    if (req.body.password !== req.body.passwordRepeat) {
      return res.status(422).json('passwords don\'t match');
    }

    if (req.query.token) {
      return res.status(418).json(
        `you are already registered and logged in. I presume you dropped this on your way in '${req.query.token}' :P`
      );
    }

    const data = {
      'email': String(req.body.email),
      'username': String(req.body.username),
      'password': String(req.body.password)
    };

    controller.createUser(data)
    .then(user => res.status(200).json(user))
    .catch(e => {
      if (!e.errmsg || !handleDuplicate(res, e.errmsg, ['email', 'username'])) {
        handleError(res, e, log);
      }
    });
  });

  /* ========== LOGIN ========== */
  router.post('/auth/login', (req, res) => {
    if (!checkFields(req.body, res, [
      'email',
      'password'
    ])) return;

    if (req.query.token) {
      return res.status(418).json(
        `you are already registered and logged in. I presume you dropped this on your way in '${req.query.token}' :P`
      );
    }

    const _email = String(req.body.email);
    const _password = String(req.body.password);

    controller.login(_email, _password, req.uwave.redis)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  /* ========== PASSWORD RESET ========== */
  router.post('/auth/password/reset', (req, res) => {
    if (!req.body.email) return res.status(422).json('email is not set');

    const _email = String(req.body.email);

    controller.reset(_email, req.uwave.redis)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  /* ========== PASSWORD RESET :RESET ========== */
  router.post('/auth/password/reset/:reset', (req, res) => {
    if (!checkFields(req.body, res, [
      'email',
      'password',
      'passwordRepeat'
    ])) return;

    if (req.body.password !== req.body.passwordRepeat) {
      return res.status(422).json('passwords don\'t match');
    }

    const data = {
      'email': String(req.body.email),
      'password': String(req.body.password)
    };

    controller.changePassword(data, req.params.reset, req.uwave.redis)
    .then(auth => res.status(200).json(auth))
    .catch(e => handleError(res, e, log));
  });

  /* ========== AUTH SESSION :ID ========== */
  router.delete('/auth/session/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < 4) {
      return res.status(403).json('you need to be at least a manager to do this');
    }

    controller.removeSession(req.params.id, req.query.token, req.uwave.redis)
    .then(user => {
      if (!Object.keys(user).length) return res.status(200).json('logged out');
      res.status(500).json('couldn\'t delete session');
    })
    .catch(e => handleError(res, e, log));
  });
}