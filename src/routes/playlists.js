import router from 'router';
import route from '../route';
import protect from '../middleware/protect';
import checkFields from '../middleware/checkFields';
import * as controller from '../controllers/playlists';

export default function playlistRoutes() {
  return router()
    .use(protect())

    // GET /playlists/ - List playlists.
    .get(
      '/',
      route(controller.getPlaylists),
    )
    // POST /playlists/ - Create a new playlist.
    .post(
      '/',
      checkFields({ name: 'string' }),
      route(controller.createPlaylist),
    )

    // GET /playlists/:id - Get a single playlist's metadata (not items!).
    .get(
      '/:id',
      route(controller.getPlaylist),
    )
    // DELETE /playlists/:id - Delete a playlist.
    .delete(
      '/:id',
      route(controller.deletePlaylist),
    )
    // PATCH /playlists/:id - Change playlist metadata, such as the name.
    .patch(
      '/:id',
      route(controller.updatePlaylist),
    )
    // PUT /playlists/:id/rename - Rename a playlist.
    // TODO call this /playlists/:id/name
    .put(
      '/:id/rename',
      checkFields({ name: 'string' }),
      route(controller.renamePlaylist),
    )
    // PUT /playlists/:id/share - Publicise or privatise a playlist.
    .put(
      '/:id/share',
      checkFields({ shared: 'string' }),
      route(controller.sharePlaylist),
    )
    // PUT /playlists/:id/activate - Set the playlist as active.
    .put(
      '/:id/activate',
      route(controller.activatePlaylist),
    )
    // GET /playlists/:id/media - Get playlist items.
    .get(
      '/:id/media',
      route(controller.getPlaylistItems),
    )
    // POST /playlists/:id/media - Add items to a playlist.
    .post(
      '/:id/media',
      checkFields({ items: 'object' }),
      route(controller.addPlaylistItems),
    )
    // DELETE /playlists/:id/media - Delete items from a playlist.
    .delete(
      '/:id/media',
      route(controller.removePlaylistItems),
    )
    // PUT /playlists/:id/move - Move playlist items.
    // TODO This should probably not be a PUT
    .put(
      '/:id/move',
      route(controller.movePlaylistItems),
    )
    // POST /playlists/:id/shuffle - Shuffle a playlist's items.
    .post(
      '/:id/shuffle',
      route(controller.shufflePlaylistItems),
    )
    // GET /playlists/:id/media/:itemID - Get a single playlist item.
    .get(
      '/:id/media/:itemID',
      route(controller.getPlaylistItem),
    )
    // PUT /playlists/:id/media/:itemID - Change metadata for a playlist item.
    // TODO This should probably be a PATCH instead
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
    // DELETE /playlists/:id/media/:itemID - Remove an item from the playlist.
    .delete(
      '/:id/media/:itemID',
      route(controller.removePlaylistItem),
    );
}
