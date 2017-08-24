import * as bcrypt from 'bcryptjs';
import Promise from 'bluebird';
import { sign as jwtSignCallback } from 'jsonwebtoken';
import randomString from 'random-string';

import {
  NotFoundError,
  PasswordError,
  PermissionError,
  TokenError,
} from '../errors';
import { isBanned as isUserBanned } from './bans';
import sendEmail from '../email';

const jwtSign = Promise.promisify(jwtSignCallback);

export function getCurrentUser(uw, id) {
  const User = uw.model('User');

  return User.findById(id);
}

export async function login(uw, email, password, options) {
  const Authentication = uw.model('Authentication');

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

  if (await isUserBanned(uw, auth.user)) {
    throw new PermissionError('You have been banned.');
  }

  const token = await jwtSign(
    { id: auth.user.id },
    options.secret,
    { expiresIn: '31d' },
  );

  return {
    jwt: token,
    user: auth.user,
  };
}

export async function reset(uw, email, requestUrl, options) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({
    email: email.toLowerCase(),
  });
  if (!auth) {
    throw new NotFoundError('User not found.');
  }

  const token = randomString({ length: 35, special: false });

  await uw.redis.set(`reset:${token}`, auth.user.toString());
  await uw.redis.expire(`reset:${token}`, 24 * 60 * 60);

  return sendEmail(email, {
    mailTransport: options.mailTransport,
    email: options.createPasswordResetEmail({
      token,
      requestUrl,
    }),
  });
}

export async function changePassword(uw, resetToken, password) {
  const Authentication = uw.model('Authentication');

  const userId = await uw.redis.get(`reset:${resetToken}`);
  if (!userId) {
    throw new TokenError(
      'That reset token is invalid. Please double-check your reset ' +
      'token or request a new password reset.');
  }

  const hash = await bcrypt.hash(password, 10);

  const auth = await Authentication.findOneAndUpdate({ user: userId }, { hash });

  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  await uw.redis.del(`reset:${resetToken}`);
  return `updated password for ${userId}`;
}

export function removeSession(uw, id) {
  const Authentication = uw.model('Authentication');
  return Authentication.findById(id).then((auth) => {
    if (!auth) throw new NotFoundError('Session not found.');

    uw.publish('api-v1:socket:close', auth.id);
  });
}
