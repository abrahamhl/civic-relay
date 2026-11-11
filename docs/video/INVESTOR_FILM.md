# SENDA · Película de presentación a inversores (motor 3D `cinema`)

Fecha: 11-11-2026 · Rama: `claude/promotional-video-prompts-p5vzh8` · Base: `feat/senda-funding-mission-day1`

## Qué es

Película de 4:16 en 1080p (formato panorámico 2.39:1 con bandas), narración en inglés con voz femenina
(`bf_emma`, Kokoro, la voz fijada en `docs/handoff/prompts/antigravity/03_VOZ_Y_SUBTITULOS.md`), música techno
tranquila generada por código y subtítulos en español (quemados) y en español e inglés (pistas y `.vtt`).

15 escenas: apagón ibérico, DANA de Valencia, Adamuz, el hueco, título, malla sin Internet, fragmentos por
varios portadores, satélites por nivel de acceso, carretera con niebla, incendio, edificio con dron, física y
garantía de entrega, campos de aplicación, pruebas y lo que falta, cierre.

## Cómo se reproduce

```bash
cd media/senda-film
node build-investor-film.mjs            # guion; lee estado.json y .opencode/agents, falla si no coinciden
node validate.mjs investor-film en
python3 voice.py investor-film en       # voz + tiempos (Kokoro en ~/.cache/kokoro)
STILLS=5,33,128 node render-cinema.mjs --stills   # fotogramas de control en build/
JOBS=4 node render-cinema.mjs           # build/senda-investor-film-en.mp4 + .es.vtt + .en.vtt
```

| Pieza | Ruta |
|---|---|
| Guion (generado) | `media/senda-film/investor-film.json` ← `build-investor-film.mjs` |
| Motor y rótulos | `media/senda-film/cinema.html` |
| Escenas 3D | `media/senda-film/cinema/scenes.js`, `cinema/lib.js` |
| three.js r158 + postproceso (MIT) | `media/senda-film/cinema/vendor/` |
| Música | `media/senda-film/music-techno.py` |
| Grabación | `media/senda-film/render-cinema.mjs` |

Cada fotograma es función pura del tiempo (`window.seek(t)`), sin `Math.random` ni relojes.

## Procedencia de las afirmaciones

Ninguna frase es nueva: todas salen de guiones ya verificados (`m95-film.json`, `m96-promo.json`,
`docs/video/M96_PROMO_SOURCES.md`) o de `docs/science/DELIVERY_ASSURANCE.md` (99,49 % prometido, 96,09 %
entregado, 98,98 % con el motor a 0 €; resultado simulado). Las cifras de pruebas (433 de núcleo, 49 de extremo
a extremo) se leen de `investor-next/public/senda/estado.json` (SHA `c1112d2`) y los 43 agentes y 21 skills se
cuentan en `.opencode/`.

## Límites (no ocultar)

- **No hay metraje real.** Las escenas de apagón, DANA y Adamuz son visualizaciones 3D ilustrativas de hechos
  publicados; así lo dice el rótulo superior de cada escena (`PUBLISHED RECORD · 3D VISUALISATION`). El entorno
  de render no tiene acceso a bancos de vídeo con licencia y la regla 6 del prompt maestro prohíbe metraje sin
  licencia e imágenes de víctimas.
- **El 3D es de tiempo real (WebGL por software), no fotorrealista.** No es un render de Blender/Cycles.
- **Las escenas simuladas son ilustrativas.** La coreografía de la frenada en cadena (5 coches sin aviso, 1 con
  aviso) reproduce el resultado del modelo de carretera, pero no ejecuta `packages/senda`; el frente de fuego y
  el edificio son geometría ilustrativa con las cifras del guion. Rótulo: `ILLUSTRATIVE 3D · FIGURES FROM THE SENDA CORE`.
- Sin subtítulos en neerlandés (el prompt 03 los exige para publicar en la web): **no publicar en producción**
  sin añadirlos y revisarlos.
- El vídeo no está integrado en la web ni desplegado.
