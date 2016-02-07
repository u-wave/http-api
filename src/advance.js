import Promise from 'bluebird';
import mongoose from 'mongoose';
import debug from 'debug';

import { GenericError } from './errors';

const ObjectId = mongoose.Types.ObjectId;

const log = debug('uwave:advance');

function savePreviousStats(mongo, redis) {
  const History = mongo.model('History');
  return redis.get('booth:historyID')
    .then(historyID => {
      if (!historyID) {
        return null;
      }
      return History.findOne(new ObjectId(historyID));
    })
    .then(entry => {
      if (!entry) {
        return null;
      }
      return Promise.props({
        upvotes: redis.lrange('booth:upvotes', 0, -1),
        downvotes: redis.lrange('booth:downvotes', 0, -1),
        favorites: redis.lrange('booth:favorite', 0, -1)
      }).then(stats => {
        log('previous track:', entry.media.artist, '—', entry.media.title,
          `👍 ${stats.upvotes.length} ` +
          `★ ${stats.favorites.length} ` +
          `👎 ${stats.downvotes.length}`
        );

        Object.assign(entry, stats);
        return entry.save();
      });
    });
}

export default function advance(mongo, redis) {
  const PlaylistItem = mongo.model('PlaylistItem');
  const Playlist = mongo.model('Playlist');
  const History = mongo.model('History');
  const User = mongo.model('User');

  const now = {
    playlistID: null,
    historyID: null,
    userID: null,
    media: null,
    played: null
  };

  log('advancing');

  return savePreviousStats(mongo, redis)
    // Continue advancing even if stats could not be saved
    .catch(e => {
      log('Could not save play stats:');
      log(e.stack);
    })
    .then(() => redis.lpop('waitlist'))
    .then(userID => {
      if (!userID) {
        return null;
      }
      return User.findOne(new ObjectId(userID))
        .then(user => {
          if (!user) throw new GenericError(404, 'user not found');

          now.userID = user.id;
          return redis.get(`playlist:${user.id}`);
        })
        .then(playlistID => {
          if (!playlistID) throw new GenericError(404, 'playlistID not set');

          return Playlist.findOne(new ObjectId(playlistID));
        })
        .then(playlist => {
          if (!playlist) throw new GenericError(404, 'playlist not found');

          now.playlistID = playlist.id;

          const item = playlist.media.shift();
          playlist.media.push(item);
          playlist.save();

          return PlaylistItem.findOne(item).populate('media');
        })
        .then(playlistItem => {
          if (!playlistItem) {
            throw new GenericError(404, 'media not found');
          }
          now.item = playlistItem.id;
          now.media = {
            media: playlistItem.media,
            artist: playlistItem.artist,
            title: playlistItem.title,
            start: playlistItem.start,
            end: playlistItem.end
          };

          log('next track:', playlistItem.artist, '—', playlistItem.title);

          return new History({
            user: now.userID,
            playlist: now.playlistID,
            item: now.item,
            media: now.media
          }).save();
        })
        .then(history => {
          if (!history) throw new GenericError(404, 'history not found');

          now.historyID = history.id;
          now.played = Date.now();
          return now;
        });
    });
}
