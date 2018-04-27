#!/usr/bin/env bash

if [ x"$TRAVIS_NODE_VERSION" != x"stable" ]; then
  echo "not doing deploy!"
  exit 0
fi
npm i -g now
now -e SOUNDCLOUD_KEY -e YOUTUBE_KEY -e SECRET -e REDIS_URL -e MONGO_URL -e DEBUG --token $NOW_TOKEN --alias u-wave-demo.now.sh
