import mongoose from 'mongoose';
import Promise from 'bluebird';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import debug from 'debug';

import { createCommand } from '../sockets';
import { PasswordError, TokenError, GenericError } from '../errors';

const PASS_LENGTH = 256;
const PASS_ITERATIONS = 2048;
const PASS_HASH = 'sha256';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:auth');
const pbkdf2 = Promise.promisify(crypto.pbkdf2);
const randomBytes = Promise.promisify(crypto.randomBytes);

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
    throw new GenericError(402, 'couldn\'t create password');
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

export function login(uw, email, password, secret) {
  const Authentication = uw.model('Authentication');
  let _auth = null;

  return Authentication.findOne({ email }).populate('user').exec()
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');

    _auth = auth;
    return pbkdf2(password, _auth.salt, PASS_ITERATIONS, PASS_LENGTH, PASS_HASH);
  })
  .then(hash => {
    if (_auth.hash !== hash.toString('hex')) {
      throw new PasswordError('password is incorrect');
    }
    const token = jwt.sign({
      id: _auth.user.id,
      role: _auth.user.role
    }, secret, {
      expiresIn: '31d'
    });

    return {
      jwt: token,
      user: _auth.user
    };
  });
}

export function reset(uw, email) {
  const Authentication = uw.model('Authentication');

  return Authentication.findOne({ email })
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');
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
    if (!token || token !== resetToken) throw new TokenError('reset token invalid');

    return generateHashPair(password, PASS_LENGTH);
  })
  .then(hashPair =>
    Authentication.findOneAndUpdate(
      { email },
      { salt: hashPair.salt, hash: hashPair.hash }
    ).exec()
  )
  .then(auth => {
    if (!auth) throw new GenericError(404, `no user with email ${email} found`);
    uw.redis.del(`reset:${email}`);
    return `updated password for ${email}`;
  });
}

export function removeSession(uw, id) {
  const Authentication = uw.model('Authentication');
  return Authentication.findOne(new ObjectId(id)).then(auth => {
    if (!auth) throw new GenericError(404, 'user not found');

    uw.publish('api-v1:socket:close', auth.id);
  });
}
