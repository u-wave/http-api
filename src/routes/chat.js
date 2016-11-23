import createRouter from 'router';

import protect from '../middleware/protect';
import toItemResponse from '../utils/toItemResponse';
import { ROLE_MODERATOR } from '../roles';

export default function chatRoutes() {
  const router = createRouter();

  router.delete('/', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      {},
      { moderator: req.user },
    );
    res.status(200).json(toItemResponse({}));
  });

  router.delete('/user/:id', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      { userID: req.params.id },
      { moderator: req.user },
    );
    res.status(200).json(toItemResponse({}));
  });

  router.delete('/:id', protect(ROLE_MODERATOR), (req, res) => {
    req.uwave.deleteChat(
      { id: req.params.id },
      { moderator: req.user },
    );
    res.status(200).json(toItemResponse({}));
  });

  return router;
}
