#!/bin/sh

CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cd ${CURRENT_DIR}/..

npm test
npm pack

mv autometric-1*.tgz example/autometric.tgz

cd example

docker-compose up -d --build

exec docker-compose logs