import debug from 'debug';

import * as controller from '../controllers/staff';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:staff');

export default function staff(router) {
  router.get('/staff/global', (req, res) => {
    controller.getAllMedia(req.query.page, parseInt(req.query.limit, 10), req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });

  router.route('/staff/global/:id')
  .get((req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');
    if (!checkFields(req.body, res, ['sourceType', 'sourceID'], 'string')) return;

    controller.getMedia(req.body.sourceType, req.body.sourceID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .post((req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');
    if (!checkFields(req.body, res, ['sourceType', 'sourceID'], 'string')) return;

    controller.addMedia(req.body.sourceType, req.body.sourceID, req.uwave.keys, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .put((req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');
    if (!checkFields(req.body, res, ['sourceType', 'sourceID', 'artist', 'title'], 'string')) return;

    controller.editMedia(req.body, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  })

  .delete((req, res) => {
    if (req.user.role < 4) return res.status(403).json('you need to be at least manager to do this');
    if (!checkFields(req.body, res, ['sourceType', 'sourceID'], 'string')) return;

    controller.removeMedia(req.body.sourceType, req.body.sourceID, req.uwave.mongo)
    .then(media => res.status(200).json(media))
    .catch(e => handleError(res, e, log));
  });
}
