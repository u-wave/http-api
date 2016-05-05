import router from 'router';
import protect from '../middleware/protect';
import { ROLE_MANAGER } from '../roles';

export default function motdRoutes() {
  return router()
    .get('/', (req, res, next) => {
      req.uwave.getMotd()
        .then(motd => res.json({ motd }))
        .catch(next);
    })
    .put('/', protect(ROLE_MANAGER), (req, res, next) => {
      req.uwave.setMotd(String(req.body.motd))
        .then(() => req.uwave.getMotd())
        .then(motd => res.json({ motd }))
        .catch(next);
    });
}
