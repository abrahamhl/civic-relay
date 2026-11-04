# SENDA · Película para inversores y reels

Los vídeos se renderizan **desde las mismas demos en vivo de la portada**
(`investor-next/public/senda/home/demos.mjs`), que calculan con el núcleo probado
(`packages/senda/src`). Lo que se ve en el vídeo es lo que el visitante puede manipular en la web.

| Archivo | Qué hace |
|---|---|
| `scripts.json` | Guiones por escena (es/en): vista (demo, tarjeta, capturas reales), rótulos, frases y cambios de estado anclados a cada frase |
| `voice.py` | Narración local con Kokoro-82M v1.0 (sin servicios externos) → `out/voice-*.wav`, `out/timeline-*.js`, `out/*.vtt` |
| `promo.html` | Compositor: `window.seek(t)` dibuja el fotograma exacto (16:9 o 9:16) |
| `render.mjs` | Render determinista por tramos en paralelo + voz + música original (`media/promo-video/music.py`) |
| `publish.sh` | Compresión web, pósteres y subtítulos → `investor-next/public/media/promo/` |

## Regenerar

```bash
pip install kokoro-onnx soundfile
# modelo: kokoro-v1.0.int8.onnx y voices-v1.0.bin (releases de thewh1teagle/kokoro-onnx)
python3 -I voice.py kokoro-v1.0.int8.onnx voices-v1.0.bin es
python3 -I voice.py kokoro-v1.0.int8.onnx voices-v1.0.bin en
for v in investor reel-fuego reel-via reel-rescate; do for l in es en; do JOBS=3 node render.mjs $v $l; done; done
node render.mjs --still investor es 12 44   # fotogramas de control
./publish.sh
```

## Reglas de contenido

- Cada cifra sale de una demo o de `evidence/`; los escenarios son sintéticos y se dice en pantalla.
- Las «imágenes reales» son capturas de la app funcionando en Chromium sin red (`evidence/senda/e2e-*.png`).
- No se usan fotos de prensa de accidentes: ni tenemos sus derechos ni se expone a las víctimas.
- Sobre Adamuz se dice siempre que el informe de la Guardia Civil está discutido por Adif y que decidirá la investigación oficial.
