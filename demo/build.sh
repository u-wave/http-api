#!/bin/sh

git clone https://github.com/u-wave/core u-wave-core
git clone https://github.com/u-wave/u-wave-source-youtube u-wave-source-youtube
git clone https://github.com/u-wave/u-wave-source-soundcloud u-wave-source-soundcloud

cd u-wave-core && npm install && cd ..
cd u-wave-source-youtube && npm install && cd ..
cd u-wave-source-soundcloud && npm install && cd ..

npm install --no-save ./u-wave-core ../ ./u-wave-source-youtube ./u-wave-source-soundcloud
