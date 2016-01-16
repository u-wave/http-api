export default function (mongoose) {
  const Schema = mongoose.Schema;

  const playlistItemSchema = new Schema({
    media: { type: Schema.Types.ObjectId, ref: 'Media', required: true },
    artist: { type: String, max: 128, required: true },
    title: { type: String, max: 128, required: true },
    start: { type: Number, min: 0, default: 0 },
    end: { type: Number, min: 0, default: 0 }
  }, {
    minimize: false
  });

  return mongoose.model('PlaylistItem', playlistItemSchema);
}
