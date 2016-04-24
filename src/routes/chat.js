import createRouter from 'router';

import protect from '../middleware/protect';
import { ROLE_MODERATOR } from '../roles';

export default function chatRoutes() {
  const router = createRouter();

  router.delete('/', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      {},
      { moderator: req.user }
    );
    res.status(200).json('deleted chat');
  });

  router.delete('/user/:id', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      { userID: req.params.id },
      { moderator: req.user }
    );
    res.status(200).json(`deleted chat ${req.params.id}`);
  });

  router.delete('/:id', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      { id: req.params.id },
      { moderator: req.user }
    );
    res.status(200).json(`deleted chat by user ${req.params.id}`);
  });

  return router;
}
