import debug from 'debug';

import * as controller from '../controllers/booth';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:booth');

export default function booth(router) {
  router.get('/booth', (req, res) => {
    controller.getBooth(req.uwave)
    .then(booth => res.status(200).json(booth))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/skip', (req, res) => {
    if (req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');

    if (!checkFields(req.body, res, ['userID', 'reason'], 'string')) return;

    controller.skipBooth(req.user.id, req.body.userID, req.body.reason, req.uwave)
    .then(skipped => res.status(200).json(skipped))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/replace', (req, res) => {
    if (req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');

    if (typeof req.body.userID === 'undefined') return res.status(422).json('userID is not set');

    if (typeof req.body.userID !== 'string') return res.status(422).json('userID has to be of type string');

    controller.replaceBooth(req.user.id, req.body.userID, req.uwave)
    .then(replaced => res.status(200).json(replaced))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/favorite', (req, res) => {
    if (!checkFields(req.body, res, ['playlistID', 'historyID'], 'string')) return;

    controller.favorite(req.user.id, req.body.playlistID, req.body.historyID, req.uwave)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });

  router.get('/booth/history', (req, res) => {
    controller.getHistory(parseInt(req.query.page, 10), parseInt(req.query.limit, 10), req.uwave.mongo)
    .then(history => res.status(200).json(history))
    .catch(e => handleError(res, e, log));
  });
}
