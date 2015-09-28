import mongoose from 'mongoose';
import Promise from 'bluebird';
import debug from 'debug';

import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:users');

export const getUsers = function getUsers(mongo) {
  const User = mongo.model('User');

  return User.find();
};

export const getUser = function getUser(id, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id));
};

export const banUser = function banUser(id, time, exiled, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    user.banned = time;
    user.exiled = exiled;
    // TODO: websocket
    return user.save();
  });
};

export const muteUser = function muteUser(id, time, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    return new Promise(resolve => {
      // TODO: websocket
      resolve(time > 0 ? true : false);
    });
  });
};

export const changeRole = function changeRole(user, id, role, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    user.role = Math.min(Math.max(role, 6), 0);
    return user.save();
  });
};

export const changeUsername = function changeUsername(user, id, name, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);
    if (user.id !== id && user.role < 3) {
      throw new GenericError(403, 'you need to be at least a bouncer to do this');
    }

    user.username = name;
    user.slug = name.toLowerCase();

    return user.save();
  });
};

export const setStatus = function setStatus(user, status, mongo) {
  const User = mongo.model('User');

  return User.findOne(ObjectId(id))
  .then(user => {
    if (!user) throw new GenericError(404, `user with ID ${id} not found`);

    user.status = Math.min(Math.max(status, 3), 0);
    return user.save();
  });
};