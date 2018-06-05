import toItemResponse from '../utils/toItemResponse';
import toListResponse from '../utils/toListResponse';

export async function getWaitlist(req) {
  const { waitlist } = req.uwave;

  const list = await waitlist.getUserIDs();
  return toListResponse(list, { url: req.fullUrl });
}

// POST waitlist/ entry point: used both for joining the waitlist,  and for
// adding someone else to the waitlist.
export async function addToWaitlist(req) {
  const { waitlist } = req.uwave;

  const moderator = req.user;
  const { userID } = req.body;

  await waitlist.addUser(userID, { moderator });

  const updated = await waitlist.getUserIDs();
  return toListResponse(updated, { url: req.fullUrl });
}

export async function moveWaitlist(req) {
  const { waitlist } = req.uwave;

  const moderator = req.user;
  const { userID, position } = req.body;

  await waitlist.moveUser(userID, position, { moderator });

  const updated = await waitlist.getUserIDs();
  return toListResponse(updated, { url: req.fullUrl });
}

export async function removeFromWaitlist(req) {
  const { waitlist } = req.uwave;
  const moderator = req.user;
  const userID = req.params.id;

  await waitlist.removeUser(userID, { moderator });

  const updated = await waitlist.getUserIDs();
  return toListResponse(updated, { url: req.fullUrl });
}

export async function clearWaitlist(req) {
  const { waitlist } = req.uwave;
  const moderator = req.user;

  await waitlist.clear({ moderator });

  const updated = await waitlist.getUserIDs();
  return toListResponse(updated, { url: req.fullUrl });
}

export async function lockWaitlist(req) {
  const { waitlist } = req.uwave;
  const moderator = req.user;

  const { lock } = req.body;

  if (lock) {
    await waitlist.lock({ moderator });
  } else {
    await waitlist.unlock({ moderator });
  }

  return toItemResponse({ locked: lock }, { url: req.fullUrl });
}
