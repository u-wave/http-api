import { t } from './locale';

export class EmailError extends Error {
  constructor(message) {
    super();
    Error.captureStackTrace(this);
    this.message = message;
  }
}

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

export class CombinedError extends APIError {
  constructor(errors) {
    super('Multiple errors');
    this.errors = errors;
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

function createErrorClass(name, {
  status = 500,
  code = 'unknown-error',
  string,
}) {
  return class extends HTTPError {
    name = name;

    code = code;

    constructor(data) {
      super(status, t(string, data));

      this.string = string;
      this.data = data;
    }

    getMessage(translate = t) {
      return translate(string);
    }
  }
}

export const UserNotFoundError = createErrorClass('UserNotFoundError', {
  status: 404,
  code: 'user-not-found',
  string: 'userNotFound'
});

export const PlaylistNotFoundError = createErrorClass('PlaylistNotFoundError', {
  status: 404,
  code: 'playlist-not-found',
  string: 'playlistNotFound'
});

export const PlaylistItemNotFoundError = createErrorClass('PlaylistItemNotFoundError', {
  status: 404,
  code: 'playlist-item-not-found',
  string: 'playlistItemNotFound'
});
