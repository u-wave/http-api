import redis from 'ioredis';

export class PasswordError extends Error {
  constructor(str) {
    super();
    Error.captureStackTrace(this);
    this.name = 'PasswordError';
    this.message = str;
  }
}

export class TokenError extends Error {
  constructor(str) {
    super();
    Error.captureStackTrace(this);
    this.name = 'TokenError';
    this.message = str;
  }
}

export class GenericError extends Error {
  constructor(status, str) {
    super();
    Error.captureStackTrace(this);
    this.name = 'GenericError';
    this.status = status;
    this.message = str;
  }
}

export class PaginateError extends Error {
  constructor(e) {
    super();
    this.name = 'PaginateError';
    this.stack = e.stack;
    this.message = e.message;
  }
}

export function handleError(res, e, log) {
  if (log) {
    log(e);
  }
  if (e instanceof redis.ReplyError) {
    res.status(410).json('couldn\'t save to database, please try again later');
  } else if (e instanceof PaginateError) {
    res.status(500).json(e.message);
  } else if (e instanceof PasswordError) {
    res.status(410).json(e.message);
  } else if (e instanceof TokenError) {
    res.status(410).json(e.message);
  } else if (e instanceof GenericError) {
    res.status(e.status).json(e.message);
  } else {
    if (e.message && e.message.includes('string of 24 hex characters')) {
      res.status(422).json('ID was invalid');
    } else {
      res.status(500).json('internal server error, please try again later');
    }
  }
}

export default handleError;
