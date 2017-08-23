import debug from 'debug';
import createRouter from 'router';
import Promise from 'bluebird';
import request from 'request';

import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/authenticate';
import {
  HTTPError,
  PermissionError,
  EmailError,
} from '../errors';
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

  router.post('/register', checkFields({
    email: 'string',
    username: 'string',
    password: 'string',
  }), (req, res, next) => {
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

  router.post('/login', checkFields({
    email: 'string',
    password: 'string',
  }), (req, res, next) => {
    controller.login(req.uwave, req.body.email, req.body.password, options)
      .then(({ jwt, user }) => toItemResponse(user, {
        meta: { jwt },
      }))
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  router.post('/password/reset', checkFields({ email: 'string' }), (req, res, next) => {
    controller.reset(req.uwave, req.body.email, req.fullUrl, options)
      .then(result => toItemResponse(result))
      .then(item => res.status(200).json(item))
      .catch((err) => {
        throw new EmailError(err.message);
      })
      .catch(next);
  });

  router.post('/password/reset/:reset', checkFields({
    email: 'string',
    password: 'string',
  }), (req, res, next) => {
    controller.changePassword(req.uwave, req.body.email, req.body.password, req.params.reset)
      .then(message => toItemResponse({}, {
        meta: { message },
      }))
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  router.delete('/session/:id', (req, res, next) => {
    if (req.user.id !== req.params.id && req.user.role < ROLE_MANAGER) {
      next(new PermissionError('You need to be a manager to do this'));
      return;
    }

    controller.removeSession(req.uwave, req.params.id)
      .then((user) => {
        if (Object.keys(user).length) {
          throw new HTTPError(500, 'Couldn\'t delete session');
        }
        return toItemResponse({}, {
          meta: { message: 'logged out' },
        });
      })
      .then(item => res.status(200).json(item))
      .catch(next);
  });

  return router;
}
