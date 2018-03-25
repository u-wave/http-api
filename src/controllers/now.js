import props from 'p-props';
import { getBoothData } from './booth';

import { serializePlaylist } from '../utils/serialize';

// eslint-disable-next-line import/prefer-default-export
export async function getState(req) {
  const uw = req.uwave;
  const api = req.uwaveHttp;
  const { user } = req;

  const motd = uw.getMotd();
  const users = uw.sessions.getActiveUsers();
  const guests = api.getGuestCount();
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock').then(Boolean);
  const activePlaylist = user ? user.getActivePlaylistID() : null;
  const playlists = user ? user.getPlaylists() : null;
  const socketToken = req.authInfo ? api.sockets.createAuthToken(req.authInfo) : null;
  const authStrategies = api.passport.strategies();
  const time = Date.now();

  const state = await props({
    motd,
    user,
    users,
    guests,
    roles,
    booth,
    waitlist,
    waitlistLocked,
    activePlaylist,
    playlists,
    socketToken,
    authStrategies,
    time,
  });

  if (state.playlists) {
    state.playlists = state.playlists.map(serializePlaylist);
  }

  return state;
}
