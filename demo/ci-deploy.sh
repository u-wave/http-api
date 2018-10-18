#!/usr/bin/env bash

if [ x"$TRAVIS_NODE_VERSION" != x"stable" ]; then
  echo "not doing deploy!"
  exit 0
fi

set -o pipefail
set -o errexit
set -o nounset
set -o xtrace

npm install -g now now-alias

now \
  -e SOUNDCLOUD_KEY \
  -e YOUTUBE_KEY \
  -e SECRET \
  -e REDIS_URL \
  -e MONGO_URL \
  -e DEBUG \
  -e ANNOUNCE_SECRET \
  -p \
  --token $NOW_TOKEN
now alias \
  --token $NOW_TOKEN

now rm u-wave-demo --safe --yes \
  --token $NOW_TOKEN
