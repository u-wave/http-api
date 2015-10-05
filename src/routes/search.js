import debug from 'debug';

import * as controller from '../controllers/search';
import checkFields from '../utils';
import handleError from '../errors';

const log = debug('uwave:api:v1:search');

export default function search(keys, router) {
  router.get('/search', (req, res) => {
    controller.search(req.query.query, keys)
    .then(results => res.status(200).json(results))
    .catch(e => handleError(res, e, log));
  });
}
