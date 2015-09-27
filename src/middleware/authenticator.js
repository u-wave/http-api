import bluebird from 'bluebird';
import jwt from 'jsonwebtoken';
import redis from 'ioredis';
import debug from 'debug';

const verify = bluebird.promisify(jwt.verify);
const noauth = RegExp(/\/auth\/(login|register|password.*)$/, 'i');

export default function authenticator(req, res, next) {
  if (noauth.test(req.path)) return next();
  if (!req.query.token) return res.status(422).json('no token set');

  // TODO: should token be static in config or generated every x time units?
  verify(req.query.token, config.secret || 'test')
  .then(() => {
    return req.uwave.redis.hgetall(`user:${req.query.token}`);
  })
  .then(user => {
    if (!Object.keys(user).length) return res.status(404).json('user not found. Access token expired?');
    user.role = parseInt(user.role, 10);
    req.user = user;
    next();
  })
  .catch(jwt.JsonWebTokenError, e => {
    log(`Token '${req.query.token.slice(0, 64)}...' was not valid.`);
    res.status(410).json('access token invalid');
  })
  .catch(redis.ReplyError, e => {
    log(`couldn't fetch data from redis. Err: ${e}`);
    res.status(410).json('no entry found for this token');
  })
  .catch(e => {
    log(`Unknown error: ${e}`);
    res.status(500).json('internal server error, please try again later');
  });
};
