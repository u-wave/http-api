import {
  APIError,
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

export default function errorHandler() {
  return (errors, req, res, next) => {
    if (errors) {
      const responseErrors = array(errors).reduce((acc, err) => {
        debug(err);
        if (err instanceof APIError) {
          return [...acc, {
            status: err.status || 500,
            code: 'api-error',
            title: err.message,
          }];
        } else if (err.name === 'ValidationError') {
          return [
            ...acc,
            ...Object.keys(err.errors).map(key => ({
              status: 400,
              code: 'validator-error',
              title: err.errors[key].message,
            })),
          ];
        } else if (err.name === 'ValidatorError') {
          return [...acc, {
            status: 400,
            code: 'validator-error',
            title: err.message,
          }];
        } else if (err instanceof RedisReplyError) {
          return [...acc, {
            status: 410,
            code: 'redis-error',
            title: 'Database error, please try again later.',
          }];
        } else if (err instanceof EmailError) {
          return [...acc, {
            status: 500,
            code: 'email-error',
            title: 'Failed to send email.',
          }];
        }
        return [...acc, {
          status: 500,
          code: 'unknown-error',
          title: 'Internal Server Error',
        }];
      }, []);

      res
        .status(responseErrors[0].status)
        .json(toErrorResponse(responseErrors));
    } else {
      next();
    }
  };
}
