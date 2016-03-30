import { NotFoundError } from '../errors';
import { fetchMedia } from './search';

export function getAllMedia(uw, page, limit) {
  const Media = uw.model('Media');
  const _page = isNaN(page) ? 0 : page;
  const _limit = isNaN(limit) ? 200 : Math.min(limit, 200);
  return Media.find({}).setOptions({ limit: _limit, skip: _limit * _page });
}

export function getMedia(uw, sourceType, sourceID) {
  const Media = uw.model('Media');

  return Media.find({ sourceType, sourceID })
  .then(media => {
    if (!media) throw new NotFoundError('Media not found.');

    return media;
  });
}

export function addMedia(uw, sourceType, sourceID) {
  const Media = uw.model('Media');

  return fetchMedia(sourceType, sourceID, uw.keys)
    .then(media => new Media(media).save());
}

export function editMedia(uw, props) {
  const Media = uw.model('Media');
  if (props.auto) {
    return fetchMedia(props.sourceType, props.sourceID, uw.keys)
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
      if (!media) throw new NotFoundError('Media not found.');
      return media;
    });
  }
  return Media.findOneAndUpdate(
    { sourceType: props.sourceType, sourceID: props.sourceID },
    { artist: props.artist, title: props.title, nsfw: props.nsfw, restricted: props.restricted }
  )
  .then(media => {
    if (!media) throw new NotFoundError('Media not found.');
    return media;
  });
}

export function removeMedia(uw, sourceType, sourceID) {
  const Media = uw.model('Media');
  return Media.findOneAndRemove({ sourceType, sourceID })
  .then(media => {
    if (!media) throw new NotFoundError('Media not found.');
    return media;
  });
}
