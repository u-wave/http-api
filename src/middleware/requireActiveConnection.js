import { PermissionError } from '../errors';

export default function requireActiveConnection() {
  return (req, res, next) => {
    req.uwave.sessions.isOnline(req.user)
      .then((connected) => {
        if (!connected) {
          throw new PermissionError('You need to be logged in and connected to do this.');
        }
      })
      .then(() => next())
      .catch(next);
  };
}
