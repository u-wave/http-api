import { PermissionError } from '../errors';

export default function requireActiveConnection() {
  async function isConnected(uwave, user) {
    const onlineIDs = await uwave.redis.lrange('users', 0, -1);
    return onlineIDs.indexOf(user.id) !== -1;
  }

  return (req, res, next) => {
    isConnected(req.uwave, req.user)
      .then((connected) => {
        if (!connected) {
          throw new PermissionError('You need to be logged in and connected to do this.');
        }
      })
      .then(() => next())
      .catch(next);
  };
}
