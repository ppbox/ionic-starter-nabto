#!/bin/bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/..

if [ ! -d node_modules ]; then
    npm install
fi

ionic platform add ios

ionic prepare ios

# fix linker problem when using Nabto lib
echo 'OTHER_LDFLAGS = -force_load $(BUILT_PRODUCTS_DIR)/libCordova.a -lstdc++' >> platforms/ios/cordova/build.xcconfig

ionic build ios
