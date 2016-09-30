import {
  APIError,
  CombinedError,
  EmailError,
  RedisReplyError,
} from '../errors';

const debug = require('debug')('uwave:api:v1:error');

function toErrorResponse(errors) {
  return {
    data: {},
    meta: {},
    errors,
  };
}

function array(obj) {
  return Array.isArray(obj) ? obj : [obj];
}

function serializeError(err) {
  if (err instanceof CombinedError) {
    return err.errors.reduce(
      (errors, one) => errors.concat(serializeError(one)),
      []
    );
  }
  if (err instanceof APIError) {
    return [{
      status: err.status || 500,
      code: 'api-error',
      title: err.message,
    }];
  }
  if (err.isJoi) {
    return err.details.map(error => ({
      status: 400,
      code: error.type,
      title: error.message,
      source: {
        path: error.path,
      },
    }));
  }
  if (err.name === 'ValidationError') {
    return Object.keys(err.errors).reduce(
      (errors, key) => errors.concat(serializeError(err.errors[key])),
      []
    );
  }
  if (err.name === 'ValidatorError') {
    return [{
      status: 400,
      code: 'validator-error',
      title: err.message,
    }];
  }
  if (err instanceof RedisReplyError) {
    return [{
      status: 410,
      code: 'redis-error',
      title: 'Database error, please try again later.',
    }];
  }
  return [{
    status: 500,
    code: 'unknown-error',
    title: 'Internal Server Error',
  }];
}

export default function errorHandler() {
  return (errors, req, res, next) => {
    if (errors) {
      const responseErrors = Array.isArray(errors)
        ? serializeError(new CombinedError(errors))
        : serializeError(errors);


      res
        .status(responseErrors[0].status)
        .json(toErrorResponse(responseErrors));
    } else {
      next();
    }
  };
}
