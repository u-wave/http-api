import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import debug from 'debug';

const verify = bluebird.promisify(jwt.verify);
const rx = RegExp(/\/auth\/(login|register|password.*)|\/waitlist|\/booth|\/now|\/(playlists|users)\/[a-f0-9]{24}$/, 'i');

const log = debug('uwave:v1:authenticator');

export default function _authenticator (v1) {
  return function authenticator(req, res, next) {
    // check for routes that need no authentication
    if (rx.test(req.path)) return next();
    if (!req.query.token) return res.status(422).json('no token set');

    verify(req.query.token, v1.getCert())
    .then(user => {
      if (!user) res.status(404).json('user not found');
      if (typeof user.role !== 'number') user.role = parseInt(user.role, 10);
      if (user.role === NaN) user.role = 0;

      req.user = user;
      next();
    })
    .catch(jwt.JsonWebTokenError, e => {
      log(`Token '${req.query.token.slice(0, 64)}...' was not valid.`);
      res.status(410).json('access token invalid');
    })
    .catch(e => {
      log(`Unknown error: ${e}`);
      res.status(500).json('internal server error, please try again later');
    });
  };
};
