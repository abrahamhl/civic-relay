# Vídeo promocional · ingeniería, arquitectura y estado real

Película de 4:58 (1920×1080, 30 fps, H.264 + AAC) para todos los públicos: desarrolladores, clientes, entidades e inversores. Cada cifra que aparece en pantalla viene de un fichero del repositorio (ver [SOURCES.md](SOURCES.md)).

## Ficheros

| Fichero | Función |
| --- | --- |
| `film.html` | Las 15 escenas. Animación determinista con `window.seek(t)`, sin CSS animado ni temporizadores. Abrir en el navegador reproduce la película; `film.html?t=120` congela el segundo 120. |
| `render.mjs` | Captura cada fotograma con Playwright/Chromium y lo codifica con ffmpeg. `--stills 10,60` genera fotogramas sueltos para revisión. |
| `music.py` | Banda sonora ambiental original y determinista (numpy). Sin muestras ni licencias de terceros. |
| `land.js` | Contorno de costas Natural Earth 1:110m (dominio público), copiado de `investor-next/public/geo/land-110m.json`. |
| `narracion.es.srt` | Guion de locución en español sincronizado con las escenas. Sirve como subtítulos o como guion para grabar la voz. |
| `out/` | Salida generada (ignorada por Git): `civic-relay-promo.mp4`, `music.wav`, `stills/`. |

## Regenerar

```bash
cd media/promo-video
python3 music.py out/music.wav 298   # opcional: render.mjs la genera si falta
node render.mjs                      # → out/civic-relay-promo.mp4 (~10 min)
```

Requisitos: Node 22, Playwright con Chromium, ffmpeg, python3 con numpy, fuente Inter instalada.

### Añadir la voz
1. Grabar la locución siguiendo `narracion.es.srt` (cada bloque cae dentro de su escena).
2. Mezclarla con la música bajando ésta a un nivel de fondo:
   ```bash
   ffmpeg -i out/civic-relay-promo.mp4 -i voz.wav -filter_complex \
     "[0:a]volume=0.35[m];[m][1:a]amix=inputs=2:duration=first[a]" \
     -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k out/civic-relay-promo-voz.mp4
   ```
3. Subtítulos incrustados (opcional): `ffmpeg -i out/civic-relay-promo.mp4 -vf subtitles=narracion.es.srt -c:a copy out/civic-relay-promo-sub.mp4`

## Estructura del vídeo

| Tiempo | Capítulo | Público principal |
| --- | --- | --- |
| 00:00 | Apertura | Todos |
| 00:11 | El problema | Clientes, entidades |
| 00:28 | Qué es / qué no es | Todos |
| 00:45 | Tres compromisos de ingeniería | Entidades, inversores |
| 01:00 | Arquitectura implementada: 8 etapas con módulos reales | Desarrolladores |
| 01:30 | Arquitectura objetivo: 8 núcleos | Desarrolladores, entidades |
| 01:50 | Escenario S01 Arnhem → San Martín, con prueba negativa | Todos |
| 02:17 | Ingeniería construida (cifras medidas) | Inversores, desarrolladores |
| 02:42 | Laboratorio Android y seguridad | Desarrolladores, entidades |
| 03:02 | Estado real: matriz de verdad, TRL ≈ 3, 54/100 | Inversores |
| 03:24 | 20 módulos con estado de verdad | Todos |
| 03:42 | Hoja de ruta G0–G7 | Inversores, entidades |
| 04:02 | Qué ofrece a cada actor | Todos |
| 04:24 | Escenarios de financiación (ilustrativos) | Inversores |
| 04:42 | Cierre y contacto | Todos |

## Límites que el vídeo respeta
- No se afirma entrega física teléfono↔teléfono, malla real, enlace satelital, RF a través de paredes ni integración con el 112.
- Las cifras de financiación son ilustrativas (`docs/investor/FINANCIAL_SCENARIOS.md`), no compromisos.
- 54/100 es una rúbrica interna provisional, no una auditoría.
- Antes de enviar el vídeo, revisar que las cifras siguen vigentes en el commit actual: los tests se volvieron a ejecutar el 03-11-2026 en `4c310f7`.
