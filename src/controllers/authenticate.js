import mongoose from 'mongoose';
import Promise from 'bluebird';
import { sign as jwtSignCallback } from 'jsonwebtoken';
import crypto from 'crypto';
import debug from 'debug';

import {
  APIError,
  NotFoundError,
  PasswordError,
  PermissionError,
  TokenError
} from '../errors';
import { isBanned as isUserBanned } from './bans';

const PASS_LENGTH = 256;
const PASS_ITERATIONS = 2048;
const PASS_HASH = 'sha256';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:auth');
const pbkdf2 = Promise.promisify(crypto.pbkdf2);
const randomBytes = Promise.promisify(crypto.randomBytes);
// `jwt.sign` only passes a single parameter to its callback: the signed token.
const jwtSign = (...args) => new Promise(resolve => {
  jwtSignCallback(...args, resolve);
});

export function generateHashPair(password, length) {
  const hashPair = {
    hash: null,
    salt: null
  };

  return randomBytes(length)
  .then(buf => {
    hashPair.salt = buf.toString('hex');
    return pbkdf2(password, hashPair.salt, PASS_ITERATIONS, length, PASS_HASH);
  })
  .then(salted => {
    hashPair.hash = salted.toString('hex');
    return hashPair;
  })
  .catch(e => {
    log(e);
    throw new APIError('Could not create password.');
  });
}

export function getCurrentUser(uw, id) {
  const User = uw.model('User');

  return User.findOne(new ObjectId(id));
}

export function createUser(uw, email, username, password) {
  const User = uw.model('User');
  const Authentication = uw.model('Authentication');
  let _auth = null;

  log(`creating new user ${username}`);
  const user = new User({ username });

  return user.validate()
  .then(() => generateHashPair(password, PASS_LENGTH))
  .then(hashPair => {
    _auth = new Authentication({
      user: user.id,
      email,
      hash: hashPair.hash,
      salt: hashPair.salt
    });
    return _auth.save();
  })
  .then(() => user.save())
  .then(() => user)
  .catch(e => {
    log(`did not create user ${username}. Error: ${e}`);
    if (_auth) _auth.remove();
    user.remove();
    throw e;
  });
}

export async function login(uw, email, password, options) {
  const Authentication = uw.model('Authentication');

  const auth = await Authentication.findOne({ email }).populate('user').exec();
  if (!auth) {
    throw new NotFoundError('No user was found with that email address.');
  }

  const hash = await pbkdf2(password, auth.salt, PASS_ITERATIONS, PASS_LENGTH, PASS_HASH);
  if (hash.toString('hex') !== auth.hash) {
    throw new PasswordError('password is incorrect');
  }

  if (await isUserBanned(uw, auth.user)) {
    throw new PermissionError('You have been banned');
  }

  const token = await jwtSign(
    { id: auth.user.id, role: auth.user.role },
    options.secret,
    { expiresIn: '31d' }
  );

  return {
    jwt: token,
    user: auth.user
  };
}

export function reset(uw, email) {
  const Authentication = uw.model('Authentication');

  return Authentication.findOne({ email })
  .then(auth => {
    if (!auth) throw new NotFoundError('User not found.');
    return randomBytes(64);
  })
  .then(buf => {
    const token = buf.toString('hex');
    uw.redis.set(`reset:${email}`, token);
    uw.redis.expire(`reset${email}`, 24 * 60 * 60);
    return token;
  });
}

export function changePassword(uw, email, password, resetToken) {
  const Authentication = uw.model('Authentication');

  return uw.redis.get(`reset:${email}`)
  .then(token => {
    if (!token || token !== resetToken) {
      throw new TokenError(
        'That reset token is invalid. Please double-check your token or request ' +
        'a new password reset.'
      );
    }

    return generateHashPair(password, PASS_LENGTH);
  })
  .then(hashPair =>
    Authentication.findOneAndUpdate(
      { email },
      { salt: hashPair.salt, hash: hashPair.hash }
    ).exec()
  )
  .then(auth => {
    if (!auth) throw new NotFoundError('No user was found with that email address.');
    uw.redis.del(`reset:${email}`);
    return `updated password for ${email}`;
  });
}

export function removeSession(uw, id) {
  const Authentication = uw.model('Authentication');
  return Authentication.findOne(new ObjectId(id)).then(auth => {
    if (!auth) throw new NotFoundError('Session not found.');

    uw.publish('api-v1:socket:close', auth.id);
  });
}
