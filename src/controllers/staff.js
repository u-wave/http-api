import debug from 'debug';

import { GenericError } from '../errors';
import { fetchMedia } from './search';

const log = debug('uwave:api:v1:staff');

export function getAllMedia(page, limit, mongo) {
  const Media = mongo.model('Media');
  const _page = (isNaN(page) ? 0 : page);
  const _limit = (isNaN(limit) ? 200 : Math.min(limit, 200));
  return Media.find({}).setOptions({ 'limit': _limit, 'skip': _limit * _page });
}

export function getMedia(type, id, mongo) {
  const Media = mongo.model('Media');

  return Media.find({ 'sourceType': type, 'sourceID': id })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');

    return media;
  });
}

export function addMedia(type, id, keys, mongo) {
  const Media = mongo.model('Media');
  return fetchMedia(type, id, keys)
  .then(media => {
    return new Media(media).save();
  });
}

export function editMedia(metadata, keys, mongo) {
  const Media = mongo.model('Media');
  if (media.auto) {
    return fetchMedia(metadata.sourceType, sourceID, keys)
    .then(updatedMedia => {
      return Media.findOneAndUpdate(
        { 'sourceType': metadata.sourceType, 'sourceID': metadata.sourceID },
        { 'artist': updatedMedia.artist, 'title': updatedMedia.title, 'nsfw': updatedMedia.nsfw, 'restricted': updatedMedia.restricted }
      );
    })
    .then(media => {
      if (!media) throw new GenericError(404, 'no media found');
      return media;
    });
  }
  return Media.findOneAndUpdate(
    { 'sourceType': metadata.sourceType, 'sourceID': metadata.sourceID },
    { 'artist': metadata.artist, 'title': metadata.title, 'nsfw': metadata.nsfw, 'restricted': metadata.restricted }
  )
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
}

export function removeMedia(type, id, mongo) {
  const Media = mongo.model('Media');
  return Media.findOneAndRemove({ 'sourceType': type, 'sourceID': id })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
}
