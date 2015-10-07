import Promise from 'bluebird';
import debug from 'debug';
import https from 'https';

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

const queryBuilder = function queryBuilder(options) {
  const keys = Object.keys(options);
  const query = [];

  for (let i = keys.length - 1; i >= 0; i--) {
    query.push('&', keys[i], '=', encodeURIComponent(options[keys[i]]));
  }

  // remove the first ampersand
  return query.join('').slice(1);
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
        if (hours === NaN) break;
        _seconds += hours*60*60;
      break;

      case 'm':
        const minutes = parseInt(time[i].slice(0, length), 10);
        if (minutes === NaN) break;
        _seconds += minutes*60;
      break;

      case 's':
        const seconds = parseInt(time[i].slice(0, length), 10);
        if (seconds === NaN) break;
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

export const fetchMediaYoutube = function fetchMediaYoutube(id, key) {
  const params = queryBuilder({
    'part': 'snippet,contentDetails',
    'key': key,
    'id': id
  });

  const opts = {
    'host': 'www.googleapis.com',
    'path': '/youtube/v3/videos?' + params
  };

  return sendRequest(opts)
  .then(media => {
    if (
      !Array.isArray(media.items) || media.items.length === 0 ||
      !media.items[0].snippet || !media.items[0].contentDetails
    ) throw new GenericError(404, 'media not found');
    const title = splitTitle(media.items[0].snippet.title);

    return {
      'sourceType': 'youtube',
      'sourceID': id,
      'artist': title[0],
      'title': title[1],
      'duration': parseYoutubeDuration(media.items[0].contentDetails.duration),
      'thumbnail': selectThumbnail(media.items[0].snippet.thumbnails),
      'nsfw': typeof media.items[0].contentDetails.contentRating === 'object',
      'restricted': getRegionRestriction(media.items[0].contentDetails)
    };
  });
};

export const fetchMediaSoundcloud = function fetchMediaSoundcloud(id, key) {
  const params = queryBuilder({
    'client_id': key
  });

  const opts = {
    'host': 'api.soundcloud.com',
    'path': ['/tracks/', id, '?', params].join('')
  };

  return sendRequest(opts)
  .then(media => {
    if (!media) throw new GenericError(404, 'media not found');
    const title = splitTitle(media.title);

    return {
      'sourceType': 'soundcloud',
      'sourceID': id,
      'artist': title[0],
      'title': title[1],
      'duration': Math.ceil(parseInt(media.duration / 1000, 10)),
      'thumbnail': media.artwork_url || media.waveform_url,
      'nsfw': false,
      'restricted': []
    };
  });
};

export const fetchMedia = function fetchMedia(sourceType, sourceID, keys) {
  switch(sourceType.toLowerCase()) {
    case 'youtube':
      return fetchMediaYoutube(sourceID, keys.youtube);

    case 'soundcloud':
      return fetchMediaSoundcloud(sourceID, keys.soundcloud);

    default:
      return new Promise((resolve, reject) => reject(new GenericError(404, 'unknown provider')));
  }
};

export const searchYoutube = function searchYoutube(query, key) {
  const params = queryBuilder({
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
    'path': '/youtube/v3/search?' + params
  };

  return sendRequest(opts)
  .then(body => {
    const items = [];

    if (!Array.isArray(body.items)) return [];

    for (let i = 0, l = body.items.length; i < l; i++) {
      const title = splitTitle(body.items[i].snippet.title);

      items.push({
        'sourceType': 'youtube',
        'sourceID': body.items[i].id.videoId,
        'artist': title[0],
        'title': title[1],
        'thumbnail': selectThumbnail(body.items[i].snippet.thumbnails),
        'nsfw': typeof media.items[i].contentDetails.contentRating === 'object',
        'restricted': getRegionRestriction(media.items[0].contentDetails)
      });
    }

    return items;
  })
};

export const searchSoundcloud = function searchSoundcloud(query, key) {
  const params = queryBuilder({
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
      const title = splitTitle(body[i].title);

      items.push({
        'sourceType': 'soundcloud',
        'sourceID': body[i].id,
        'artist': title[0],
        'title': title[1],
        'thumbnail': body[i].artwork_url || body[i].waveform_url,
        'nsfw': false,
        'restricted': []
      });
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
