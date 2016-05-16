import createRouter from 'router';
import * as url from 'url';

import protect from '../middleware/protect';
import { checkFields } from '../utils';
import { serializePlaylist } from '../utils/serialize';
import { HTTPError } from '../errors';

const parseNumber = (str, defaultN) => {
  const n = parseInt(str, 10);
  return isFinite(n) ? n : defaultN;
};

const getFullUrl = req => `${req.protocol}://${req.get('host')}${req.originalUrl}`;

const appendQuery = (base, query) => {
  const parsed = url.parse(base, true);
  Object.assign(parsed.query, query);
  return url.format(parsed);
};

const toPaginatedResponse = (page, { baseUrl = '' } = {}) => ({
  meta: {
    offset: page.currentPage.offset,
    pageSize: page.pageSize,
    results: page.filteredSize,
    total: page.totalSize
  },
  links: {
    self: appendQuery(baseUrl, { page: page.currentPage }),
    next: appendQuery(baseUrl, { page: page.nextPage }),
    prev: appendQuery(baseUrl, { page: page.prevPage })
  },
  data: page.data
});

const getOffsetPagination = (query, defaultSize = 100) => {
  if (typeof query.page === 'object') {
    return {
      offset: parseNumber(query.page.offset, 0),
      limit: parseNumber(query.page.limit, defaultSize)
    };
  }
  // Old way: using a `page=` and a `limit=` query parameter.
  const page = parseNumber(query.page, 0);
  const limit = parseNumber(query.limit, defaultSize);
  return {
    offset: page * limit,
    limit
  };
};

export default function playlistRoutes() {
  const router = createRouter().use(protect());

  router.get('/', (req, res, next) => {
    req.user.getPlaylists()
      .then(playlists => playlists.map(serializePlaylist))
      .then(playlists => res.json(playlists))
      .catch(next);
  });

  router.post('/', (req, res, next) => {
    if (!checkFields(res, req.body, { name: 'string' })) {
      return;
    }

    req.user.createPlaylist({
      name: req.body.name,
      description: req.body.description,
      shared: req.body.shared
    })
      .then(serializePlaylist)
      .then(playlist => res.json(playlist))
      .catch(next);
  });

  router.get('/:id', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(serializePlaylist)
      .then(playlist => res.json(playlist))
      .catch(next);
  });

  router.delete('/:id', (req, res, next) => {
    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.deletePlaylist(playlist))
      .then(result => res.json(result))
      .catch(next);
  });

  const patchableKeys = ['name', 'shared', 'description'];
  router.patch('/:id', (req, res, next) => {
    const patches = Object.keys(req.body);
    for (const patchKey of patches) {
      if (patchableKeys.indexOf(patchKey) === -1) {
        next(new HTTPError(400, `Key "${patchKey}" cannot be updated.`));
        return;
      }
    }

    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, req.body))
      .then(serializePlaylist)
      .then(playlist => res.json(playlist))
      .catch(next);
  });

  router.put('/:id/rename', (req, res, next) => {
    if (!checkFields(res, req.body, { name: 'string' })) {
      return;
    }

    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, { name: req.body.name }))
      .then(serializePlaylist)
      .then(playlist => res.json(playlist))
      .catch(next);
  });

  router.put('/:id/share', (req, res, next) => {
    if (!checkFields(res, req.body, { shared: 'string' })) {
      return;
    }

    const uw = req.uwave;

    req.user.getPlaylist(req.params.id)
      .then(playlist => uw.playlists.updatePlaylist(playlist, { shared: req.body.shared }))
      .then(serializePlaylist)
      .then(playlist => res.json(playlist))
      .catch(next);
  });

  router.put('/:id/move', (req, res, next) => {
    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.moveItems(items, { afterID: after }))
      .then(result => res.json(result))
      .catch(next);
  });

  router.put('/:id/activate', (req, res, next) => {
    req.user.setActivePlaylist(req.params.id)
      .then(() => res.json({}))
      .catch(next);
  });

  router.get('/:id/media', (req, res, next) => {
    const filter = req.query.filter || null;

    const pagination = getOffsetPagination(req.query);

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.getItems(filter, pagination))
      .then(page => toPaginatedResponse(page, { baseUrl: getFullUrl(req) }))
      .then(page => res.json(page))
      .catch(next);
  });

  router.post('/:id/media', (req, res, next) => {
    if (!checkFields(res, req.body, { items: 'object' })) {
      return;
    }

    const { after, items } = req.body;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array.'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.addItems(items, { after }))
      .then(patch => res.json(patch))
      .catch(next);
  });

  router.delete('/:id/media', (req, res, next) => {
    const items = req.query.items || req.body.items;
    if (!Array.isArray(items)) {
      next(new HTTPError(422, 'Expected "items" to be an array'));
      return;
    }

    req.user.getPlaylist(req.params.id)
      .then(playlist =>
        playlist.removeItems(items).then(() => playlist)
      )
      .then(playlist => res.json({
        playlistSize: playlist.size
      }))
      .catch(next);
  });

  router.get('/:id/media/:itemID', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.getItem(req.params.itemID))
      .then(item => res.json(item))
      .catch(next);
  });

  router.put('/:id/media/:itemID', (req, res, next) => {
    if (!checkFields(res, req.body, {
      artist: 'string',
      title: 'string',
      start: 'number',
      end: 'number'
    })) {
      return null;
    }

    const patch = {
      artist: req.body.artist,
      title: req.body.title,
      start: req.body.start,
      end: req.body.end
    };

    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.updateItem(req.params.itemID, patch))
      .then(item => res.json(item))
      .catch(next);
  });

  router.delete('/:id/media/:mediaID', (req, res, next) => {
    req.user.getPlaylist(req.params.id)
      .then(playlist => playlist.removeItem(req.params.mediaID))
      .then(removed => res.json(removed))
      .catch(next);
  });

  return router;
}
