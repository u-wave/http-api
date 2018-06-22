import ms from 'ms';
import { promisify } from 'util';
import RateLimiter from 'ratelimiter';
import wrapMiddleware from '../utils/wrapMiddleware';
import { RateLimitError } from '../errors';

const defaultErrorMessage = (retryAfter, rendered) => `Rate limit exceeded, retry in ${rendered}`;

RateLimiter.prototype.getAsync = promisify(RateLimiter.prototype.get);

export default function rateLimit(prefix, opts) {
  const createErrorMessage = opts.error || defaultErrorMessage;

  return wrapMiddleware(async (req, res) => {
    const id = prefix + (req.user ? req.user.id : req.socket.remoteAddress);
    const db = req.uwave.redis;

    const limiter = new RateLimiter({
      ...opts,
      id,
      db,
    });

    const limit = await limiter.getAsync();

    res.set('X-RateLimit-Limit', limit.total);
    res.set('X-RateLimit-Remaining', limit.remaining - 1);
    res.set('X-RateLimit-Reset', limit.reset);

    if (limit.remaining) return;

    const retryAfter = Math.floor(limit.reset - (Date.now() / 1000));
    res.set('Retry-After', retryAfter);

    const message = createErrorMessage(retryAfter, ms(retryAfter * 1000, { long: true }));
    throw new RateLimitError(message);
  });
}
