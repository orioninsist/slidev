#!/usr/bin/env bash

slidev() {
  docker run --rm -it \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "$PWD:/work:Z" \
    -w /work \
    -p 3030:3030 \
    slidev-native "$@"
}
