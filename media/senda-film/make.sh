#!/usr/bin/env bash
# Construye un vídeo de SENDA (guion -> validación -> voz + VTT -> MP4 + fotogramas de control).
# Uso:
#   ./make.sh                     # script.json en es + en
#   ./make.sh ruta es             # ruta.json solo en es
#   ./make.sh m95-film en         # m95-film.json en en (+ VTT es/en/nl)
#   STILLS=5,40,90,150 ./make.sh m95-film en
set -euo pipefail
cd "$(dirname "$0")"

NAME="${1:-script}"
LANG="${2:-}"
if [[ "$NAME" == "es" || "$NAME" == "en" ]]; then LANG="$NAME"; NAME="script"; fi
PFX=""; [[ "$NAME" != "script" ]] && PFX="${NAME}-"
OUTNAME="$NAME"; [[ "$NAME" == "script" ]] && OUTNAME="film"

LANGS=("es" "en")
[[ -n "$LANG" ]] && LANGS=("$LANG")

for L in "${LANGS[@]}"; do
  echo "=== [1/4] Validando ${NAME}.json [${L}] ==="
  node validate.mjs "$NAME" "$L"
done

echo "=== [2/4] Sintetizando voz (Kokoro v1.0) ==="
python3 voice.py "$NAME" ${LANG:+"$LANG"}

echo "=== [2b/4] Verificando subtítulos WebVTT ==="
for VTT in build/subtitles-${PFX}*.vtt; do
  [[ -f "$VTT" ]] && node check-vtt.mjs "$VTT"
done

echo "=== [3/4] Grabando fotogramas y mezclando MP4 ==="
JOBS="${JOBS:-2}" node render.mjs "$NAME" ${LANG:+"$LANG"}

echo "=== [4/4] Fotogramas de control ==="
IFS=',' read -ra TS <<< "${STILLS:-5,40,90,150}"
for L in "${LANGS[@]}"; do
  MP4="build/senda-${OUTNAME}-${L}.mp4"
  [[ -f "$MP4" ]] || continue
  for T in "${TS[@]}"; do
    OUT="build/check-${OUTNAME}-${L}-${T}s.png"
    ffmpeg -y -loglevel error -ss "$T" -i "$MP4" -frames:v 1 "$OUT" || true
  done
  ls -lh "$MP4" "build/subtitles-${PFX}${L}.vtt"
done
