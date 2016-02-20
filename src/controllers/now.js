import mongoose from 'mongoose';
import Promise from 'bluebird';
import { getBooth } from './booth';
import { getPlaylists } from './playlists';

const ObjectId = mongoose.Types.ObjectId;

export function getState(uw, id) {
  const User = uw.mongo.model('User');

  const playlists = getPlaylists(uw, 0, 50, id);
  const booth = getBooth(uw);
  const user = User.findOne(new ObjectId(id));
  const users = uw.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({ _id: { $in: userIDs } }));
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock')
    .then(lock => lock ? true : false);
  const activePlaylist = uw.redis.get(`playlist:${id}`);

  return Promise.props({
    playlists,
    booth,
    user,
    users,
    waitlist,
    waitlistLocked,
    activePlaylist
  });
}
