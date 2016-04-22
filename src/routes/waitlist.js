import debug from 'debug';
import createRouter from 'router';

import protect from '../middleware/protect';
import * as controller from '../controllers/waitlist';
import { checkFields } from '../utils';
import handleError from '../errors';
import { ROLE_MANAGER, ROLE_MODERATOR } from '../roles';

const log = debug('uwave:api:v1:waitlist');

export default function waitlistRoutes() {
  const router = createRouter();

  router.get('/', (req, res) => {
    controller.getWaitlist(req.uwave)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  router.post('/', (req, res) => {
    if (!req.body.userID) return res.status(422).json('userID is not set');
    let _position = parseInt(req.body.position, 10);
    _position = (!isNaN(_position) ? _position : -1);

    if (_position >= 0) {
      return res.status(403).json('you need to be at least bouncer to do this');
    }

    const targetID = req.body.userID;
    const isModerator = req.user.role >= ROLE_MODERATOR;

    const promise = _position < 0
      ? controller.appendToWaitlist(req.uwave, targetID, isModerator)
      : controller.insertWaitlist(req.uwave, req.user.id, targetID, _position, isModerator);
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
      return null;
    }

    controller.moveWaitlist(req.uwave, req.user.id, req.body.userID, req.body.position)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id', (req, res) => {
    let promise;
    if (req.user.id !== req.params.id) {
      if (req.user.role < ROLE_MODERATOR) {
        return res.status(403).json('you need to be at least a moderator to do this');
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
      return null;
    }

    controller.lockWaitlist(req.uwave, req.user.id, req.body.lock)
      .then(state => res.status(200).json(state))
      .catch(err => next(err));
  });

  return router;
}
