import mongoose from 'mongoose';
import Promise from 'bluebird';
import debug from 'debug';

import { GenericError } from '../errors';
import { fetchMedia } from './search';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:staff');

export const getGlobalMedia = function getGlobalMedia(page, limit, mongo) {
  const GlobalMedia = mongo.model('GlobalMedia');
  const _limit = Math.min(limit, 100);
  return GlobalMedia.find({}).setOptions({ 'limit': _limit, 'skip': _limit * page });
};

export const getMedia = function getMedia(type, id, mongo) {
  const GlobalMedia = mongo.model('GlobalMedia');

  return GlobalMedia.find({ 'sourceType': type, 'sourceID': id })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');

    return media;
  });
};

export const addMedia = function addMedia(type, id, keys, mongo) {
  const GlobalMedia = mongo.model('GlobalMedia');
  return fetchMedia(type, id, keys)
  .then(media => {
    return new GlobalMedia(media).save();
  });
};

export const editMedia = function editMedia(metadata, mongo) {
  const GlobalMedia = mongo.model('GlobalMedia');
  return GlobalMedia.findOneAndUpdate(
    { 'sourceType': metadata.sourceType, 'sourceID': metadata.sourceID },
    { 'artist': metadata.artist, 'title': metadata.title }
  )
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
};

export const removeMedia = function removeMedia(type, id, mongo) {
  const GlobalMedia = mongo.model('GlobalMedia');
  return GlobalMedia.findOneAndRemove({ 'sourceType': type, 'sourceID': id })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
};
