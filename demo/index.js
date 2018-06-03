#!/usr/bin/env node

/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */
const { Buffer } = require('buffer');
const ytSource = require('u-wave-source-youtube');
const scSource = require('u-wave-source-soundcloud');
const recaptchaTestKeys = require('recaptcha-test-keys');
const express = require('express');
const cors = require('cors');
const createWebApi = require('u-wave-http-api');
const uwave = require('u-wave-core');

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

uw.on('ready', () => {
  uw.motd.set('This is the demo server for üWave! Everything is much slower than on a real instance, because its databases run on free services across the world.');
});

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

app.use(apiUrl, createWebApi(uw, {
  recaptcha: { secret: recaptchaTestKeys.secret },
  server,
  secret: Buffer.from(process.env.SECRET, 'hex'),
}));
