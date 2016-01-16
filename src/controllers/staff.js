import { GenericError } from '../errors';
import { fetchMedia } from './search';

export function getAllMedia(page, limit, mongo) {
  const Media = mongo.model('Media');
  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 200 : Math.min(limit, 200);
  return Media.find({}).setOptions({ limit: _limit, skip: _limit * _page });
}

export function getMedia(sourceType, sourceID, mongo) {
  const Media = mongo.model('Media');

  return Media.find({ sourceType, sourceID })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');

    return media;
  });
}

export function addMedia(sourceType, sourceID, keys, mongo) {
  const Media = mongo.model('Media');
  return fetchMedia(sourceType, sourceID, keys)
    .then(media => new Media(media).save());
}

export function editMedia(props, keys, mongo) {
  const Media = mongo.model('Media');
  if (props.auto) {
    return fetchMedia(props.sourceType, props.sourceID, keys)
    .then(updatedMedia => {
      return Media.findOneAndUpdate(
        { sourceType: props.sourceType, sourceID: props.sourceID },
        {
          artist: updatedMedia.artist,
          title: updatedMedia.title,
          nsfw: updatedMedia.nsfw,
          restricted: updatedMedia.restricted
        }
      );
    })
    .then(media => {
      if (!media) throw new GenericError(404, 'no media found');
      return media;
    });
  }
  return Media.findOneAndUpdate(
    { sourceType: props.sourceType, sourceID: props.sourceID },
    { artist: props.artist, title: props.title, nsfw: props.nsfw, restricted: props.restricted }
  )
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
}

export function removeMedia(sourceType, sourceID, mongo) {
  const Media = mongo.model('Media');
  return Media.findOneAndRemove({ sourceType, sourceID })
  .then(media => {
    if (!media) throw new GenericError(404, 'no media found');
    return media;
  });
}
