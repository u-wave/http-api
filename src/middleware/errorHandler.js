import handleError from '../errors';

const debug = require('debug')('uwave:api:v1:error');

export default function errorHandler() {
  return (err, req, res, next) => {
    if (err) {
      return handleError(res, err, debug);
    }
    next();
  };
}
