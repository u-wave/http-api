import mongoose from 'mongoose';

import { GenericError } from './errors';

const ObjectId = mongoose.Types.ObjectId;

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

  return redis.lpop('waitlist')
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

        return new History({
          user: now.userID,
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
