import props from 'p-props';
import { getBoothData } from './booth';
import { serializePlaylist } from '../utils/serialize';

async function getFirstItem(user, activePlaylist) {
  const id = await activePlaylist;
  if (id) {
    try {
      const playlist = await user.getPlaylist(id);
      if (playlist) {
        const item = await playlist.getItemAt(0);
        return item;
      }
    } catch (e) {
      // Nothing
    }
  }
  return null;
}

function toInt(str) {
  if (typeof str !== 'string') return 0;
  if (!/^\d+$/.test(str)) return 0;
  return parseInt(str, 10);
}

// eslint-disable-next-line import/prefer-default-export
export async function getState(req) {
  const uw = req.uwave;
  const { authRegistry, passport } = req.uwaveHttp;
  const { user } = req;

  const User = uw.model('User');

  const motd = uw.getMotd();
  const users = uw.redis.lrange('users', 0, -1)
    .then(userIDs => User.find({ _id: { $in: userIDs } }));
  const guests = uw.redis.get('http-api:guests').then(toInt);
  const roles = uw.acl.getAllRoles();
  const booth = getBoothData(uw);
  const waitlist = uw.redis.lrange('waitlist', 0, -1);
  const waitlistLocked = uw.redis.get('waitlist:lock').then(Boolean);
  const activePlaylist = user ? user.getActivePlaylistID() : null;
  const playlists = user ? user.getPlaylists() : null;
  const firstActivePlaylistItem = activePlaylist ? getFirstItem(user, activePlaylist) : null;
  const socketToken = user ? authRegistry.createAuthToken(user) : null;
  const authStrategies = passport.strategies();
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
