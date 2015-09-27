import debug from 'debug';

import * as controller from '../controllers/waitlist';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:waitlist');

export default function waitlist(router) {
  router.route('/waitlist')
  /* ========== WAITLIST[GET] ========== */
  .get((req, res) => {
    controller.getWaitlist(req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  })

  /* ========== WAITLIST[POST] ========== */
  .post((req, res) => {
    if (!req.body.userID) return res.status(422).json('userID is not set');

    if (req.user.id !== req.body.userID && req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    const _userID = String(req.body.userID);
    const _position = req.body.position ? parseInt(req.body.position, 10) : null;

    controller.joinWaitlist(_userID, _position, req.user.role >= 3, req.uwave.mongo, req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  })

  /* ========== WAITLIST[DELETE] ========== */
  .delete((req, res) => {
    if (req.user.role < 3) return res.status(403).json('you need to be at least a manager to do this');

    controller.clearWaitlist(req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST MOVE ========== */
  router.put('/waitlist/move', (req, res) => {
    if (!checkFields(req.body, res, ['userID', 'position'])) return;

    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    const _userID = String(req.body.userID);
    const _position = parseInt(req.body.position, 10);

    controller.moveWaitlist(_userID, _position, req.uwave.mongo, req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST :ID ========== */
  router.delete('/waitlist/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.leaveWaitlist(req.params.id, req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST LOCK ========== */
  router.put('/waitlist/lock', (req, res) => {
    if (!checkFields(req.body, res, ['lock', 'clear'])) return;
    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    const _lock = req.body.lock ? true : false;
    const _clear = req.body.clear ? true : false;

    controller.lockWaitlist(_lock, _clear, req.uwave.redis)
    .then(state => res.status(200).json(state))
    .catch(e => handleError(res, e, log));
  });
}
