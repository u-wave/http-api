import debug from 'debug';

import * as controller from '../controllers/chat';
import handleError from '../errors';
import checkFields from '../utils';

const log = debug('uwave:api:v1:chat');

export default function chat(router) {
  router.delete('/chat', (req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');

    controller.chatDelete(req.user, req.uwave.redis);
    res.status(200).json('ok');
  });

  router.delete('/chat/:id', (req, res) => {
    // TODO: identify whom the message is from
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');

    controller.chatDelete(req.user, req.uwave.redis, req.params.id);
    res.status(200).json('ok');
  });
}
