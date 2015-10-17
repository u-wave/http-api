import mongoose from 'mongoose';
import Promise from 'bluebird';
import { getBooth } from './booth';
import { getPlaylists } from './playlists';

const ObjectId = mongoose.Types.ObjectId;

export const getState = function getState(id, uwave) {
  const Playlist = uwave.mongo.model('Playlist');
  const User = uwave.mongo.model('User');

  const playlists = getPlaylists(0, 50, id, uwave.mongo);
  const booth = getBooth(uwave)
    // set booth to null if nobody is playing
    .then(booth => booth.historyID ? booth : null);
  const user = User.findOne(ObjectId(id));
  const users = uwave.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({'_id': { '$in': userIDs }}));
  const waitlist = uwave.redis.lrange('waitlist', 0, -1);

  return Promise.props({
    playlists,
    booth,
    user,
    users,
    waitlist
  });
};
