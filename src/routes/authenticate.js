import debug from 'debug';
import createRouter from 'router';

import * as controller from '../controllers/authenticate';
import { checkFields, handleDuplicate } from '../utils';
import handleError from '../errors';
import { ROLE_MANAGER } from '../roles';

const log = debug('uwave:api:v1:auth');
const rx = /\s|%20/;

export default function authenticateRoutes(v1, options) {
  const router = createRouter();

  router.get('/', (req, res) => {
    controller.getCurrentUser(req.uwave, req.user.id)
    .then(user => res.status(200).json(user))
    .catch(e => handleError(res, e, log));
  });

  router.post('/register', (req, res) => {
    if (!checkFields(res, req.body, {
      email: 'string',
      username: 'string',
      password: 'string'
    })) {
      return null;
    }

    if (rx.test(req.body.username)) {
      return res.status(422).json('username contains invalid characters e.g. space');
    }

    controller.createUser(req.uwave, req.body.email, req.body.username, req.body.password)
    .then(user => res.status(200).json(user))
    .catch(e => {
      if (!e.errmsg || !handleDuplicate(res, e.errmsg, ['email', 'username'])) {
        handleError(res, e, log);
      }
    });
  });

  router.post('/login', (req, res) => {
    if (!checkFields(res, req.body, { email: 'string', password: 'string' })) {
      return null;
    }

    controller.login(req.uwave, req.body.email, req.body.password, options)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  router.post('/password/reset', (req, res) => {
    if (!checkFields(res, req.body, { email: 'string' })) {
      return null;
    }

    controller.reset(req.uwave, req.body.email)
    .then(token => res.status(200).json(token))
    .catch(e => handleError(res, e, log));
  });

  router.post('/password/reset/:reset', (req, res) => {
    if (!checkFields(res, req.body, { email: 'string', password: 'string' })) {
      return null;
    }

    controller.changePassword(req.uwave, req.body.email, req.body.password, req.params.reset)
    .then(auth => res.status(200).json(auth))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/session/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
      return res.status(403).json('you need to be at least a manager to do this');
    }

    controller.removeSession(req.uwave, req.params.id)
    .then(user => {
      if (!Object.keys(user).length) {
        res.status(200).json('logged out');
      } else {
        res.status(500).json('couldn\'t delete session');
      }
    })
    .catch(e => handleError(res, e, log));
  });

  return router;
}
