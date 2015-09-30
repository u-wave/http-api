import debug from 'debug';

import * as controller from '../controllers/booth';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:booth');

export default function booth(router) {
  router.get('/booth', (req, res) => {
    controller.getBooth()
    .then(booth => res.status(200).json(booth))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/skip', (req, res) => {
    if (req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');

    if (!checkFields(req.body, res, ['userID', 'reason'])) return;

    const _userID = String(req.body.userID);
    const _reason = String(req.body.reason);

    controller.skipBooth(req.user.id, _userID, _reason, req.uwave.mongo, req.uwave.redis)
    .then(skipped => res.status(200).json(skipped))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/replace', (req, res) => {
    if (req.user.role < 3) return res.status(412).json('you need to be at least bouncer to do this');

    const _userID = String(req.body.userID);

    controller.replaceBooth(req.user.id, _userID, req.uwave.mongo, req.uwave.redis)
    .then(replaced => res.status(200).json(replaced))
    .catch(e => handleError(res, e, log));
  });

  router.post('/booth/favorite', (req, res) => {
    if (!checkFields(req.body, res, ['mediaID', 'historyID', 'playlistID'])) return;

    const data = {
      'user': req.user,
      'mediaID': String(req.body.mediaID),
      'historyID': String(req.body.historyID),
      'playlistID': String(req.body.playlistID)
    };

    controller.favorite(data, req.uwave.mongo, req.uwave.redis)
    .then(playlist => res.status(200).json(playlist))
    .catch(e => handleError(res, e, log));
  });
}
