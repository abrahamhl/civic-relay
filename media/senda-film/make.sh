#!/usr/bin/env bash
# Hace un vídeo completo de un guion: validar → voz (Kokoro) → imagen (Playwright) → mezcla → publicar.
#   ./make.sh <guion> <es|en> [publicar]
# Ejemplo: ./make.sh ruta es publicar   →  investor-next/public/media/senda-ruta-es.mp4 (+ .vtt y póster)
# Variables: KOKORO_DIR (carpeta con kokoro-v1.0.onnx y voices-v1.0.bin), CORE y E2E (cifras de pruebas
# para la escena «verify»), JOBS (procesos de render en paralelo, por defecto 3).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; name="${1:?guion}"; lang="${2:?idioma}"; pub="${3:-}"
K="${KOKORO_DIR:-$HOME/.cache/kokoro}"
[ -f "$K/kokoro-v1.0.onnx" ] && [ -f "$K/voices-v1.0.bin" ] || { echo "Faltan los modelos en $K (ver docs/handoff/07_VIDEOS_3D_RUNBOOK.md, paso 1)"; exit 1; }
node "$here/validate.mjs" "$name" "$lang"
SCRIPT="$name" python3 -I "$here/voice.py" "$K/kokoro-v1.0.onnx" "$K/voices-v1.0.bin" "$lang"
SCRIPT="$name" LANG_FILM="$lang" CORE="${CORE:-0}" E2E="${E2E:-0}" node "$here/render.mjs" "$lang"
pfx="$([ "$name" = script ] && echo "" || echo "$name-")"; base="$([ "$name" = script ] && echo film || echo "$name")"
src="$here/out/senda-$base-$lang.mp4"; echo "Vídeo: $src"
if [ "$pub" = publicar ]; then
  dst="$here/../../investor-next/public/media"; mkdir -p "$dst"
  ffmpeg -loglevel error -y -i "$src" -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -c:a copy -movflags +faststart "$dst/senda-$base-$lang.mp4"
  ffmpeg -loglevel error -y -ss 12 -i "$src" -frames:v 1 -q:v 4 "$dst/senda-$base-poster-$lang.jpg"
  cp "$here/out/subtitles-$pfx$lang.vtt" "$dst/senda-$base-$lang.vtt"
  # Subtítulos neerlandeses (tiempos de la voz inglesa), solo si voice.py acaba de generarlos en esta pasada.
  nl="$here/out/subtitles-${pfx}nl.vtt"
  if [ "$lang" = en ] && [ "$nl" -nt "$here/out/voice-$pfx$lang.wav" ]; then cp "$nl" "$dst/senda-$base-nl.vtt"; fi
  ls -la "$dst"/senda-"$base"-*
fi
