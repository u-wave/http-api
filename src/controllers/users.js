import clamp from 'clamp';
import { createCommand } from '../sockets';

export function setStatus(uw, id, status) {
  uw.redis.publish('v1', createCommand('statusChange', {
    userID: id,
    status: clamp(status, 0, 3),
  }));
}

export async function getHistory(uw, id, pagination) {
  const user = await uw.getUser(id);
  return user.getHistory(pagination);
}
