export default function (mongoose) {
  const Schema = mongoose.Schema;
  // TODO: probably should allow to embed links
  const roomSchema = new Schema({
    created: { type: Date, default: Date.now },
    name: { type: String, max: 128, required: true },
    description: { type: String, max: 512 },
    motd: { type: String, max: 128 },
    genre: { type: String, max: 128 },
    maxduration: { type: Number, default: -1 },
    host: { type: Schema.Types.ObjectId, ref: 'User' },
    media: { type: Schema.Types.ObjectId, ref: 'PlaylistItem' }
  }, {
    minimize: false
  });

  return mongoose.model('Room', roomSchema);
}
