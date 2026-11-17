# Vídeo promocional · ingeniería, arquitectura y estado real (v2: 3D + doblaje)

Película de ~7:37 (1920×1080, 30 fps, H.264 + AAC) doblada al español con voz femenina sintética, para todos los públicos: desarrolladores, clientes, entidades e inversores. Cada cifra en pantalla viene de un fichero del repositorio (ver [SOURCES.md](SOURCES.md)).

## Qué hay en v2
- **Capa 3D (three.js r158)**: globo con costas Natural Earth y red de nodos, ciudad con antenas que se apagan, pila de 8 núcleos de arquitectura, dos teléfonos con paquete firmado y ACK, escalera de gates G0–G7 con etiquetas proyectadas, y un campo de red en profundidad para el resto de escenas.
- **Animaciones**: titulares palabra a palabra, entradas con profundidad y desenfoque, transiciones con zoom, foco sobre la tarjeta que se está narrando, contadores y paquete viajando por las 8 etapas.
- **Doblaje sincronizado**: `voice.py` genera la locución frase a frase y escribe `timeline.js`. Cada escena dura lo que su narración y cada animación (`data-cue`) arranca en la frase que la explica.
- **Dos versiones**: `out/civic-relay-promo.mp4` (limpia) y `out/civic-relay-promo-subtitulado.mp4` (subtítulos incrustados, útil para reproducción automática sin sonido).

## Ficheros

| Fichero | Función |
| --- | --- |
| `narration.json` | Guion del doblaje, por escenas y frases, con sus `cue`. **Editar aquí el texto hablado.** |
| `voice.py` | Sintetiza la voz (Kokoro-82M v1.0, voz `ef_dora`) → `out/voice.wav`, `timeline.js`, `subtitles.es.srt`. Incluye un mapa de pronunciación para términos en inglés. |
| `film.html` | 15 escenas + capa 3D. Determinista con `window.seek(t)`. `film.html?t=120` congela el segundo 120. |
| `render.mjs` | Render paralelo por tramos (Playwright + WebGL SwiftShader), mezcla voz + música con compresión lateral y genera la versión subtitulada. |
| `music.py` | Banda sonora ambiental original (numpy). |
| `timeline.js`, `subtitles.es.srt` | Generados por `voice.py`; versionados para que `film.html` se pueda abrir sin regenerar la voz. |
| `land.js` | Costas Natural Earth 1:110m (dominio público). |
| `vendor/three-0.158.0.min.js` | three.js (MIT, ver `vendor/three-LICENSE`). |

## Regenerar

```bash
# 1) Modelo de voz (Apache-2.0). No se versiona: ~92 MB.
npm pack kokoro-q8-shards@1.0.0 && tar xzf kokoro-q8-shards-1.0.0.tgz
cat package/kokoro-q8.part{0,1,2,3,4,5}.bin > kokoro-q8.onnx   # sha256 fbae9257…1478
curl -LO https://raw.githubusercontent.com/remsky/Kokoro-FastAPI/master/api/src/voices/v1_0/ef_dora.pt
python3 -c "import zipfile,numpy as np;a=np.frombuffer(zipfile.ZipFile('ef_dora.pt').read('ef_dora/data/0'),'<f4').reshape(510,1,256);np.savez('voices-es.npz',ef_dora=a)"
pip install onnxruntime kokoro-onnx

# 2) Voz + línea de tiempo (~6 min en 4 núcleos)
python3 -I voice.py kokoro-q8.onnx voices-es.npz

# 3) Vídeo (~30 min con JOBS=3)
JOBS=3 node render.mjs
```

## Estructura (tiempos reales en `timeline.js`)
Apertura · El problema · Qué es / qué no es · Tres compromisos · Arquitectura implementada (8 etapas) · Arquitectura objetivo (8 núcleos) · Escenario S01 Arnhem → San Martín con prueba negativa · Ingeniería construida · Laboratorio Android y seguridad · Estado real (TRL ≈ 3, 54/100) · 20 módulos · Hoja de ruta G0–G7 · Qué ofrece a cada actor · Financiación ilustrativa · Cierre.

## Límites que el vídeo respeta
- No se afirma entrega física teléfono↔teléfono, malla real, enlace satelital, RF a través de paredes ni integración con el 112.
- El escenario S01 se presenta como **objetivo de diseño**; el globo y los nodos son ilustrativos.
- Las cifras de financiación son ilustrativas; 54/100 es una rúbrica interna provisional.
- La voz es **sintética** (Kokoro-82M) y así se declara en el cierre del vídeo.
- Antes de enviarlo, comprobar que las cifras siguen vigentes: los tests se re-ejecutaron el 03-11-2026 en `4c310f7`.
