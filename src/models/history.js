export default function(mongoose) {
  const Schema = mongoose.Schema;

  const historySchema = new Schema({
    'user': { 'type': Schema.Types.ObjectId, 'ref': 'User', 'required': true },
    'media': { 'type': Schema.Types.ObjectId, 'ref': 'PlaylistItem', 'required': true },
    'playlist': { 'type': Schema.Types.ObjectId, 'ref': 'Playlist', 'required': true },
    'played': { 'type': Date, 'default': Date.now },
    'upvotes': [Number],
    'downvotes': [Number],
    'favorites': [Number]
  }, {
    'minimize': false
  });

  return mongoose.model('History', historySchema);
}
