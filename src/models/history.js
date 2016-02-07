export default function (mongoose) {
  const Schema = mongoose.Schema;

  const arrayOfUsers = [{ type: Schema.Types.ObjectId, ref: 'User' }];

  const historySchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    playlist: { type: Schema.Types.ObjectId, ref: 'Playlist' },
    item: { type: Schema.Types.ObjectId, ref: 'PlaylistItem' },
    media: {
      media: { type: Schema.Types.ObjectId, ref: 'Media', required: true },
      artist: String,
      title: String,
      start: { type: Number, default: 0 },
      end: { type: Number, default: 0 }
    },
    played: { type: Date, default: Date.now },
    upvotes: arrayOfUsers,
    downvotes: arrayOfUsers,
    favorites: arrayOfUsers
  }, {
    minimize: false
  });

  return mongoose.model('History', historySchema);
}
