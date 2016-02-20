import * as controller from '../controllers/chat';

export default function chatRoutes(router) {
  router.delete('/chat', (req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }

    controller.chatDelete(req.uwave, req.user);
    res.status(200).json('deleted chat');
  });

  router.delete('/chat/user/:id', (req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }

    controller.chatDeleteByUser(req.uwave, req.user, req.params.id);
    res.status(200).json(`deleted chat ${req.params.id}`);
  });

  router.delete('/chat/:id', (req, res) => {
    if (req.user.role < 4) {
      return res.status(403).json('you need to be at least manager to do this');
    }

    controller.chatDeleteByID(req.uwave, req.user, req.params.id);
    res.status(200).json(`deleted chat by user ${req.params.id}`);
  });
}
