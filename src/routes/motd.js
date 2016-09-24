import router from 'router';
import protect from '../middleware/protect';
import toItemResponse from '../utils/toItemResponse';
import { ROLE_MANAGER } from '../roles';

export default function motdRoutes() {
  return router()
    .get('/', (req, res, next) => {
      req.uwave.getMotd()
        .then(motd => toItemResponse({ motd }))
        .then(item => res.json(item))
        .catch(next);
    })
    .put('/', protect(ROLE_MANAGER), (req, res, next) => {
      req.uwave.setMotd(String(req.body.motd))
        .then(() => req.uwave.getMotd())
        .then(motd => toItemResponse({ motd }))
        .then(item => res.json(item))
        .catch(next);
    });
}
