import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import debug from 'debug';
import clamp from 'clamp';

import { GenericError as HTTPError } from '../errors';
import { ROLE_DEFAULT, ROLE_ADMIN } from '../roles';

const verify = bluebird.promisify(jwt.verify);

const log = debug('uwave:v1:authenticator');

export default function authenticatorMiddleware(v1, options) {
  async function authenticator(req) {
    const token = req.query && req.query.token;
    if (!token) {
      return;
    }

    const user = await verify(token, options.secret);
    if (!user) {
      throw new HTTPError(404, 'user not found');
    }

    if (typeof user.role !== 'number') {
      user.role = parseInt(user.role, 10);
    }
    user.role = clamp(user.role || 0, ROLE_DEFAULT, ROLE_ADMIN);

    req.user = user;
  }

  return (req, res, next) => {
    authenticator(req)
      .then(() => next())
      .catch(jwt.JsonWebTokenError, error => {
        log('invalid token', error.message);
        throw new Error('Invalid session');
      })
      .catch(error => {
        next(error);
      });
  };
}
