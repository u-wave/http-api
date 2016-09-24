import { HTTPError } from '../errors';

class InputError extends HTTPError {
  constructor(message, props) {
    super(422, message);

    Object.assign(this, props);
  }
}

export default function checkFields(types) {
  return (req, res, next) => {
    const errors = [];

    Object.keys(types).forEach((field) => {
      const type = types[field];
      const value = req.body[field];
      if (typeof value !== type) { // eslint-disable-line valid-typeof
        errors.push(new InputError(`Expected a ${type}`, {
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
