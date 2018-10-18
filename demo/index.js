#!/usr/bin/env node

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */
const { Buffer } = require('buffer');
const ytSource = require('u-wave-source-youtube');
const scSource = require('u-wave-source-soundcloud');
const recaptchaTestKeys = require('recaptcha-test-keys');
const express = require('express');
const cors = require('cors');
const { createHttpApi, createSocketServer } = require('u-wave-http-api');
const uwave = require('u-wave-core');
const announce = require('u-wave-announce');

/**
 * üWave API demo server.
 */

const port = 6043;

const uw = uwave({
  redis: process.env.REDIS_URL,
  mongo: process.env.MONGO_URL,
});

uw.source(ytSource, {
  key: process.env.YOUTUBE_KEY,
});
uw.source(scSource, {
  key: process.env.SOUNDCLOUD_KEY,
});

uw.use(announce({
  name: 'üWave Demo',
  subtitle: 'Bleeding edge demo server',
  url: 'https://demo.u-wave.net/',
  apiUrl: 'https://u-wave-demo.now.sh/api',
  socketUrl: 'wss://u-wave-demo.now.sh',
  seed: Buffer.from(process.env.ANNOUNCE_SECRET, 'hex'),
}));

uw.motd.set('This is the demo server for üWave! Everything is much slower than on a real instance, because its databases run on free services across the world.');

const app = express();
const server = app.listen(port, () => {
  console.log(`Now listening on ${port}`);
});

app.use(cors({
  origin(origin, cb) {
    cb(null, true);
  },
}));
app.set('json spaces', 2);

const apiUrl = '/api';
const apiSecret = Buffer.from(process.env.SECRET, 'hex');

createSocketServer(uw, {
  server,
  secret: apiSecret,
});

app.use(apiUrl, createHttpApi(uw, {
  recaptcha: { secret: recaptchaTestKeys.secret },
  secret: apiSecret,
}));
