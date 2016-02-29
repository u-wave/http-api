import debug from 'debug';
import createRouter from 'router';

import * as controller from '../controllers/waitlist';
import { checkFields } from '../utils';
import handleError from '../errors';

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
    const isModerator = req.user.role >= 2;

    const promise = _position < 0
      ? controller.appendToWaitlist(req.uwave, targetID, isModerator)
      : controller.insertWaitlist(req.uwave, req.user.id, targetID, _position, isModerator);
    promise
      .then(waitlist => res.status(200).json(waitlist))
      .catch(e => handleError(res, e, log));
  });

  router.delete('/', (req, res) => {
    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a manager to do this');
    }

    controller.clearWaitlist(req.uwave, req.user.id)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/move', (req, res) => {
    if (!checkFields(res, req.body, { userID: 'string', position: 'number' })) {
      return null;
    }

    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.moveWaitlist(req.uwave, req.user.id, req.body.userID, req.body.position)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  router.delete('/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.leaveWaitlist(req.uwave, req.user.id, req.params.id)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  router.put('/lock', (req, res) => {
    if (!checkFields(res, req.body, { lock: 'boolean', clear: 'boolean' })) {
      return null;
    }
    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.lockWaitlist(req.uwave, req.user.id, req.body.lock, req.body.clear)
    .then(state => res.status(200).json(state))
    .catch(e => handleError(res, e, log));
  });

  return router;
}
