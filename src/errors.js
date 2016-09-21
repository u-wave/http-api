import { ReplyError as RedisReplyError } from 'ioredis';

export class APIError extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this);
    this.message = message;
  }

  /**
   * Hack to force other Error instances to be public.
   */
  static wrap(error) {
    Object.setPrototypeOf(error, APIError.prototype);
    return error;
  }
}

export class PasswordError extends APIError {
  name = 'PasswordError';
}

export class TokenError extends APIError {
  name = 'TokenError';
}

export class HTTPError extends APIError {
  name = 'HTTPError';

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class NotFoundError extends HTTPError {
  name = 'NotFoundError';

  constructor(message) {
    super(404, message);
  }
}

export class PermissionError extends HTTPError {
  name = 'PermissionError';

  constructor(message) {
    super(403, message);
  }
}

export class RateLimitError extends HTTPError {
  name = 'RateLimitError';

  constructor(message) {
    super(429, message);
  }
}

export function handleError(res, e, log) {
  if (log) {
    log(e);
  }

  if (e instanceof APIError) {
    res.status(e.status || 500).json(e.message);
  } else if (e.name === 'ValidationError') {
    const errorMessages = Object.keys(e.errors).map(key => e.errors[key].message);
    res.status(400).json(errorMessages.join(' '));
  } else if (e.name === 'ValidatorError') {
    res.status(400).json(e.message);
  } else if (e instanceof RedisReplyError) {
    res.status(410).json('Database error, please try again later.');
  } else {
    res.status(500).json('Internal Server Error');
  }
}

export default handleError;
