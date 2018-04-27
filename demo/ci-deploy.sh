#!/usr/bin/env bash

if [[ $TRAVIS_NODE_VERSION != "stable" ]]; then
  echo "not doing deploy!"
  exit 0
fi
npm i -g now
now demo -e SOUNDCLOUD_KEY -e YOUTUBE_KEY -e SECRET -e REDIS_URL -e MONGO_URL -e DEBUG --token $NOW_TOKEN --alias u-wave-demo.now.sh
