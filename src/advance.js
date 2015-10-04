export default function advance(mongo, redis) {
  const Playlist = mongo.model('Playlist');
  const History = mongo.model('History');
  const Media = mongo.model('Media');
  const User = mongo.model('User');

  const now = {
    'playlistID': null,
    'historyID': null,
    'userID': null,
    'media': null,
    'played': null
  };

  return redis.lpop('waitlist')
  .then(next => {
    if (!next) throw new GenericError(404, 'waitlist is empty');
    return User.findOne(ObjectId(next));
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');
    now.userID = user.id;
    return redis.get(`playlist:{user}`);
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not activated');

    return Playlist.findOne(ObjectId(playlist));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not found');
    now.playlistID = playlist.id;

    return Media.findOne(playlist.media[0]);
  })
  .then(media => {
    if (!media) throw new GenericError(404, 'media not found');
    now.media = media;

    return new History({
      'user': now.userID,
      'media': now.media.id,
      'playlist': now.playlistID
    }).save();
  })
  .then(history => {
    if (!history) throw new GenericError(404, 'couldn\'t create history entry');
    now.historyID = history.id;
    now.played = Date.now();
    return now;
  });
}