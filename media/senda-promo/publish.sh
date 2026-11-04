#!/usr/bin/env bash
# Comprime y copia a la web la película (16:9) y los reels (9:16): mp4 con faststart, póster y subtítulos.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; dst="$here/../../investor-next/public/media/promo"; mkdir -p "$dst"
for f in "$here"/out/investor-*.mp4 "$here"/out/reel-*.mp4; do
  [ -f "$f" ] || continue; b="$(basename "$f" .mp4)"; name="$b"; [[ "$b" == investor-* ]] && name="senda-$b"
  if [[ "$b" == investor-* ]]; then crf=26; poster=8; else crf=27; poster=4; fi
  ffmpeg -loglevel error -y -i "$f" -c:v libx264 -preset slow -crf "$crf" -pix_fmt yuv420p -c:a aac -b:a 112k -movflags +faststart "$dst/$name.mp4"
  ffmpeg -loglevel error -y -ss "$poster" -i "$f" -frames:v 1 -vf "scale='min(1280,iw)':-2" -q:v 4 "$dst/$name.jpg"
  [ -f "$here/out/$b.vtt" ] && cp "$here/out/$b.vtt" "$dst/$name.vtt"
done
ls -la "$dst"; du -sh "$dst"
