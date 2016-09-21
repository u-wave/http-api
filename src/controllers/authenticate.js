import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
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

const ObjectId = mongoose.Types.ObjectId;
const bcryptHash = Promise.promisify(bcrypt.hash);
const bcryptCompare = Promise.promisify(bcrypt.compare);
// `jwt.sign` only passes a single parameter to its callback: the signed token.
const jwtSign = (...args) => new Promise((resolve) => {
  jwtSignCallback(...args, resolve);
});

export function getCurrentUser(uw, id) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id));
}

export async function login(uw, email, password, options) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({ email }).populate('user').exec();
  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  const correct = await bcryptCompare(password, auth.hash);
  if (!correct) {
    throw new PasswordError('password is incorrect');
  }

  if (await isUserBanned(uw, auth.user)) {
    throw new PermissionError('You have been banned');
  }

  const token = await jwtSign(
    { id: auth.user.id },
    options.secret,
    { expiresIn: '31d' }
  );

  return {
    jwt: token,
    user: auth.user,
  };
}

export async function reset(uw, email) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({ email });
  if (!auth) {
    throw new NotFoundError('User not found.');
  }

  const token = randomString({ length: 35, special: false });

  await uw.redis.set(`reset:${email}`, token);
  await uw.redis.expire(`reset:${email}`, 24 * 60 * 60);

  return token;
}

export async function changePassword(uw, email, password, resetToken) {
  const Authentication = uw.model('Authentication');

  const token = await uw.redis.get(`reset:${email}`);
  if (!token || token !== resetToken) {
    throw new TokenError(
      'That reset token is invalid. Please double-check your token or request ' +
      'a new password reset.'
    );
  }

  const hash = await bcryptHash(password, 10);

  const auth = await Authentication.findOneAndUpdate({ email }, { hash });

  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  await uw.redis.del(`reset:${email}`);
  return `updated password for ${email}`;
}

export function removeSession(uw, id) {
  const Authentication = uw.model('Authentication');
  return Authentication.findOne(new ObjectId(id)).then((auth) => {
    if (!auth) throw new NotFoundError('Session not found.');

    uw.publish('api-v1:socket:close', auth.id);
  });
}
