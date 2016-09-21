import debug from 'debug';
import createRouter from 'router';

import protect from '../middleware/protect';
import requireActiveConnection from '../middleware/requireActiveConnection';
import * as controller from '../controllers/waitlist';
import { checkFields } from '../utils';
import { handleError } from '../errors';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

const log = debug('uwave:api:v1:waitlist');

export default function waitlistRoutes() {
  const router = createRouter();

  router.get('/', (req, res) => {
    controller.getWaitlist(req.uwave)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.post('/', protect(), requireActiveConnection(), (req, res) => {
    if (!req.body.userID) {
      res.status(422).json('userID is not set');
      return;
    }
    let position = parseInt(req.body.position, 10);
    position = isFinite(position) ? position : -1;

    if (position >= 0) {
      res.status(403).json('you need to be at least bouncer to do this');
      return;
    }

    const targetID = req.body.userID;
    const isModerator = req.user.role >= ROLE_MODERATOR;

    const promise = position < 0
      ? controller.appendToWaitlist(req.uwave, targetID, isModerator)
      : controller.insertWaitlist(req.uwave, req.user.id, targetID, position, isModerator);
    promise
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.delete('/', protect(ROLE_MANAGER), (req, res) => {
    controller.clearWaitlist(req.uwave, req.user.id)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.put('/move', protect(ROLE_MODERATOR), (req, res) => {
    if (!checkFields(res, req.body, { userID: 'string', position: 'number' })) {
      return;
    }

    controller.moveWaitlist(req.uwave, req.user.id, req.body.userID, req.body.position)
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.delete('/:id', protect(), (req, res) => {
    let promise;
    if (req.user.id !== req.params.id) {
      if (req.user.role < ROLE_MODERATOR) {
        res.status(403).json('you need to be at least a moderator to do this');
        return;
      }
      promise = controller.removeFromWaitlist(req.uwave, req.params.id, req.user.id);
    } else {
      promise = controller.leaveWaitlist(req.uwave, req.user.id);
    }

    promise
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.put('/lock', protect(ROLE_MODERATOR), (req, res, next) => {
    if (!checkFields(res, req.body, { lock: 'boolean' })) {
      return;
    }

    controller.lockWaitlist(req.uwave, req.user.id, req.body.lock)
      .then(state => res.status(200).json(state))
      .catch(err => next(err));
  });

  return router;
}
