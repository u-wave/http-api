import mongoose from 'mongoose';
import Promise from 'bluebird';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import debug from 'debug';

import { PasswordError, TokenError, GenericError } from '../errors';

const PASS_LENGTH = 256;
const PASS_ITERATIONS = 2048;
const PASS_HASH = 'sha256';
const SECRET = 'test';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:auth');
const pbkdf2 = Promise.promisify(crypto.pbkdf2);
const randomBytes = Promise.promisify(crypto.randomBytes);

export const generateHash = function generateHashPair(password, length) {
  const hashPair = {
    hash: null,
    salt: null
  };

  return new Promise((resolve, reject) => {
    return randomBytes(length)
    .then(buf => {
      hashPair.salt = buf.toString('hex');
      return pbkdf2(password, hashPair.salt, PASS_ITERATIONS, length, PASS_HASH);
    })
    .then(salted => {
      hashPair.hash = salted.toString('hex');
      resolve(hashPair);
    })
    .catch(e => {
      log(e);
      reject(new GenericError(402, 'couldn\'t create password'));
    });
  });
};

export const createUser = function createUser(data) {
  const User = mongoose.model('User');
  const Authentication = mongoose.model('Authentication');
  let _auth = null;

  log(`creating new user ${data.username}`);
  const user = new User({'username': data.username});

  return user.validate()
  .then(() => {
    return generateHashPair(data.password, PASS_LENGTH);
  })
  .then(hashPair => {
    _auth = new Authentication({
      'user': user.id,
      'email': data.email,
      'hash': hashPair.hash,
      'salt': hashPair.salt
    });
    return _auth.save();
  })
  .then(() => {
    return user.save();
  })
  .then(() => {
    // better to keep the routes clean and solve the duplicate error here
    return new Promise(resolve => resolve(user));
  },
  e => {
    log(`did not create user ${data.username}. Err: ${e}`);
    if (_auth) _auth.remove();
    user.remove();
    throw e;
  });
};

export const login = function login(email, password, redis) {
  const Authentication = mongoose.model('Authentication');
  let _auth = null;

  return Authentication.findOne({ 'email': email }).populate('user').exec()
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');

    _auth = auth;
    return pbkdf2(password, _auth.salt, PASS_ITERATIONS, PASS_LENGTH, PASS_HASH);
  })
  .then(hash => {
    return new Promise((resolve, reject) => {
      if (_auth.hash === hash.toString('hex')) {
        const token = jwt.sign(_auth.user.id, SECRET);
        redis.hmset(
          `user:${token}`,
          'id', _auth.user.id,
          'username', _auth.user.username,
          'role', _auth.user.role
        );
        redis.expire(`user:${token}`, 30*24*60*60);
        resolve(token);
      } else {
        reject(new PasswordError('password is incorrect'));
      }
    });
  });
};

export const reset = function reset(email, redis) {
  const Authentication = mongoose.model('Authentication');

  return Authentication.findOne({ 'email': email })
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');
    return randomBytes(64);
  })
  .then(buf => {
    return new Promise(resolve => {
      const token = buf.toString('hex');
      redis.set(`reset:${email}`, token);
      redis.expire(`reset${email}`, 24*60*60);
      resolve(token);
    });
  });
};

export const changePassword = function changePassword(data, reset, redis) {
  const Authentication = mongoose.model('Authentication');

  return redis.get(`reset:${data.email}`)
  .then(token => {
    if (!token || token !== reset) throw new TokenError('reset token invalid');

    return generateHashPair(data.password, PASS_LENGTH);
  })
  .then(hashPair => {
    return Authentication.findOneAndUpdate(
      { 'email': data.email },
      {
        'salt': hashPair.salt,
        'hash': hashPair.hash
      }
    ).exec();
  })
  .then(auth => {
    return new Promise((resolve, reject) => {
      if (!auth) {
        reject(new GenericError(404, `no user with email ${data.email} found`));
      } else {
        redis.del(`reset:${data.email}`);
        resolve(`updated password for ${data.email}`);
      }
    });
  });
};

export const removeSession = function removeSession(id, token, redis) {
  const Authentication = mongoose.model('Authentication');
  return Authentication.findOne(ObjectId(id))
  .then(auth => {
    redis.del(`user:${token}`);
    return redis.hgetall(`user:${token}`);
  });
};
