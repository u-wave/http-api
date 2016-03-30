import redis from 'ioredis';

export class APIError extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this);
    this.message = message;
  }
}

export class PasswordError extends APIError {
  name = 'PasswordError';

  constructor(message) {
    super(message);
  }
}

export class TokenError extends APIError {
  name = 'TokenError';

  constructor(message) {
    super(message);
  }
}

export class HTTPError extends APIError {
  name = 'HTTPError';

  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleError(res, e, log) {
  if (log) {
    log(e);
  }
  if (e instanceof APIError) {
    res.status(e.status || 500).json(e.message);
  } else if (e instanceof redis.ReplyError) {
    res.status(410).json('couldn\'t save to database, please try again later');
  } else {
    res.status(500).json('Internal Server Error');
  }
}

export default handleError;
