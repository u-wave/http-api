import debug from 'debug';

import * as controller from '../controllers/chat';

const log = debug('uwave:api:v1:chat');

export default function chat(router) {
  router.delete('/chat', (req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');

    controller.chatDelete(req.user, req.uwave.redis);
    res.status(200).json('deleted chat');
  });

  router.delete('/chat/user/:id', (req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');

    controller.chatDeleteByUser(req.user, req.params.id, req.uwave.redis);
    res.status(200).json(`deleted chat ${req.params.id}`);
  });

  router.delete('/chat/:id', (req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');

    controller.chatDeleteByID(req.user, req.params.id, req.uwave.redis);
    res.status(200).json(`deleted chat by user ${req.params.id}`);
  });
}
