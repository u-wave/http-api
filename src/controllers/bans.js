export function isBanned(uw, user) {
  return uw.bans.isBanned(user);
}

export function getBans(uw, filter = null, pagination = {}) {
  const offset = isFinite(pagination.offset) ? pagination.offset : 0;
  const limit = isFinite(pagination.limit) ? pagination.limit : 50;

  return uw.bans.getBans(filter, { offset, limit });
}

export function addBan(uw, user, { duration, moderatorID, permanent = false }) {
  return uw.bans.ban(user, {
    duration,
    moderator: moderatorID,
    permanent,
  });
}

export function removeBan(uw, user, { moderatorID }) {
  return uw.bans.unban(user, { moderator: moderatorID });
}
