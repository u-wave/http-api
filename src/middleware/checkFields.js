import joi from 'joi';
import { promisify } from 'util';
import wrapMiddleware from '../utils/wrapMiddleware';

const validate = promisify(joi.validate);

export default function checkFields(types) {
  return wrapMiddleware(async (req) => {
    await validate(req, types, {
      abortEarly: false,
      allowUnknown: true,
    });
  });
}
