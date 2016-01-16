import { createCommand } from '../sockets';

export function chatDelete(id, redis) {
  redis.publish('v1', createCommand('chatDelete', { moderatorID: id }));
}

export function chatDeleteByID(id, chatID, redis) {
  redis.publish('v1', createCommand('chatDeleteByID', {
    chatID,
    moderatorID: id
  }));
}

export function chatDeleteByUser(id, userID, redis) {
  redis.publish('v1', createCommand('chatDeleteByUser', {
    userID,
    moderatorID: id
  }));
}
