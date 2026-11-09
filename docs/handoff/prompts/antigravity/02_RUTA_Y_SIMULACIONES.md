# Prompt 02 · Ruta, cortes y simulaciones

```text
Eres el director de la pieza de carretera y de las simulaciones de SENDA. Ejecuta este encargo después del prompt maestro y, preferiblemente, después de que la película principal esté validada.

OBJETIVO
Producir `senda-m95-ruta-en.mp4`, los cortes de 90/60/30 s, el vertical opcional y las seis simulaciones, todos con narración inglesa y VTT es/en/nl.

BASE
- Usa `media/senda-film/ruta.json` como fuente.
- Crea `media/senda-film/m95-ruta.json` como copia exacta, para que la salida sea `senda-m95-ruta-*`.
- No reescribas las escenas aprobadas salvo corrección factual.
- No reutilices `senda-ruta-en.mp4`: se renderiza de nuevo a 1080p.
- Renderiza con `node validate.mjs m95-ruta en` y `CORE=<n> E2E=<n> JOBS=2 ./make.sh m95-ruta en`.
- No uses metraje de tráfico real sin licencia. Las escenas de cámara son sintéticas o renders del simulador.
- Etiqueta `SIMULATION`, `SYNTHETIC IMAGE` o `INVENTED ROAD` en cada escena que corresponda.

PASO 1 · RÓTULOS INGLESES
1. El master es inglés.
2. Las páginas de la app que aparezcan en pantalla deben estar en inglés.
3. Si una página no soporta `lang=en`, no la uses. Sustitúyela por una escena 3D con rótulos ingleses o por un overlay inglés limpio.
4. No dejes rótulos españoles en el master inglés. Los nombres propios (DGT, Guardia Civil, ES-Alert, NL-Alert, DATEX II) se mantienen.
5. No recortes la pantalla para esconder texto español.

PASO 2 · PELÍCULA DE RUTA
1. Renderiza a 1920×1080, 25 fps, H.264/yuv420p, faststart, audio AAC 192 kbps 48 kHz, -16 LUFS, -1,5 dBTP.
2. Duración objetivo: 4–5 min.
3. Escenas: r1 frenadas con niebla, r2 SOS que viaja con los coches, r5 sentido contrario, r6 final de retención, r7 visibilidad con cámara pública, más las escenas de contexto y cierre que ya tenga `ruta.json`.
4. Voz `bf_emma`, en-GB, 0,95.
5. Genera VTT es/en/nl desde los tiempos de la voz inglesa.
6. Publica como:
   - `senda-m95-ruta-en.mp4`
   - `senda-m95-ruta-es.vtt`
   - `senda-m95-ruta-en.vtt`
   - `senda-m95-ruta-nl.vtt`
   - `senda-m95-ruta-poster.jpg`

PASO 3 · CORTES
Deriva de escenas aprobadas; no inventes frases nuevas:

| Pieza | Escenas | Duración | Archivo |
|---|---|---:|---|
| 90 s | s1 + s2 + s3b + s9 + s13 | 90 s | `senda-m95-90s-en.mp4` |
| 60 s | s1 + s4 + s9 + s13 | 60 s | `senda-m95-60s-en.mp4` |
| 30 s | s1 + s13 | 30 s | `senda-m95-30s-en.mp4` |
| Vertical | s1 + s3b + s13 | 30–45 s | `senda-m95-vertical-45s-en.mp4` |

Reglas:
- Cada corte conserva el significado y las etiquetas de simulación.
- Usa nombres de guion/base `m95-90s`, `m95-60s`, `m95-30s`, `m95-vertical-45s` y `m95-sim-*` para que la salida coincida con los nombres publicados.
- El vertical es 1080×1920; además de los VTT, genera versiones con subtítulos quemados por idioma para redes.
- El audio se normaliza igual que el master.
- No uses música nueva sin licencia.

PASO 4 · SIMULACIONES
Genera estas seis piezas de 15–30 s, con rótulo y explicación en voz:

| Archivo | Escena base | Qué debe explicar |
|---|---|---|
| `senda-m95-sim-braking-en.mp4` | r1 | Cadena de frenadas con niebla; cada coche avisa al de atrás |
| `senda-m95-sim-sos-en.mp4` | r2 | Un SOS viaja con los coches que pasan, no con la red |
| `senda-m95-sim-wrongway-en.mp4` | r5 | Coche en sentido contrario; aviso a los que vienen |
| `senda-m95-sim-queue-en.mp4` | r6 | El final de la retención se propaga hacia atrás |
| `senda-m95-sim-visibility-en.mp4` | r7 | La visibilidad se mide con una cámara pública |
| `senda-m95-sim-proof-en.mp4` | s12 + s12b | Qué está verificado y qué no |

Cada simulación:
- empieza con el contexto en una frase;
- muestra `SIMULATION` o `SYNTHETIC` de forma visible pero discreta;
- termina con la limitación: «model, not a field test» o equivalente;
- no promete evitar el accidente;
- no usa imágenes de víctimas.

PASO 5 · QA DE PIEZAS
1. Comprueba duración real y resolución con ffprobe.
2. Revisa stills al inicio, medio y final.
3. Comprueba que no hay texto cortado en 16:9 ni en 9:16.
4. Comprueba que los tres VTT existen y empiezan por WEBVTT.
5. Comprueba que el vertical no tiene subtítulos fuera de la zona segura.
6. Calcula SHA-256.
7. Publica en `investor-next/public/media/m95/`.

ENTREGA
Tabla con pieza, archivo, duración, resolución, peso, hashes, estado de subtítulos y estado de revisión. Declara `REVIEW_REQUIRED` si el neerlandés no tiene revisión nativa.

NO HAGAS
- No presentes imágenes sintéticas como reales.
- No uses rótulos españoles en el master inglés.
- No inventes escenas o cifras.
- No digas que una simulación evita accidentes.
- No publiques una pieza sin sus tres VTT.
```
