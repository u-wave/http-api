import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import debug from 'debug';

const verify = bluebird.promisify(jwt.verify);

const log = debug('uwave:v1:authenticator');

export default function authenticatorMiddleware({ uw }, options) {
  async function authenticator(req) {
    const token = req.query && req.query.token;
    if (!token) {
      return;
    }

    const user = await verify(token, options.secret);
    if (!user) {
      throw new Error('Invalid session');
    }

    const User = uw.model('User');
    const userModel = await User.findById(user.id);
    if (!userModel) {
      throw new Error('Invalid session');
    }

    req.user = userModel;
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
