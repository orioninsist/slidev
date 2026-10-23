#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p content output

if ! command -v docker >/dev/null 2>&1; then
  echo "Hata: Docker bulunamadi." >&2
  exit 1
fi

if ! command -v fzf >/dev/null 2>&1; then
  echo "Hata: fzf bulunamadi." >&2
  exit 1
fi

mapfile -d '' -t markdowns < <(
  find content -maxdepth 1 -type f -name '*.md' \
    -printf '%f\0' | sort -z
)

if (( ${#markdowns[@]} == 0 )); then
  echo "Hata: content/ klasorunde Markdown bulunamadi." >&2
  exit 1
fi

echo "=== Markdown Secimi ==="

SLIDEV_CONTENT="$(
  printf '%s\n' "${markdowns[@]}" |
    fzf --height=40% --reverse --border \
        --prompt='Markdown > ' --header='Ok tuslari ile sec, Enter ile onayla'
)" || exit 0

[ -n "$SLIDEV_CONTENT" ] || exit 0

echo "=== Format Secimi ==="

SLIDEV_FORMAT="$(
  printf '%s\n' \
    'PDF' \
    'PPTX' \
    'PPTX Editable' \
    'PNG' \
    'MD' \
    'HTML/SPA' \
    'MP4 (5 sn/slayt)' |
    fzf --height=40% --reverse --border \
        --prompt='Format > ' --header='Ok tuslari ile sec, Enter ile onayla'
)" || exit 0

[ -n "$SLIDEV_FORMAT" ] || exit 0

echo
echo "Markdown: $SLIDEV_CONTENT"
echo "Format:   $SLIDEV_FORMAT"
echo

docker build -t orioninsist-slidev -f Dockerfile ..

export SLIDEV_CONTENT SLIDEV_FORMAT

docker run --rm -it \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e SLIDEV_CONTENT \
  -e SLIDEV_FORMAT \
  -v "$PWD:/workspace:Z" \
  orioninsist-slidev
