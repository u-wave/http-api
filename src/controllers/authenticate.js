import * as bcrypt from 'bcryptjs';
import createDebug from 'debug';
import Promise from 'bluebird';
import { sign as jwtSignCallback } from 'jsonwebtoken';
import randomString from 'random-string';
import got from 'got';
import {
  HTTPError,
  NotFoundError,
  PasswordError,
  PermissionError,
  TokenError,
} from '../errors';
import { ROLE_MANAGER } from '../roles';
import sendEmail from '../email';
import beautifyDuplicateKeyError from '../utils/beautifyDuplicateKeyError';
import toItemResponse from '../utils/toItemResponse';

const log = createDebug('uwave:api:v1:auth');

const jwtSign = Promise.promisify(jwtSignCallback);

export function getCurrentUser(req) {
  return toItemResponse(req.user || {}, {
    url: req.fullUrl,
  });
}

export async function login(options, req) {
  const uw = req.uwave;
  const Authentication = uw.model('Authentication');
  const { email, password } = req.body;

  const auth = await Authentication.findOne({
    email: email.toLowerCase(),
  }).populate('user').exec();
  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  const correct = await bcrypt.compare(password, auth.hash);
  if (!correct) {
    throw new PasswordError('That password is incorrect.');
  }

  if (await auth.user.isBanned()) {
    throw new PermissionError('You have been banned.');
  }

  const token = await jwtSign(
    { id: auth.user.id },
    options.secret,
    { expiresIn: '31d' },
  );

  return toItemResponse(auth.user, {
    meta: { jwt: token },
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
  const Authentication = uw.model('Authentication');
  const resetToken = req.params.reset;
  const { password } = req.body;

  const userId = await uw.redis.get(`reset:${resetToken}`);
  if (!userId) {
    throw new TokenError('That reset token is invalid. Please double-check your reset ' +
      'token or request a new password reset.');
  }

  const hash = await bcrypt.hash(password, 10);

  const auth = await Authentication.findOneAndUpdate({ user: userId }, { hash });

  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  await uw.redis.del(`reset:${resetToken}`);

  return toItemResponse({}, {
    meta: {
      message: `Updated password for ${userId}`,
    },
  });
}

export async function removeSession(req) {
  const uw = req.uwave;
  const { id } = req.params;
  const Authentication = uw.model('Authentication');

  if (req.user.id !== id && req.user.role < ROLE_MANAGER) {
    throw new PermissionError('You need to be a manager to do this');
  }

  const auth = await Authentication.findById(id);
  if (!auth) throw new NotFoundError('Session not found.');

  uw.publish('api-v1:socket:close', auth.id);

  return toItemResponse({}, {
    meta: { message: 'logged out' },
  });
}
