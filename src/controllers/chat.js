import { createCommand } from '../sockets';

export const chatDelete = function chatDelete(id, redis) {
  redis.publish('v1', createCommand('chatDelete', { 'moderatorID': id }));
};

export const chatDeleteByID = function chatDeleteByID(id, chatID, redis) {
  redis.publish('v1', createCommand('chatDeleteByID', {
    'moderatorID': id,
    'chatID': chatID
  }));
};

export const chatDeleteByUser = function chatDeleteByUser(id, userID, redis) {
  redis.publish('v1', createCommand('chatDeleteByUser', {
    'moderatorID': id,
    'userID': userID
  }));
};
