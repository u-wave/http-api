import debug from 'debug';
import createRouter from 'router';
import Promise from 'bluebird';
import request from 'request';

import * as controller from '../controllers/authenticate';
import { checkFields } from '../utils';
import { handleError, HTTPError } from '../errors';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';
import toItemResponse from '../utils/toItemResponse';
import { ROLE_MANAGER } from '../roles';

const log = debug('uwave:api:v1:auth');
const rx = /\s|%20/;

function verifyCaptcha(responseString, options) {
  if (!options.recaptcha) {
    log('ReCaptcha validation is disabled');
    return Promise.resolve();
  } else if (!responseString) {
    throw new Error('ReCaptcha validation failed. Please try again.');
  }

  return new Promise((resolve, reject) => {
    request.post('https://www.google.com/recaptcha/api/siteverify', {
      json: true,
      form: {
        response: responseString,
        secret: options.recaptcha.secret,
      },
    }, (err, resp) => {
      if (!err && resp.body.success) {
        resolve(resp.body);
      } else {
        log('recaptcha validation failure', resp.body);
        reject(new Error('ReCaptcha validation failed. Please try again.'));
      }
    });
  });
}

export default function authenticateRoutes(v1, options) {
  const router = createRouter();

  router.get('/', (req, res) => {
    res.json(toItemResponse(req.user || {}, {
      url: req.fullUrl,
    }));
  });

  router.post('/register', (req, res, next) => {
    if (!checkFields(res, req.body, {
      email: 'string',
      username: 'string',
      password: 'string',
    })) {
      return;
    }

    const uw = req.uwave;
    const { grecaptcha, email, username, password } = req.body;

    if (rx.test(username)) {
      next(new HTTPError(400, 'Usernames can\'t contain spaces.'));
      return;
    }

    verifyCaptcha(grecaptcha, options)
      .then(() => uw.createUser({ email, username, password }))
      .then(user => toItemResponse(user))
      .then(item => res.json(item))
      .catch(error => next(beautifyDuplicateKeyError(error)));
  });

  router.post('/login', (req, res, next) => {
    if (!checkFields(res, req.body, { email: 'string', password: 'string' })) {
      return;
    }

    controller.login(req.uwave, req.body.email, req.body.password, options)
      .then(toItemResponse)
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  router.post('/password/reset', (req, res, next) => {
    if (!checkFields(res, req.body, { email: 'string' })) {
      return;
    }

    controller.reset(req.uwave, req.body.email)
      .then(token => toItemResponse({
        token,
      }))
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  router.post('/password/reset/:reset', (req, res, next) => {
    if (!checkFields(res, req.body, { email: 'string', password: 'string' })) {
      return;
    }

    controller.changePassword(req.uwave, req.body.email, req.body.password, req.params.reset)
      .then(auth => res.status(200).json(auth))
      .catch(next);
  });

  router.delete('/session/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
      res.status(403).json('you need to be at least a manager to do this');
      return;
    }

    controller.removeSession(req.uwave, req.params.id)
    .then((user) => {
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
