import router from 'router';

import * as controller from '../controllers/server';
import toItemResponse from '../utils/toItemResponse';

export default function serverRoutes() {
  return router()
    .get('/time', (req, res) => {
      res.json(toItemResponse({
        time: controller.getServerTime(),
      }));
    });
}
