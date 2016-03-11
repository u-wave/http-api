import createRouter from 'router';

import protect from '../middleware/protect';
import * as controller from '../controllers/chat';
import { ROLE_MODERATOR } from '../roles';

export default function chatRoutes() {
  const router = createRouter();

  router.delete('/', protect(ROLE_MODERATOR), (req, res) => {
    controller.chatDelete(req.uwave, req.user);
    res.status(200).json('deleted chat');
  });

  router.delete('/user/:id', protect(ROLE_MODERATOR), (req, res) => {
    controller.chatDeleteByUser(req.uwave, req.user, req.params.id);
    res.status(200).json(`deleted chat ${req.params.id}`);
  });

  router.delete('/:id', protect(ROLE_MODERATOR), (req, res) => {
    controller.chatDeleteByID(req.uwave, req.user, req.params.id);
    res.status(200).json(`deleted chat by user ${req.params.id}`);
  });

  return router;
}
