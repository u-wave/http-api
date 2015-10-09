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

export const generateHashPair = function generateHashPair(password, length) {
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
};

export const getCurrentUser = function getCurrentUser(id, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id));
};

export const createUser = function createUser(email, username, password, mongo) {
  const User = mongo.model('User');
  const Authentication = mongo.model('Authentication');
  let _auth = null;

  log(`creating new user ${username}`);
  const user = new User({'username': username});

  return user.validate()
  .then(() => {
    return generateHashPair(password, PASS_LENGTH);
  })
  .then(hashPair => {
    _auth = new Authentication({
      'user': user.id,
      'email': email,
      'hash': hashPair.hash,
      'salt': hashPair.salt
    });
    return _auth.save();
  })
  .then(() => {
    return user.save();
  })
  .then(() => {
    return user;
  },
  e => {
    log(`did not create user ${username}. Error: ${e}`);
    if (_auth) _auth.remove();
    user.remove();
    throw e;
  });
};

export const login = function login(email, password, secret, uwave) {
  const Authentication = uwave.mongo.model('Authentication');
  let _auth = null;

  return Authentication.findOne({'email': email}).populate('user').exec()
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');

    _auth = auth;
    return pbkdf2(password, _auth.salt, PASS_ITERATIONS, PASS_LENGTH, PASS_HASH);
  })
  .then(hash => {
    if (_auth.hash === hash.toString('hex')) {
      const token = jwt.sign({
        'id': _auth.user.id,
        'role': _auth.user.role
      }, secret, {
        'expiresIn': '31d'
      });

      return {
        'jwt': token,
        'user': _auth.user
      };
    } else {
      throw new PasswordError('password is incorrect');
    }
  });
};

export const reset = function reset(email, uwave) {
  const Authentication = uwave.mongo.model('Authentication');

  return Authentication.findOne({'email': email})
  .then(auth => {
    if (!auth) throw new GenericError(404, 'no user found');
    return randomBytes(64);
  })
  .then(buf => {
    const token = buf.toString('hex');
    uwave.redis.set(`reset:${email}`, token);
    uwave.redis.expire(`reset${email}`, 24*60*60);
    return token;
  });
};

export const changePassword = function changePassword(email, password, reset, uwave) {
  const Authentication = uwave.mongo.model('Authentication');

  return uwave.redis.get(`reset:${email}`)
  .then(token => {
    if (!token || token !== reset) throw new TokenError('reset token invalid');

    return generateHashPair(password, PASS_LENGTH);
  })
  .then(hashPair => {
    return Authentication.findOneAndUpdate(
      { 'email': email },
      {
        'salt': hashPair.salt,
        'hash': hashPair.hash
      }
    ).exec();
  })
  .then(auth => {
    if (!auth) throw new GenericError(404, `no user with email ${email} found`);
    uwave.redis.del(`reset:${email}`);
    return `updated password for ${email}`;
  });
};

export const removeSession = function removeSession(id, uwave) {
  const Authentication = uwave.mongo.model('Authentication');
  return Authentication.findOne(ObjectId(id))
  .then(auth => {
    uwave.redis.publish('v1p', createCommand('closeSocket', id));
  });
};
