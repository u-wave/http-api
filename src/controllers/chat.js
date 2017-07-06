import toItemResponse from '../utils/toItemResponse';

export function deleteAll(req) {
  req.uwave.deleteChat(
    {},
    { moderator: req.user },
  );
  return toItemResponse({});
}

export function deleteByUser(req) {
  req.uwave.deleteChat(
    { userID: req.params.id },
    { moderator: req.user },
  );
  return toItemResponse({});
}

export function deleteMessage(req) {
  req.uwave.deleteChat(
    { id: req.params.id },
    { moderator: req.user },
  );
  return toItemResponse({});
}
