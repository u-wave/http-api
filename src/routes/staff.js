import createRouter from 'router';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/staff';
import { HTTPError } from '../errors';
import { ROLE_MANAGER } from '../roles';

export default function staffRoutes() {
  const router = createRouter();

  router.get('/media', protect(ROLE_MANAGER), (req, res, next) => {
    const { page, limit } = req.query;
    controller.getAllMedia(req.uwave, parseInt(page, 10), parseInt(limit, 10))
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.get('/media/:id', protect(ROLE_MANAGER), checkFields({
    sourceType: 'string',
    sourceID: 'string',
  }), (req, res, next) => {
    controller.getMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.post('/media/:id', protect(ROLE_MANAGER), checkFields({
    sourceType: 'string',
    sourceID: 'string',
  }), (req, res, next) => {
    controller.addMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.put('/media/:id', protect(ROLE_MANAGER), checkFields({
    sourceType: 'string',
    sourceID: 'string',
    artist: 'string',
    title: 'string',
  }), (req, res, next) => {
    // TODO fix this thing again.
    // It's supposed to accept EITHER:
    //  - sourceType, sourceID, artist, title
    // OR:
    //  - sourceType, sourceID, {auto: true}
    // When auto === true, the artist and title are retrieved from the media
    // source.
    // Currently we can't validate that nicely up-front (and this route is so
    // far unused anyway), see issue #117.
    if (!req.body.auto) {
      if (!Array.isArray(req.body.restricted)) {
        next(new HTTPError(422, 'restricted: Expected an array of strings'));
        return;
      }
    } else if (
      // Look how broken this is! omg
      !checkFields({
        sourceType: 'string',
        sourceID: 'string',
        auto: 'boolean',
      })
    ) {
      next(new HTTPError(422,
        'expected sourceType to be a string, sourceID to be a string and auto to be boolean',
      ));
      return;
    }

    controller.editMedia(req.uwave, req.body)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  router.delete('/media/:id', protect(ROLE_MANAGER), checkFields({
    sourceType: 'string',
    sourceID: 'string',
  }), (req, res, next) => {
    controller.removeMedia(req.uwave, req.body.sourceType, req.body.sourceID)
      .then(media => res.status(200).json(media))
      .catch(next);
  });

  return router;
}
