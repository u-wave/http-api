import { HTTPError } from '../errors';
import * as r from '../roles';

const roleErrors = {
  [r.ROLE_DEFAULT]: 'You need to be logged in to do this',
  [r.ROLE_SPECIAL]: 'You need to be a Special user to do this',
  [r.ROLE_MODERATOR]: 'You need to be a moderator to do this',
  [r.ROLE_MANAGER]: 'You need to be a manager to do this',
  [r.ROLE_ADMIN]: 'You need to be an administrator to do this',
};

export default function protect(requiredRole = r.ROLE_DEFAULT) {
  return (req, res, next) => {
    if (!req.user || req.user.role < requiredRole) {
      next(new HTTPError(403, roleErrors[requiredRole]));
    } else {
      next();
    }
  };
}
