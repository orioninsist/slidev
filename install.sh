#!/usr/bin/env bash

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_LINE="source \"$REPO_DIR/slidev-docker.sh\""

if ! grep -Fqx "$SOURCE_LINE" "$HOME/.bashrc"; then
  printf '\n%s\n' "$SOURCE_LINE" >> "$HOME/.bashrc"
fi

echo "Installed. Run: source ~/.bashrc"
