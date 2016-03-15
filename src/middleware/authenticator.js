import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import debug from 'debug';
import clamp from 'clamp';

import { GenericError as HTTPError } from '../errors';
import { ROLE_DEFAULT, ROLE_ADMIN } from '../roles';

const verify = bluebird.promisify(jwt.verify);

const log = debug('uwave:v1:authenticator');

export default function authenticatorMiddleware(v1, options) {
  return function authenticator(req, res, next) {
    const token = req.query && req.query.token;
    if (!token) {
      next();
      return;
    }

    verify(token, options.secret)
    .then(user => {
      if (!user) {
        throw new HTTPError(404, 'user not found');
      }

      if (typeof user.role !== 'number') {
        user.role = parseInt(user.role, 10);
      }
      user.role = clamp(user.role || 0, ROLE_DEFAULT, ROLE_ADMIN);

      req.user = user;
      next();
    })
    .catch(jwt.JsonWebTokenError, () => {
      log(`Token '${req.query.token.slice(0, 64)}...' was not valid.`);
      throw new HTTPError(400, 'access token invalid');
    })
    .catch(e => {
      if (e instanceof HTTPError) {
        throw e;
      }
      log(`Unknown error: ${e}`);
      throw new HTTPError(500, 'internal server error, please try again later');
    })
    .catch(next);
  };
}
