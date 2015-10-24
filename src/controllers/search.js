import Promise from 'bluebird';
import debug from 'debug';
import https from 'https';

import { split } from '../utils';
import { stringify } from 'querystring';
import { GenericError } from '../errors';

const log = debug('uwave:api:v1:search');
const rxDuration = /^(?:PT)?([0-9]+?H)?([0-9]+?M)?([0-9]+?S)?/i;
const rxTitle = /[-_]/;

const sendRequest = function sendRequest(opts) {
  return new Promise((resolve, reject) => {
    https.request(opts, function(res) {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        let body = null;
        try {
          body = JSON.parse(data.join(''));
        } catch (e) {
          log(e);
          return reject('couldn\'t fetch data from youtube');
        }
        resolve(body);
      });
    }).end();
  });
};

const selectThumbnail = function selectThumbnail(thumbnails) {
  if (typeof thumbnails !== 'object') return '';

  if (typeof thumbnails.high === 'object') return thumbnails.high.url;
  if (typeof thumbnails.medium === 'object') return thumbnails.medium.url;
  if (typeof thumbnails.default === 'object') return thumbnails.default.url;
};

const parseYoutubeDuration = function parseYoutubeDuration(duration) {
  const time = duration.split(rxDuration);
  let _seconds = 0;

  for (let i = time.length - 1; i >= 0; i--) {
    if (typeof time[i] !== 'string') continue;
    const length = time[i].length;
    if (length === 0) continue;

    switch(time[i].slice(length - 1).toLowerCase()) {
      case 'h':
        const hours = parseInt(time[i].slice(0, length), 10);
        if (isNaN(hours)) break;
        _seconds += hours*60*60;
      break;

      case 'm':
        const minutes = parseInt(time[i].slice(0, length), 10);
        if (isNaN(minutes)) break;
        _seconds += minutes*60;
      break;

      case 's':
        const seconds = parseInt(time[i].slice(0, length), 10);
        if (isNaN(seconds)) break;
        _seconds += seconds;
      break;
    }
  }

  return _seconds;
};

const getRegionRestriction = function getRegionRestriction(contentDetails) {
  if (contentDetails.regionRestriction) {
    return contentDetails.regionRestriction.blocked || [];
  } else {
    return [];
  }
};

const splitTitle = function splitTitle(title) {
  const metadata = title.split(rxTitle);

  if (metadata.length < 2) {
    const median = title.length/2;
    const idx = title.indexOf(' ', median/2);

    if (idx > 0) {
      metadata[0] = title.slice(0, idx).trim();
      metadata[1] = title.slice(idx + 1).trim();
    } else {
      metadata[0] = title;
      metadata[1] = '';
    }
  }

  return metadata;
};

const convertSoundcloudMedia = function convertSoundcloudMedia(media) {
  const title = splitTitle(media.title);

  return {
    'sourceType': 'soundcloud',
    'sourceID': media.id,
    'artist': title[0],
    'title': title[1],
    'duration': Math.ceil(parseInt(media.duration / 1000, 10)),
    'thumbnail': media.artwork_url || media.waveform_url,
    'nsfw': false,
    'restricted': []
  };
};

const convertYoutubeMedia = function convertYoutubeMedia(item) {
  const title = splitTitle(item.snippet.title);

  return {
    'sourceType': 'youtube',
    'sourceID': item.id,
    'artist': title[0],
    'title': title[1],
    'duration': parseYoutubeDuration(item.contentDetails.duration),
    'thumbnail': selectThumbnail(item.snippet.thumbnails),
    'nsfw': typeof item.contentDetails.contentRating === 'object',
    'restricted': getRegionRestriction(item.contentDetails)
  };
};

export const fetchMediaYoutube = function fetchMediaYoutube(ids, key) {
  const params = stringify({
    'part': 'snippet,contentDetails',
    'key': key,
    'id': Array.isArray(ids) ? ids.join(',') : ids
  });

  const opts = {
    'host': 'www.googleapis.com',
    'path': ['/youtube/v3/videos?', params].join('')
  };

  return sendRequest(opts)
  .then(media => {
    const _media = [];

    if (!Array.isArray(media.items) || media.items.length === 0) {
      return [];
    }

    for (let i = 0, l = media.items.length; i < l; i++) {
      if (!media.items[i].snippet || !media.items[i].contentDetails) continue;

      _media.push(convertYoutubeMedia(media.items[i]));
    }

    return _media;
  });
};

export const fetchMediaSoundcloud = function fetchMediaSoundcloud(id, key) {
  const params = stringify({
    'client_id': key
  });

  const opts = {
    'host': 'api.soundcloud.com',
    'path': ['/tracks/', id, '?', params].join('')
  };

  return sendRequest(opts)
  .then(media => {
    if (!media) null;
    const title = splitTitle(media.title);

    return convertSoundcloudMedia(media);
  });
};

export const fetchMedia = function fetchMedia(sourceType, sourceID, keys) {
  switch(sourceType.toLowerCase()) {
    case 'youtube':
      return fetchMediaYoutube([sourceID], keys.youtube)
      .then(media => {
        if (!media || media.length === 0) throw new GenericError(404, 'media not found');
        return media[0];
      });

    case 'soundcloud':
      return fetchMediaSoundcloud(sourceID, keys.soundcloud);

    default:
      return Promise.reject(new GenericError(404, 'unknown provider'));
  }
};

export const searchYoutube = function searchYoutube(query, key) {
  const params = stringify({
    'q': query,
    'key': key,
    'safeSearch': 'moderate',
    'videoSyndicated': true,
    'part': 'snippet',
    'order': 'rating',
    'maxResults': 25,
    'type': 'video'
  });

  const opts = {
    'host': 'www.googleapis.com',
    'path': ['/youtube/v3/search?', params].join('')
  };

  return sendRequest(opts)
  .then(body => {
    const ids = [];

    if (!Array.isArray(body.items)) return [];

    for (let i = 0, l = body.items.length; i < l; i++) {
      ids.push(body.items[i].id.videoId);
    }

    return fetchMediaYoutube(ids, key);
  });
};

export const searchSoundcloud = function searchSoundcloud(query, key) {
  const params = stringify({
    'client_id': key,
    'q': query,
    'limit': 25
  });

  const opts = {
    'host': 'api.soundcloud.com',
    'path': '/tracks?' + params
  };

  return sendRequest(opts)
  .then(body => {
    const items = [];

    for (let i = 0, l = body.length; i < l; i++) {
      items.push(convertSoundcloudMedia(body[i]));
    }
    return items;
  });
};

export const search = function search(query, keys, uwave) {
  return Promise.props({
    'youtube': searchYoutube(query, keys.youtube),
    'soundcloud': searchSoundcloud(query, keys.soundcloud)
  });
};
