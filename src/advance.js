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
    if (!userID) throw new GenericError(404, 'waitlist is empty');

    return User.findOne(new ObjectId(userID));
  })
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

    now.media = playlist.media.shift();
    playlist.media.push(now.media);
    playlist.save();

    return PlaylistItem.findOne(now.media).populate('media');
  })
  .then(media => {
    if (!media) throw new GenericError(404, 'media not found');
    now.media = media;

    return new History({
      user: now.userID,
      media: now.media.id,
      playlist: now.playlistID
    }).save();
  })
  .then(history => {
    if (!history) throw new GenericError(404, 'history not found');

    now.historyID = history.id;
    now.played = Date.now();
    return now;
  });
}
