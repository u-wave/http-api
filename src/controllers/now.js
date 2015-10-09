import mongoose from 'mongoose';
import { getBooth } from './booth';

const ObjectId = mongoose.Types.ObjectId;

export const getState = function getState(id, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  const User = uwave.mongo.model('User');
  const state = {
    'playlists': null,
    'waitlist': null,
    'users': null,
    'booth': null,
    'user': null
  };

  return Playlist.find({ 'author': ObjectId(id) })
  .then(playlists => {
    state.playlists = playlists;
    return User.findOne(ObjectId(id));
  })
  .then(myself => {
    state.user = myself;
    return uwave.redis.lrange('users', 0, -1);
  })
  .then(users => {
    return User.find({'_id': { '$in': users }});
  })
  .then(users => {
    state.users = users;
    return uwave.redis.lrange('waitlist', 0, -1);
  })
  .then(waitlist => {
    state.waitlist = waitlist;
    return getBooth(uwave);
  })
  .then(booth => {
    if (booth.historyID) state.booth = booth;

    return state;
  });
};
