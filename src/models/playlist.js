export default function (mongoose) {
  const Schema = mongoose.Schema;

  const playlistSchema = new Schema({
    created: { type: Date, default: Date.now },
    name: { type: String, min: 0, max: 128, required: true },
    description: { type: String, min: 0, max: 512 },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    shared: { type: Boolean, default: false },
    nsfw: { type: Boolean, default: false },
    media: [{ type: Schema.Types.ObjectId, ref: 'PlaylistItem' }]
  }, {
    minimize: false
  });

  return mongoose.model('Playlist', playlistSchema);
}
