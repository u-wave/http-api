import router from 'router';

import * as controller from '../controller/server';

export default function serverRoutes() {
  return router()
    .get('/time', (req, res) => {
      res.json(controller.getServerTime());
    });
}
