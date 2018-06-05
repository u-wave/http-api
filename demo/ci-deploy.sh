#!/usr/bin/env bash

if [ x"$TRAVIS_NODE_VERSION" != x"stable" ]; then
  echo "not doing deploy!"
  exit 0
fi
npm i -g now now-alias
now \
  -e SOUNDCLOUD_KEY \
  -e YOUTUBE_KEY \
  -e SECRET \
  -e REDIS_URL \
  -e MONGO_URL \
  -e DEBUG \
  -e ANNOUNCE_SECRET \
  --token $NOW_TOKEN \
  -p \
  -n u-wave-demo
now-alias \
  --name u-wave-demo \
  --alias u-wave-demo.now.sh \
  --token $NOW_TOKEN
