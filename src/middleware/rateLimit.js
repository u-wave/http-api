import ms from 'ms';
import RateLimiter from 'ratelimiter';

import { RateLimitError } from '../errors';

const defaultErrorMessage = (retryAfter, rendered) =>
  `Rate limit exceeded, retry in ${rendered}`;

export default function rateLimit(prefix, opts) {
  const createErrorMessage = opts.error || defaultErrorMessage;

  return (req, res, next) => {
    const id = prefix + (req.user ? req.user.id : req.socket.remoteAddress);
    const db = req.uwave.redis;

    const limiter = new RateLimiter({
      ...opts,
      id, db
    });

    limiter.get((err, limit) => {
      if (err) return next(err);

      res.set('X-RateLimit-Limit', limit.total);
      res.set('X-RateLimit-Remaining', limit.remaining - 1);
      res.set('X-RateLimit-Reset', limit.reset);

      if (limit.remaining) return next();

      const retryAfter = Math.floor(limit.reset - Date.now() / 1000);
      res.set('Retry-After', retryAfter);
      return next(new RateLimitError(
        createErrorMessage(retryAfter, ms(retryAfter * 1000, { long: true }))
      ));
    });
  };
}
