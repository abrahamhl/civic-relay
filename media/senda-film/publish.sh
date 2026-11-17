#!/usr/bin/env bash
# Publica los vídeos de media/senda-film/build/ en investor-next/public/media/
# o en investor-next/public/media/m95/ para la release Mission 9.5 (sin sobrescribir v5).
set -euo pipefail
cd "$(dirname "$0")"
DEST="../../investor-next/public/media"
DEST_M95="../../investor-next/public/media/m95"
mkdir -p "$DEST" "$DEST_M95"

publish_m95() {
  local NAME="$1"         # m95-film | m95-ruta | m95-90s | ...
  local POSTER_T="${2:-8}"
  local SRC="build/senda-${NAME}-en.mp4"
  [[ -f "$SRC" ]] || return 0
  echo "Publicando M95 $SRC -> $DEST_M95/senda-${NAME}-en.mp4 …"
  cp "$SRC" "$DEST_M95/senda-${NAME}-en.mp4"
  for SUB in en es nl; do
    [[ -f "build/subtitles-${NAME}-${SUB}.vtt" ]] && \
      cp "build/subtitles-${NAME}-${SUB}.vtt" "$DEST_M95/senda-${NAME}-${SUB}.vtt"
  done
  if [[ "$NAME" == "m95-film" ]]; then
    ffmpeg -y -loglevel error -ss "$POSTER_T" -i "$DEST_M95/senda-${NAME}-en.mp4" \
      -frames:v 1 -q:v 3 "$DEST_M95/senda-m95-film-poster.jpg"
  elif [[ "$NAME" == "m95-ruta" ]]; then
    ffmpeg -y -loglevel error -ss "$POSTER_T" -i "$DEST_M95/senda-${NAME}-en.mp4" \
      -frames:v 1 -q:v 3 "$DEST_M95/senda-m95-ruta-poster.jpg"
  fi
}

publish_m95 m95-film 8
publish_m95 m95-ruta 8
publish_m95 m95-90s 5
publish_m95 m95-60s 5
publish_m95 m95-30s 5
publish_m95 m95-vertical-45s 5
publish_m95 m95-sim-braking 5
publish_m95 m95-sim-sos 5
publish_m95 m95-sim-wrongway 5
publish_m95 m95-sim-queue 5
publish_m95 m95-sim-visibility 5
publish_m95 m95-sim-proof 5

ls -lh "$DEST_M95"/senda-m95-* 2>/dev/null || true
