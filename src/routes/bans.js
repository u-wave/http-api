import router from 'router';

import protect from '../middleware/protect';
import { ROLE_MODERATOR, ROLE_MANAGER } from '../roles';
import * as controller from '../controllers/bans';
import getOffsetPagination from '../utils/getOffsetPagination';
import toItemResponse from '../utils/toItemResponse';
import toPaginatedResponse from '../utils/toPaginatedResponse';

export default function banRoutes() {
  return router()
    .get('/', protect(ROLE_MODERATOR), (req, res, next) => {
      const uw = req.uwave;
      const { filter } = req.query;
      const pagination = getOffsetPagination(req.query);
      controller.getBans(uw, filter, pagination)
        .then(bans => toPaginatedResponse(bans, {
          baseUrl: req.fullUrl,
          included: {
            user: ['user', 'moderator'],
          },
        }))
        .then(page => res.json(page))
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
        .then(ban => toItemResponse(ban))
        .then(item => res.json(item))
        .catch(next);
    })

    .delete('/:userID', protect(ROLE_MANAGER), (req, res, next) => {
      const uw = req.uwave;
      const moderatorID = req.user.id;
      const { userID } = req.params;
      controller.removeBan(uw, userID, { moderatorID })
        .then(toItemResponse)
        .then(result => res.json(result))
        .catch(next);
    });
}
