import { Strategy } from 'passport';
import { PermissionError } from '../errors';

function getCookieToken(cookies) {
  return cookies && cookies.uwsession;
}

function getQueryToken(query) {
  return query && query.token;
}

function getHeaderToken(headers) {
  if (headers.authorization) {
    const parts = headers.authorization.split(' ');
    if (parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }
  return null;
}

export default class SessionStrategy extends Strategy {
  constructor(getUser) {
    super();
    this.getUser = getUser;
  }

  authenticate(req, options) {
    this.authenticateP(req, options).catch((err) => {
      this.error(err);
    });
  }

  async authenticateP(req) {
    const rawToken =
      getQueryToken(req.query) ||
      getHeaderToken(req.headers) ||
      getCookieToken(req.signedCookies);
    if (!rawToken) {
      return this.pass();
    }

    const token = Buffer.from(rawToken, 'base64');

    const user = await this.getUser(token).catch(() => null);
    if (!user) {
      return this.pass();
    }

    if (await user.isBanned()) {
      throw new PermissionError('You have been banned');
    }

    return this.success(user, { token });
  }
}

