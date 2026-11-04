#!/usr/bin/env bash
# Copia la película renderizada a la web: mp4 (≤ ~35 MB), póster y subtítulos es/en/nl.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; dst="$here/../../investor-next/public/media"; mkdir -p "$dst"
for l in es en; do
  [ -f "$here/out/senda-film-$l.mp4" ] || { echo "falta senda-film-$l.mp4"; exit 1; }
  cp "$here/out/senda-film-$l.mp4" "$dst/senda-film-$l.mp4"
  ffmpeg -loglevel error -y -ss 26 -i "$here/out/senda-film-$l.mp4" -frames:v 1 -q:v 4 "$dst/senda-film-poster-$l.jpg"
done
cp "$here/out/subtitles-es.vtt" "$dst/senda-film-es.vtt"
cp "$here/out/subtitles-en.vtt" "$dst/senda-film-en.vtt"
cp "$here/out/subtitles-nl.vtt" "$dst/senda-film-nl.vtt"
ls -la "$dst"
