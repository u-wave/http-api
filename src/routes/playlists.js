import router from 'router';

import route from '../route';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/playlists';

export default function playlistRoutes() {
  return router()
    .use(protect())

    .get(
      '/',
      route(controller.getPlaylists),
    )
    .post(
      '/',
      checkFields({ name: 'string' }),
      route(controller.createPlaylist),
    )

    // Individual playlists
    .get(
      '/:id',
      route(controller.getPlaylist),
    )
    .delete(
      '/:id',
      route(controller.deletePlaylist),
    )
    .patch(
      '/:id',
      route(controller.updatePlaylist),
    )
    // Playlist actions
    .put(
      '/:id/rename',
      checkFields({ name: 'string' }),
      route(controller.renamePlaylist),
    )
    .put(
      '/:id/share',
      checkFields({ shared: 'string' }),
      route(controller.sharePlaylist),
    )
    .put(
      '/:id/activate',
      route(controller.activatePlaylist),
    )
    .get(
      '/:id/media',
      route(controller.getPlaylistItems),
    )
    .post(
      '/:id/media',
      checkFields({ items: 'object' }),
      route(controller.addPlaylistItems),
    )
    .delete(
      '/:id/media',
      route(controller.removePlaylistItems),
    )
    .put(
      '/:id/move',
      route(controller.movePlaylistItems),
    )
    .post(
      '/:id/shuffle',
      route(controller.shufflePlaylistItems),
    )
    // Playlist items
    .get(
      '/:id/media/:itemID',
      route(controller.getPlaylistItem),
    )
    .put(
      '/:id/media/:itemID',
      checkFields({
        artist: 'string',
        title: 'string',
        start: 'number',
        end: 'number',
      }),
      route(controller.updatePlaylistItem),
    )
    .delete(
      '/:id/media/:itemID',
      route(controller.removePlaylistItem),
    );
}
