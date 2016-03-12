import { createCommand } from '../sockets';

export function sendChatMessage(uw, user, message) {
  const userID = typeof user === 'object' ? user._id : user;
  uw.publish('chat:message', {
    userID, message,
    timestamp: Date.now()
  });
}

export function chatDelete(uw, id) {
  uw.redis.publish('v1', createCommand('chatDelete', { moderatorID: id }));
}

export function chatDeleteByID(uw, id, chatID) {
  uw.redis.publish('v1', createCommand('chatDeleteByID', {
    chatID,
    moderatorID: id
  }));
}

export function chatDeleteByUser(uw, id, userID) {
  uw.redis.publish('v1', createCommand('chatDeleteByUser', {
    userID,
    moderatorID: id
  }));
}
