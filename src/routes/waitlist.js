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
    if (!checkFields(req.body, res, ['userID', 'position'], ['string', 'number'])) return;

    if (!req.body.userID) return res.status(422).json('userID is not set');

    if (req.user.id !== req.body.userID && req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.joinWaitlist(req.user.id, req.body.userID, req.body.position, req.user.role >= 3, req.uwave)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  })

  /* ========== WAITLIST[DELETE] ========== */
  .delete((req, res) => {
    if (req.user.role < 3) return res.status(403).json('you need to be at least a manager to do this');

    controller.clearWaitlist(req.user.id, req.uwave.redis)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST MOVE ========== */
  router.put('/waitlist/move', (req, res) => {
    if (!checkFields(req.body, res, ['userID', 'position'], ['string', 'number'])) return;

    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.moveWaitlist(req.user.id, req.body.userID, req.body.position, req.uwave)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST :ID ========== */
  router.delete('/waitlist/:id', (req, res) => {
    if (req.user.id !== req.params.id && req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.leaveWaitlist(req.user.id, req.params.id, req.uwave)
    .then(waitlist => res.status(200).json(waitlist))
    .catch(e => handleError(res, e, log));
  });

  /* ========== WAITLIST LOCK ========== */
  router.put('/waitlist/lock', (req, res) => {
    if (!checkFields(req.body, res, ['lock', 'clear'], 'boolean')) return;
    if (req.user.role < 3) {
      return res.status(403).json('you need to be at least a bouncer to do this');
    }

    controller.lockWaitlist(req.user.id, req.body.lock, req.body.clear, req.uwave.redis)
    .then(state => res.status(200).json(state))
    .catch(e => handleError(res, e, log));
  });
}
