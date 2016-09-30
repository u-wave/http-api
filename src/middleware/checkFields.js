import joi from 'joi';
import { HTTPError } from '../errors';

class InputError extends HTTPError {
  constructor(message, props) {
    super(422, message);

    Object.assign(this, props);
  }
}

export default function checkFields(types) {
  if (typeof types.validate === 'function') {
    return (req, res, next) => {
      joi.validate(req, types, {
        abortEarly: false,
        allowUnknown: true,
      }, (err) => {
        if (err) {
          next(err);
        } else {
          next();
        }
      });
    };
  }

  return (req, res, next) => {
    const errors = [];

    Object.keys(types).forEach((field) => {
      const type = types[field];
      const value = req.body[field];
      if (typeof value !== type) { // eslint-disable-line valid-typeof
        errors.push(new InputError(`${field}: Expected a ${type}`, {
          source: { field },
        }));
      }
    });

    if (errors.length > 0) {
      next(errors);
    } else {
      next();
    }
  };
}
