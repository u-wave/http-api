import { createCommand } from '../sockets';

export const chatDelete = function chatDelete(user, redis, id = -1) {
  redis.publish('v1', createCommand('chatDelete', {
    'moderatorID': user.id,
    'chatID': id
  }));
}