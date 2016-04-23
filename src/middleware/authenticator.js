import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';

import { PermissionError } from '../errors';
import { isBanned as isUserBanned } from '../controllers/bans';

const verify = bluebird.promisify(jwt.verify);

export default function authenticatorMiddleware({ uw }, options) {
  async function authenticator(req) {
    const token = req.query && req.query.token;
    if (!token) {
      return;
    }

    let user;
    try {
      user = await verify(token, options.secret);
    } catch (e) {
      return;
    }

    if (!user) {
      return;
    }

    const User = uw.model('User');
    const userModel = await User.findById(user.id);
    if (!userModel) {
      return;
    }

    if (await isUserBanned(uw, userModel)) {
      throw new PermissionError('You have been banned');
    }

    req.user = userModel;
  }

  return (req, res, next) => {
    authenticator(req)
      .then(() => {
        next();
      })
      .catch(error => {
        next(error);
      });
  };
}
