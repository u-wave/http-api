import mongoose from 'mongoose';
import Promise from 'bluebird';
import debug from 'debug';
import https from 'https';

import { createCommand } from '../sockets';
import { GenericError } from '../errors';

const ObjectId = mongoose.Types.ObjectId;
const log = debug('uwave:api:v1:search');
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
        'thumbnail': selectThumbnail(body.items[i].snippet.thumbnails)
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
        'thumbnail': body[i].artwork_url || body[i].waveform_url
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
