#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p content template output
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker bulunamadi. Fedora uzerinde Docker Engine kurun." >&2
  exit 1
fi
docker build -t orioninsist-slidev -f Dockerfile ..
docker run --rm -it --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -v "$PWD:/workspace:Z" orioninsist-slidev
