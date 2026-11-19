# Prompt 01 · Película principal

```text
Eres el director de la película principal de SENDA. Ejecuta este encargo después del prompt maestro.

OBJETIVO
Crear `media/senda-film/m95-film.json` a partir de `media/senda-film/script.json`, añadir la escena de prueba `s12b`, renderizar `senda-m95-film-en.mp4` a 1920×1080 y publicar los tres VTT es/en/nl.

PASO 1 · GUION
1. Copia `script.json` a `m95-film.json` sin cambiar las líneas aprobadas.
2. Inserta `s12b` entre `s12` y `s13`.
3. Usa el texto exacto de `docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md`, § 4.2.
4. Añade a `s12b`:
   - `claim: "OBSERVED"`
   - `source: ["packages/senda-pci/tests/pci.test.mjs", "docs/audits/SENDA_MISSION_95_STATUS.md", "docs/security/SENDA_ASSURANCE_REVIEW.md"]`
   - `visual.kind: "kpis"` con 266, 13 y 0.
5. Actualiza los números solo después de ejecutar las suites. Si cambian, actualiza también la narración y los tres subtítulos.
6. Añade `claim` y `source` a las escenas que contengan afirmaciones públicas. Si no puedes documentar una cifra, elimínala o márcala UNVERIFIED y no la digas en voz.
7. Crea `docs/video/M95_VIDEO_SOURCES.md` con una fila por escena y fuente.

PASO 2 · IDIOMAS
1. La voz es solo inglesa.
2. `en` y `en_say` deben existir en todas las escenas.
3. `es` y `nl` son subtítulos; no se pronuncian.
4. No uses `en_say` como subtítulo.
5. Revisa que las tres versiones digan lo mismo.

PASO 3 · ETIQUETAS EN PANTALLA
1. El master inglés no puede mostrar rótulos españoles salvo nombres propios (DGT, Guardia Civil, ES-Alert, NL-Alert, DATEX II, etc.).
2. `film.html` ya tiene textos ingleses para `hub`, `stack`, `verify`, `cta` y `shots`; úsalos.
3. Para escenas `page`, pasa `lang=en` solo si la página lo soporta. Si no, no uses esa escena en el master inglés: sustitúyela por una escena 3D con rótulos ingleses o por un overlay inglés.
4. No recortes ni tapes rótulos españoles para disimular.
5. Añade `SIMULATION`, `SYNTHETIC IMAGE` o `INVENTED ROAD` donde corresponda.

PASO 4 · RENDER
1. Implementa o verifica los cambios mínimos de `voice.py`, `render.mjs`, `make.sh` y `publish.sh` del handoff.
2. A 1080p: `deviceScaleFactor=1.5`, viewport 1280×720, 25 fps, `JOBS=2`.
3. Valida antes de gastar CPU:
   `cd media/senda-film; node validate.mjs m95-film en`
4. Renderiza con los valores reales del día:
   `CORE=<n> E2E=<n> JOBS=2 ./make.sh m95-film en`
5. Genera stills:
   `node render.mjs --stills en 5,40,90,150`
6. Revisa los stills. Si hay texto cortado, solapado o pantallas en blanco, corrige y repite.
7. No publiques el vídeo si los stills no están limpios.

PASO 5 · PUBLICACIÓN
1. Publica en `investor-next/public/media/m95/` con los nombres exactos del handoff.
2. Genera póster de un fotograma con texto legible.
3. Copia los tres VTT de la pasada inglesa.
4. Verifica que los tres empiezan por WEBVTT y tienen timestamps.
5. Calcula SHA-256.

PASO 6 · INFORME
Entrega:
- ruta del MP4, VTT y póster;
- duración, resolución, fps, códec, peso;
- hashes SHA-256;
- stills revisados;
- escenas con fuente y nivel de claim;
- qué no has podido verificar;
- confianza 0–100 %.

NO HAGAS
- No reescribas las líneas aprobadas sin necesidad factual.
- No uses el MP4 antiguo como sustituto.
- No publiques si falta es, en o nl.
- No dejes la escena de auditorías externas en un número distinto de 0 sin evidencia.
- No digas «validado» ni «certificado».
```
