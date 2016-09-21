import Promise from 'bluebird';
import { getBooth } from './booth';
import { getServerTime } from './server';

import { serializePlaylist } from '../utils/serialize';

export async function getState(v1, uw, user) {
  const User = uw.model('User');

  const guests = v1.getGuestCount();
  const motd = uw.getMotd();
  const booth = getBooth(uw);
  const users = uw.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({ _id: { $in: userIDs } }));
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock')
    .then(lock => lock ? true : false);
  const activePlaylist = user ? user.getActivePlaylistID() : null;
  const playlists = user ? user.getPlaylists() : null;
  const time = getServerTime();

  const state = await Promise.props({
    motd,
    booth,
    user,
    users,
    guests,
    waitlist,
    waitlistLocked,
    activePlaylist,
    playlists,
    time,
  });

  if (state.playlists) {
    state.playlists = state.playlists.map(serializePlaylist);
  }

  return state;
}
