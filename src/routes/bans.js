import router from 'router';

import protect from '../middleware/protect';
import { ROLE_MODERATOR, ROLE_MANAGER } from '../roles';
import * as controller from '../controllers/bans';

export default function banRoutes() {
  return router()
    .get('/', protect(ROLE_MODERATOR), (req, res, next) => {
      const uw = req.uwave;
      const { filter, page, limit } = req.query;
      controller.getBans(uw, filter, { page, limit })
        .then(bans => res.json(bans))
        .catch(next);
    })

    .post('/', protect(ROLE_MODERATOR), (req, res, next) => {
      const uw = req.uwave;
      const moderatorID = req.user.id;
      const {
        duration = 0,
        userID,
        permanent = false,
      } = req.body;

      controller.addBan(uw, userID, { moderatorID, duration, permanent })
        .then(ban => res.json(ban))
        .catch(next);
    })

    .delete('/:userID', protect(ROLE_MANAGER), (req, res, next) => {
      const uw = req.uwave;
      const moderatorID = req.user.id;
      const { userID } = req.params;
      controller.removeBan(uw, userID, { moderatorID })
        .then(result => res.json(result))
        .catch(next);
    });
}
