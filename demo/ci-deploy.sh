#!/usr/bin/env bash

if [ x"$TRAVIS_NODE_VERSION" != x"stable" ]; then
  echo "not doing deploy!"
  exit 0
fi

set -o pipefail
set -o errexit
set -o nounset
set -o xtrace

cd "$(dirname "$0")"

npm install -g now now-alias

now \
  -e SOUNDCLOUD_KEY \
  -e YOUTUBE_KEY \
  -e SECRET \
  -e REDIS_URL \
  -e MONGO_URL \
  -e DEBUG \
  -e ANNOUNCE_SECRET \
  --token $NOW_TOKEN \
  -p
now alias
