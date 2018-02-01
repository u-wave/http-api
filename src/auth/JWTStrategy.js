import { Strategy } from 'passport';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import { PermissionError } from '../errors';

const jwtVerify = promisify(jwt.verify);

function getHeaderToken(headers) {
  if (headers.authorization) {
    const parts = headers.authorization.split(' ');
    if (parts[0].toLowerCase() === 'jwt') {
      return parts[1];
    }
  }
  return null;
}

export default class JWTStrategy extends Strategy {
  constructor(secret, getUser) {
    super();
    this.secret = secret;
    this.getUser = getUser;
  }

  authenticate(req, options) {
    this.authenticateP(req, options).catch((err) => {
      this.error(err);
    });
  }

  async authenticateP(req) {
    const token = (req.query && req.query.token) || getHeaderToken(req.headers);
    if (!token) {
      return this.fail({ message: 'No token' }, 400);
    }

    let value;
    try {
      value = await jwtVerify(token, this.secret);
    } catch (e) {
      return this.fail({ message: 'Invalid token' }, 400);
    }

    if (!value) {
      return this.fail({ message: 'Empty token' }, 400);
    }

    const user = await this.getUser(value);
    if (!user) {
      return this.fail({ message: 'User not found' }, 400);
    }

    if (await user.isBanned()) {
      throw new PermissionError('You have been banned');
    }

    return this.success(user);
  }
}

