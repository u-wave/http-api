import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const playlistSchema = new Schema({
  'created': { 'type': Date, 'default': Date.now },
  'name': { 'type': String, 'min': 0, 'max': 128, 'required': true },
  'description': { 'type': String, 'min': 0, 'max': 512, 'required': true },
  'author': { 'type': Schema.Types.ObjectId, 'required': true },
  'private': { 'type': Boolean, 'default': true },
  'nsfw': { 'type': Boolean, 'default': false },
  'media': [Number]
}, {
  'minimize': false
});

export default mongoose.model('Playlist', playlistSchema);
