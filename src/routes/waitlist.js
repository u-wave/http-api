import createRouter from 'router';

import protect from '../middleware/protect';
import requireActiveConnection from '../middleware/requireActiveConnection';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/waitlist';
import { PermissionError } from '../errors';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

export default function waitlistRoutes() {
  const router = createRouter();

  router.get('/', (req, res, next) => {
    controller.getWaitlist(req.uwave)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(next);
  });

  router.post('/',
    protect(),
    requireActiveConnection(),
    checkFields({ userID: 'string' }),
    (req, res, next) => {
      let position = parseInt(req.body.position, 10);
      position = isFinite(position) ? position : -1;

      if (position >= 0) {
        next(new PermissionError('You need to be a moderator to do this.'));
        return;
      }

      const targetID = req.body.userID;
      const isModerator = req.user.role >= ROLE_MODERATOR;

      const promise = position < 0
        ? controller.appendToWaitlist(req.uwave, targetID, isModerator)
        : controller.insertWaitlist(req.uwave, req.user.id, targetID, position, isModerator);
      promise
        .then(waitlist => res.status(200).json(waitlist))
        .catch(next);
    }
  );

  router.delete('/', protect(ROLE_MANAGER), (req, res, next) => {
    controller.clearWaitlist(req.uwave, req.user.id)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(next);
  });

  router.put('/move', protect(ROLE_MODERATOR), checkFields({
    userID: 'string',
    position: 'number',
  }), (req, res, next) => {
    controller.moveWaitlist(req.uwave, req.user.id, req.body.userID, req.body.position)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(next);
  });

  router.delete('/:id', protect(), (req, res, next) => {
    let promise;
    if (req.user.id !== req.params.id) {
      if (req.user.role < ROLE_MODERATOR) {
        next(new PermissionError('You need to be a moderator to do this'));
        return;
      }
      promise = controller.removeFromWaitlist(req.uwave, req.params.id, req.user.id);
    } else {
      promise = controller.leaveWaitlist(req.uwave, req.user.id);
    }

    promise
      .then(waitlist => res.status(200).json(waitlist))
      .catch(next);
  });

  router.put('/lock', protect(ROLE_MODERATOR), checkFields({
    lock: 'boolean',
  }), (req, res, next) => {
    controller.lockWaitlist(req.uwave, req.user.id, req.body.lock)
      .then(state => res.status(200).json(state))
      .catch(next);
  });

  return router;
}
