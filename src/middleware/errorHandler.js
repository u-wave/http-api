import { APIError, RedisReplyError } from '../errors';

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
      const responseErrors = [];
      for (const err of array(errors)) {
        debug(err.message);
        if (err instanceof APIError) {
          responseErrors.push({
            status: err.status || 500,
            code: 'api-error',
            title: err.message,
          });
        } else if (err.name === 'ValidationError') {
          responseErrors.push(
            ...Object.keys(err.errors).map(key => ({
              status: 400,
              code: 'validator-error',
              title: err.errors[key].message,
            }))
          );
        } else if (err.name === 'ValidatorError') {
          responseErrors.push({
            status: 400,
            code: 'validator-error',
            title: err.message,
          });
        } else if (err instanceof RedisReplyError) {
          responseErrors.push({
            status: 410,
            code: 'redis-error',
            title: 'Database error, please try again later.',
          });
        } else {
          responseErrors.push({
            status: 500,
            code: 'unknown-error',
            title: 'Internal Server Error',
          });
        }
      }
      res
        .status(responseErrors[0].status)
        .json(toErrorResponse(responseErrors));
    } else {
      next();
    }
  };
}
