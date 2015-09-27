export default function(mongoose) {
  const Schema = mongoose.Schema;

  const playlistSchema = new Schema({
    'created': { 'type': Date, 'default': Date.now },
    'name': { 'type': String, 'min': 0, 'max': 128, 'required': true },
    'description': { 'type': String, 'min': 0, 'max': 512, 'required': true },
    'author': { 'type': Schema.Types.ObjectId, 'required': true },
    'shared': { 'type': Boolean, 'default': false },
    'nsfw': { 'type': Boolean, 'default': false },
    'media': [Number]
  }, {
    'minimize': false
  });

  return mongoose.model('Playlist', playlistSchema);
}
