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
import { sendEmail } from '../email';

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

export async function reset(uw, email) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({
    email: email.toLowerCase(),
  });
  if (!auth) {
    throw new NotFoundError('User not found.');
  }

  const token = randomString({ length: 35, special: false });

  await uw.redis.set(`reset:${email.toLowerCase()}`, token);
  await uw.redis.expire(`reset:${email.toLowerCase()}`, 24 * 60 * 60);

  return sendEmail(email, 'reset password', token);
}

export async function changePassword(uw, email, password, resetToken) {
  const Authentication = uw.model('Authentication');

  const token = await uw.redis.get(`reset:${email.toLowerCase()}`);
  if (!token || token !== resetToken) {
    throw new TokenError(
      'That reset token and/or email address is invalid. Please double-check your reset ' +
      'token and/or request a new password reset.',
    );
  }

  const hash = await bcrypt.hash(password, 10);

  const auth = await Authentication.findOneAndUpdate({ email: email.toLowerCase() }, { hash });

  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  await uw.redis.del(`reset:${email.toLowerCase()}`);
  return `updated password for ${email}`;
}

export function removeSession(uw, id) {
  const Authentication = uw.model('Authentication');
  return Authentication.findById(id).then((auth) => {
    if (!auth) throw new NotFoundError('Session not found.');

    uw.publish('api-v1:socket:close', auth.id);
  });
}
