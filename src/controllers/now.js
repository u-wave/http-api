import props from 'p-props';
import { getBoothData } from './booth';
import { serializePlaylist } from '../utils/serialize';

async function getFirstItem(user, activePlaylist) {
  const id = await activePlaylist;
  if (id) {
    try {
      const playlist = await user.getPlaylist(id);
      if (playlist) {
        return playlist.getItemAt(0);
      }
    } catch (e) {}
  }
  return null;
}

// eslint-disable-next-line import/prefer-default-export
export async function getState(req) {
  const uw = req.uwave;
  const api = req.uwaveHttp;
  const { user } = req;

  const User = uw.model('User');

  const motd = uw.getMotd();
  const users = uw.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({ _id: { $in: userIDs } }));
  const guests = api.getGuestCount();
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock').then(Boolean);
  const activePlaylist = user ? user.getActivePlaylistID() : null;
  const playlists = user ? user.getPlaylists() : null;
  const firstActivePlaylistItem = activePlaylist ? getFirstItem(user, activePlaylist) : null;
  const socketToken = user ? api.sockets.createAuthToken(user) : null;
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
    firstActivePlaylistItem,
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
