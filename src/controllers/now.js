import mongoose from 'mongoose';
import Promise from 'bluebird';
import { getBooth } from './booth';
import { getPlaylists } from './playlists';
import { getServerTime } from './server';

const ObjectId = mongoose.Types.ObjectId;

export async function getState(v1, uw, id) {
  const User = uw.model('User');

  const guests = v1.getGuestCount();
  const motd = uw.getMotd();
  const playlists = getPlaylists(uw, 0, 50, id);
  const booth = getBooth(uw);
  const user = User.findOne(new ObjectId(id));
  const users = uw.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({ _id: { $in: userIDs } }));
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock')
    .then(lock => lock ? true : false);
  const activePlaylist = uw.redis.get(`playlist:${id}`);
  const time = getServerTime();

  return await Promise.props({
    motd,
    playlists,
    booth,
    user,
    users,
    guests,
    waitlist,
    waitlistLocked,
    activePlaylist,
    time
  });
}
