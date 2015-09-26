import debug from 'debug';

import checkFields from '../utils';

const log = debug('uwave:api:v1:chat');

export default function chat(router) {
  router.delete('/chat', (req, res) => {
    // TODO: websocket
  });

  router.delete('/chat/:uuid', (req, res) => {
    // TODO: websocket
  });
}
