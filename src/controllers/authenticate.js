import cookie from 'cookie';
import createDebug from 'debug';
import jwt from 'jsonwebtoken';
import randomString from 'random-string';
import got from 'got';
import ms from 'ms';
import {
  HTTPError,
  NotFoundError,
  PermissionError,
  TokenError,
} from '../errors';
import { ROLE_MANAGER } from '../roles';
import sendEmail from '../email';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';
import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';

const log = createDebug('uwave:http:auth');

function seconds(str) {
  return Math.floor(ms(str) / 1000);
}

export function getCurrentUser(req) {
  return toItemResponse(req.user || {}, {
    url: req.fullUrl,
  });
}

export function getAuthStrategies(req) {
  const { passport } = req.uwaveHttp;

  return toListResponse(
    passport.strategies(),
    { url: req.fullUrl },
  );
}

export async function refreshSession(res, api, user, options) {
  const token = await jwt.sign(
    { id: user.id },
    options.secret,
    { expiresIn: '31d' },
  );

  const socketToken = await api.sockets.createAuthToken(user);

  if (options.session === 'cookie') {
    const serialized = cookie.serialize('uwsession', token, {
      httpOnly: true,
      secure: !!options.cookieSecure,
      path: options.cookiePath || '/',
      maxAge: seconds('31 days'),
    });
    res.setHeader('Set-Cookie', serialized);
    return { token: 'cookie', socketToken };
  }

  return { token, socketToken };
}

/**
 * The login controller is called once a user has logged in successfully using Passport;
 * we only have to assign the JWT.
 */
export async function login(options, req, res) {
  const { user } = req;
  const sessionType = req.query.session === 'cookie' ? 'cookie' : 'token';

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  const { token, socketToken } = await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: sessionType,
  });

  return toItemResponse(user, {
    meta: {
      jwt: sessionType === 'token' ? token : 'cookie',
      socketToken,
    },
  });
}

export async function socialLoginCallback(options, req, res) {
  const { user } = req;

  if (await user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  await refreshSession(res, req.uwaveHttp, user, {
    ...options,
    session: 'cookie',
  });

  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Success</title>
      </head>
      <body>
        You can now close this window.
        <script>close()</script>
      </body>
    </html>
  `);
}

export async function getSocketToken(req) {
  const { sockets } = req.uwaveHttp;
  const socketToken = await sockets.createAuthToken(req.user);
  return toItemResponse({ socketToken }, {
    url: req.fullUrl,
  });
}

async function verifyCaptcha(responseString, options) {
  if (!options.recaptcha) {
    log('ReCaptcha validation is disabled');
    return null;
  } else if (!responseString) {
    throw new Error('ReCaptcha validation failed. Please try again.');
  }

  const response = await got.post('https://www.google.com/recaptcha/api/siteverify', {
    json: true,
    form: true,
    body: {
      response: responseString,
      secret: options.recaptcha.secret,
    },
  });

  if (!response.body.success) {
    log('recaptcha validation failure', response.body);
    throw new Error('ReCaptcha validation failed. Please try again.');
  }
  return null;
}

export async function register(options, req) {
  const uw = req.uwave;
  const {
    grecaptcha, email, username, password,
  } = req.body;

  if (/\s/.test(username)) {
    throw new HTTPError(400, 'Usernames can\'t contain spaces.');
  }

  try {
    await verifyCaptcha(grecaptcha, options);

    const user = await uw.createUser({
      email,
      username,
      password,
    });

    return toItemResponse(user);
  } catch (error) {
    throw beautifyDuplicateKeyError(error);
  }
}

export async function reset(options, req) {
  const uw = req.uwave;
  const Authentication = uw.model('Authentication');
  const { email } = req.body;

  const auth = await Authentication.findOne({
    email: email.toLowerCase(),
  });
  if (!auth) {
    throw new NotFoundError('User not found.');
  }

  const token = randomString({ length: 35, special: false });

  await uw.redis.set(`reset:${token}`, auth.user.toString());
  await uw.redis.expire(`reset:${token}`, 24 * 60 * 60);

  await sendEmail(email, {
    mailTransport: options.mailTransport,
    email: options.createPasswordResetEmail({
      token,
      requestUrl: req.fullUrl,
    }),
  });

  return toItemResponse({});
}

export async function changePassword(req) {
  const uw = req.uwave;
  const resetToken = req.params.reset;
  const { password } = req.body;

  const userId = await uw.redis.get(`reset:${resetToken}`);
  if (!userId) {
    throw new TokenError('That reset token is invalid. Please double-check your reset ' +
      'token or request a new password reset.');
  }

  await uw.users.updatePassword(userId, password);

  await uw.redis.del(`reset:${resetToken}`);

  return toItemResponse({}, {
    meta: {
      message: `Updated password for ${userId}`,
    },
  });
}

export async function logout(options, req, res) {
  const uw = req.uwave;

  uw.publish('user:logout', {
    userID: req.user.id,
  });

  if (req.cookies && req.cookies.uwsession) {
    const serialized = cookie.serialize('uwsession', '', {
      httpOnly: true,
      secure: !!options.cookieSecure,
      path: options.cookiePath || '/',
      maxAge: 0,
    });
    res.setHeader('Set-Cookie', serialized);
  }

  return toItemResponse({});
}

export async function removeSession(options, req) {
  const uw = req.uwave;
  const { id } = req.params;
  const Authentication = uw.model('Authentication');

  if (req.user.id !== id && req.user.role < ROLE_MANAGER) {
    throw new PermissionError('You need to be a manager to do this');
  }

  const auth = await Authentication.findById(id);
  if (!auth) throw new NotFoundError('Session not found.');

  uw.publish('api-v1:sockets:close', auth.id);

  return toItemResponse({}, {
    meta: { message: 'logged out' },
  });
}
