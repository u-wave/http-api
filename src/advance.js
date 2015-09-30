export default function advance(mongo, redis) {
  const Playlist = mongo.model('Playlist');
  const History = mongo.model('History');
  const Media = mongo.model('Media');
  const User = mongo.model('User');

  let _user = null;
  let _playlist = null;
  let _media = null;

  return redis.lpop('waitlist')
  .then(next => {
    if (!next) throw new GenericError(404, 'waitlist is empty');
    return User.findOne(ObjectId(next));
  })
  .then(user => {
    if (!user) throw new GenericError(404, 'user not found');
    _user = user;
    return redis.get(`playlist:{user}`);
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not activated');

    return Playlist.findOne(ObjectId(playlist));
  })
  .then(playlist => {
    if (!playlist) throw new GenericError(404, 'playlist not found');
    _playlist = playlist;

    return Media.findOne(playlist.media[0]);
  })
  .then(media => {
    if (!media) throw new GenericError(404, 'media not found');
    _media = media;

    return new History({
      'user': _user.id,
      'media': _media.id,
      'playlist': _playlist.id
    }).save();
  })
  .then(history => {
    if (!history) throw new GenericError(404, 'couldn\'t create history entry');

    redis.publish('v1', createCommand('advance', {
      'history': history.id,
      'dj': user.id,
      'media': media.id,
      'playlist': playlist.id,
      'played': Date.now()
    }));
    return new Promise(resolve => resolve(history));
  });
}