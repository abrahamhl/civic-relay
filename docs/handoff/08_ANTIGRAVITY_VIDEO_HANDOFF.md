# SENDA · Handoff de vídeo profesional para Antigravity

> **Fecha:** 08-11-2026
> **Para:** Antigravity (u otro agente con acceso al repositorio y al despliegue).
> **Repositorio:** `C:\Users\2fabr\civic-relay` · GitHub `abrahamhl/civic-relay`.
> **Rama de partida:** `mission/senda-95-20261108`, HEAD `b9b1590e776ccc8deb50c53072bf7cb2e99a5f17`.
> **PR de referencia:** #23, abierto contra `fix/senda-dtn-receipt-quarantine-20261107` (PR #22), no contra `master`.
> **Estado:** handoff listo; los vídeos nuevos **todavía no existen**.
> **Autoridad final:** Abraham Haddioui. Antigravity no decide alcance, licencia, marca, precio, promesas públicas ni cambios del núcleo.

Asumo que «anitgravity» significa **Antigravity**. Si el destinatario real es otra herramienta, este documento y los prompts sirven igual: solo cambia el nombre del agente.

---

## 0. Lectura obligatoria antes de tocar nada

En este orden:

1. `docs/handoff/08_ANTIGRAVITY_VIDEO_HANDOFF.md` (este documento).
2. `docs/handoff/07_VIDEOS_3D_RUNBOOK.md` (pipeline real de vídeo).
3. `docs/handoff/02_AGENTES_Y_PROMPTS.md` (§ bloque común y agente A3).
4. `docs/audits/SENDA_MISSION_95_STATUS.md` (estado real de la misión).
5. `docs/security/SENDA_ASSURANCE_REVIEW.md` (F-01…F-10 y límites de seguridad).
6. `docs/handoff/01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md` (MIT, marca y terceros).
7. `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md` (mapa del producto).
8. `media/senda-film/script.json` y `media/senda-film/ruta.json` (guiones aprobados).

No hace falta el historial de la conversación que originó este encargo. Todo lo necesario está en el repositorio y en este paquete.

---

## 1. Encargo exacto

Producir, publicar y verificar una suite de vídeos profesionales de SENDA:

- **Narración en inglés**, voz femenina británica, tono calmado y técnico.
- **Subtítulos en español, inglés y neerlandés** para cada pieza.
- **Explicaciones, simulaciones y renders 3D** basados en el núcleo real de la app.
- **Publicación en la web** de producción.
- **Protección e integridad** de los archivos y de la página.
- **Verificación reproducible** antes de decir que está terminado.

El fundador ha pedido explícitamente que el resultado quede **desplegado en la web**. Eso autoriza el despliegue de los vídeos y de los cambios de web estrictamente necesarios. No autoriza:

- cambiar el núcleo, la criptografía o los claims de la misión;
- cambiar la licencia MIT ni registrar la marca;
- fusionar el PR #23 ni ningún PR a `master`;
- tocar otros despliegues, dominios o secretos;
- presentar el resultado como certificado, auditado o validado en campo.

Si Antigravity no tiene credenciales de Vercel o de GitHub, debe dejar el preview local, los comandos exactos y el estado `BLOCKED`; no debe fingir un despliegue.

---

## 2. Estado de partida que no se debe inventar

| Dato | Valor comprobado el 08-11-2026 |
|---|---|
| Rama | `mission/senda-95-20261108` |
| HEAD | `b9b1590e776ccc8deb50c53072bf7cb2e99a5f17` |
| Árbol de trabajo | limpio antes de este handoff |
| PR | #23, `OPEN`, `MERGEABLE`, `CLEAN` |
| CI del PR | `simulator` y `trilingual-browser-smoke` en verde |
| Suite SENDA | 266/266 |
| Suite PCI | 13/13 |
| Manifiesto de release | 4/4 |
| Instalación reproducible | `pnpm install --frozen-lockfile` en verde |
| Benchmark DTN | `SOURCE_ONLY`, SHA-256 `c399870d43f121c4739fb9bb4cc5ed7b652436eac99f7b1ce46642cc7ffcd860` |
| Puntuación global | 6,7/10; no 9,5 |
| `estado.json` web | **desactualizado**: 232/49 y SHA `c0b10e6`; no usarlo sin regenerar |

### 2.1 Reglas de verdad

Cada afirmación del vídeo debe clasificarse como:

`OBSERVED` · `CALCULATED` · `SIMULATED` · `INFERRED` · `UNVERIFIED` · `REJECTED` · `BLOCKED`

Y debe cumplir:

- `SIMULATED ≠ PHYSICALLY_VALIDATED`
- `DOCUMENTED_SOURCE ≠ INGESTED_DATASET`
- `HASH_VERIFIED ≠ COMPUTATION_PROVEN`
- `MODEL_CALIBRATED ≠ SAFETY_CERTIFIED`
- `CI_GREEN ≠ SCIENTIFICALLY_VALIDATED`

### 2.2 Prohibiciones editoriales

- No decir que SENDA sustituye al 112, ES-Alert, NL-Alert o eCall.
- No decir que el sistema está certificado, auditado o validado en campo.
- No decir que el vídeo demuestra una nota 9,5.
- No inventar cifras, fuentes, precios, normas ni capacidades.
- No presentar una simulación como imagen real.
- No usar imágenes de desastres reales sin licencia y sin contexto.
- No usar datos con licencia no comercial (TeleGeography, Vantor, Google Maps, OpenSky, etc.).
- No poner caras, matrículas, direcciones ni datos personales.
- No usar música, voz o metraje de terceros sin licencia documentada.
- No afirmar que un MP4 público está «protegido» con DRM: no lo está.

### 2.3 Lo simulado se dice en pantalla y en voz

Cada escena sintética debe mostrar un rótulo discreto, por ejemplo:

- `SIMULATION · synthetic traffic`
- `SYNTHETIC IMAGE · method test`
- `INVENTED ROAD · demo`
- `COMPUTED FROM THE APP CORE`

La voz debe decirlo al menos una vez por bloque, sin dramatismo.

---

## 3. Entregables

### 3.1 Matriz de piezas

| ID | Pieza | Duración | Formato | Audio | Subtítulos | Prioridad |
|---|---|---:|---|---|---|---|
| V1 | Película principal «SENDA: when the network falls» | 5–6 min | 1920×1080, 25 fps | Inglés | es/en/nl | Obligatoria |
| V2 | «Protective route»: carretera, cámaras, Países Bajos y DGT | 4–5 min | 1920×1080, 25 fps | Inglés | es/en/nl | Obligatoria |
| V3 | Cortes 90 s, 60 s y 30 s | 0:30–1:30 | 1920×1080, 25 fps | Inglés | es/en/nl | Obligatoria |
| V4 | Pieza vertical 9:16 | 30–45 s | 1080×1920, 25 fps | Inglés | es/en/nl; además versión con subtítulos quemados por idioma | Recomendada |
| V5 | Seis simulaciones explicadas | 15–30 s cada una | 1920×1080, 25 fps | Inglés | es/en/nl | Recomendada |
| P1 | Pósteres y transcripciones | — | JPG 1920×1080 y Markdown/HTML | — | es/en/nl | Obligatoria |
| P2 | Integración web y despliegue | — | Next.js/Vercel | — | es/en/nl | Obligatoria |
| P3 | Evidencia de release | — | JSON, SHA-256, capturas, informe | — | — | Obligatoria |

**Regla de alcance:** primero V1 + P1 + P2 + P3. Después V2, V3, V4 y V5. Si el tiempo no alcanza, se entrega lo primero y se declara lo demás como pendiente; nunca se dice que está hecho.

### 3.2 Nombres de archivo

Publicar en `investor-next/public/media/m95/`:

```text
senda-m95-film-en.mp4
senda-m95-film-es.vtt
senda-m95-film-en.vtt
senda-m95-film-nl.vtt
senda-m95-film-poster.jpg

senda-m95-ruta-en.mp4
senda-m95-ruta-es.vtt
senda-m95-ruta-en.vtt
senda-m95-ruta-nl.vtt
senda-m95-ruta-poster.jpg

senda-m95-90s-en.mp4
senda-m95-60s-en.mp4
senda-m95-30s-en.mp4
senda-m95-vertical-45s-en.mp4
senda-m95-sim-braking-en.mp4
senda-m95-sim-sos-en.mp4
senda-m95-sim-wrongway-en.mp4
senda-m95-sim-queue-en.mp4
senda-m95-sim-visibility-en.mp4
senda-m95-sim-proof-en.mp4
```

Cada pieza debe tener sus tres VTT con el mismo nombre base:

```text
senda-m95-90s-es.vtt
senda-m95-90s-en.vtt
senda-m95-90s-nl.vtt
```

No sobrescribir `senda-film-*` ni `senda-ruta-*`: son el archivo publicado anterior. La versión nueva va al lado, con prefijo `m95`.

Los masters de alta calidad pueden quedar en `media/senda-film/out/m95/` (ignorado por Git). A la web solo se sube la versión comprimida y verificada.

---

## 4. Guion, escenas y fuentes

### 4.1 Película principal

Usar `media/senda-film/script.json` como base aprobada. **No reescribir las líneas existentes** salvo corrección factual aprobada. La estructura es:

| Escena | Visual | Función |
|---|---|---|
| s1 | `kpis` | Gancho: la red cae, el mensaje no debe morir |
| s2 | `hub` | Qué es SENDA: capa sobre muchos portadores |
| s3 | `shots` | Sin Internet desde el primer segundo; DTN y recibo |
| s3b | `call` | Llamar sin Internet; 90 bytes por sonido |
| s4 | `shots` | k-de-n, Reed-Solomon, múltiples caminos |
| s5 | `shots` | Satélites por nivel de acceso |
| s5b | `shots` | Ojo de SENDA: satélites calculados en vivo |
| s6 | `shots` | Previsión de apagón |
| s7 | `shots` | Accidente ferroviario |
| s8 | `shots` | Edificios piso a piso |
| s8a | `drone3d` | Conteo desde fuera |
| s8b | `shots` | Ver sin fingir rayos X |
| s8c | `shots` | Ferrocarril: la señal estaba en los datos |
| s8d | `shots` | Incendios: avisar antes de que arda la antena |
| s9 | `shots` | Confianza: firma, consentimiento y zona |
| s10 | `shots` | Tres botones |
| s10b | `arch3d` | Arquitectura completa en 3D |
| s10c | `howsim` | Cada fotograma es el código real |
| s11 | `stack` | Listo para desplegar |
| s12 | `verify` | Verificado por máquina; honesto sobre lo que falta |
| s12b | `kpis` | **Nueva:** la prueba de seguridad que se puede inspeccionar |
| s13 | `cta` | Para que ningún mensaje se pierda |

La nueva escena `s12b` se inserta **después de s12 y antes de s13**.

### 4.2 Texto exacto de la escena nueva `s12b`

Título:

```json
{
  "es": "La prueba que puedes inspeccionar",
  "en": "The proof you can inspect",
  "nl": "Het bewijs dat je kunt controleren"
}
```

Narración en inglés (lo que se lee y lo que se pronuncia):

```text
Security is not a promise. It is a chain you can inspect.
Messages are encrypted end to end. Receipts are signed into a hash chain.
The identity key is bound to the card and exported encrypted.
The core has more than two hundred and sixty automated tests, and the custody protocol has its own suite.
That proves the code does what the tests check. It does not prove field performance, and no external audit has certified it yet.
```

Pronunciación para `en_say`:

```text
Security is not a promise. It is a chain you can inspect.
Messages are encrypted end to end. Receipts are signed into a hash chain.
The identity key is bound to the card and exported encrypted.
The core has more than two hundred and sixty automated tests, and the custody protocol has its own suite.
That proves the code does what the tests check. It does not prove field performance, and no external audit has certified it yet.
```

Español (subtítulo):

```text
La seguridad no es una promesa. Es una cadena que se puede inspeccionar.
Los mensajes van cifrados de extremo a extremo. Los recibos se firman en una cadena de hashes.
La clave de identidad está ligada a la tarjeta y se exporta cifrada.
El núcleo tiene más de doscientas sesenta pruebas automáticas, y el protocolo de custodia tiene su propia batería.
Eso demuestra que el código hace lo que comprueban las pruebas. No demuestra su comportamiento en campo, y ninguna auditoría externa lo ha certificado todavía.
```

Neerlandés (subtítulo):

```text
Veiligheid is geen belofte. Het is een keten die je kunt controleren.
Berichten zijn end-to-end versleuteld. Ontvangstbewijzen worden ondertekend in een hash-keten.
De identiteitssleutel is aan de kaart gebonden en wordt versleuteld geëxporteerd.
De kern heeft meer dan tweehonderdzestig automatische tests, en het custodieprotocol heeft een eigen suite.
Dat bewijst dat de code doet wat de tests controleren. Het bewijst geen veldprestaties, en geen externe audit heeft het gecertificeerd.
```

Visual `kpis` (actualizar los números solo después de ejecutar las suites):

```json
{
  "kind": "kpis",
  "kpis": [
    {
      "v": "266",
      "l": {
        "es": "pruebas del núcleo, ejecutadas sin red",
        "en": "core tests, run offline",
        "nl": "kerntests, offline uitgevoerd"
      }
    },
    {
      "v": "13",
      "l": {
        "es": "pruebas de custodia PCI",
        "en": "PCI custody tests",
        "nl": "PCI-custodietests"
      }
    },
    {
      "v": "0",
      "l": {
        "es": "auditorías externas completadas",
        "en": "external audits completed",
        "nl": "voltooide externe audits"
      }
    }
  ]
}
```

Si las suites cambian, actualizar los tres valores y la narración. No dejar cifras viejas.

Metadatos obligatorios de la escena:

```json
{
  "claim": "OBSERVED",
  "source": [
    "packages/senda-pci/tests/pci.test.mjs",
    "docs/audits/SENDA_MISSION_95_STATUS.md",
    "docs/security/SENDA_ASSURANCE_REVIEW.md"
  ]
}
```

### 4.3 Película de carretera

Usar `media/senda-film/ruta.json` tal cual, con estas condiciones:

- Usar `ruta.json` como fuente y crear `m95-ruta.json` como copia exacta, para que la salida sea `senda-m95-ruta-*` sin sobrescribir la pieza antigua.
- Renderizar solo la versión inglesa (`en`).
- Generar VTT `es`, `en` y `nl` con los tiempos de la voz inglesa.
- Los rótulos dibujados en las páginas de la app deben estar en inglés. Si una página no tiene modo inglés, no usarla en el master: sustituirla por una escena 3D con rótulos ingleses o por un overlay inglés. No dejar rótulos españoles en el master inglés.
- Mantener las etiquetas `SIMULATION`, `SYNTHETIC IMAGE` e `INVENTED ROAD` donde corresponda.
- No reutilizar el MP4 antiguo `senda-ruta-en.mp4`: se renderiza de nuevo a 1080p y se publica como `senda-m95-ruta-en.mp4`.

### 4.4 Cortes cortos

Derivar de las escenas aprobadas, sin inventar frases nuevas:

| Pieza | Escenas base | Mensaje |
|---|---|---|
| 90 s | s1 + s2 + s3b + s9 + s13 | Qué es, que funciona sin red, que la confianza se firma, CTA |
| 60 s | s1 + s4 + s9 + s13 | El mensaje sobrevive y se puede verificar |
| 30 s | s1 + s13 | La red cae; el mensaje no debe morir |
| Vertical 45 s | s1 + s3b + s13 | Gancho, llamada sin Internet, CTA |

Para los cortes se permite condensar la narración, pero no cambiar el significado, las cifras ni las etiquetas de simulación.

Usar nombres de guion/base que produzcan los archivos pedidos: `m95-90s`, `m95-60s`, `m95-30s`, `m95-vertical-45s`, `m95-sim-braking`, etc. Si `make.sh` no deriva el nombre, pasar `BASE`/`SCRIPT` explícito.

### 4.5 Simulaciones explicadas

| Archivo | Escena base | Qué explica |
|---|---|---|
| `senda-m95-sim-braking-en.mp4` | r1 | Cadena de frenadas con niebla |
| `senda-m95-sim-sos-en.mp4` | r2 | SOS que viaja con los coches |
| `senda-m95-sim-wrongway-en.mp4` | r5 | Coche en sentido contrario |
| `senda-m95-sim-queue-en.mp4` | r6 | Final de retención que crece hacia atrás |
| `senda-m95-sim-visibility-en.mp4` | r7 | Visibilidad medida con cámara pública |
| `senda-m95-sim-proof-en.mp4` | s12 + s12b | Qué está verificado y qué no |

Cada una debe mostrar `SIMULATION` o `SYNTHETIC` y decir qué se está simulando.

### 4.6 Tabla de fuentes

Antes de renderizar, crear `docs/video/M95_VIDEO_SOURCES.md` con una fila por escena:

| Escena | Afirmación | Nivel | Fuente | Verificado por |
|---|---|---|---|---|

Reglas:

- Una cifra sin fuente se elimina o se marca `UNVERIFIED` y no se dice en voz.
- Una simulación se marca `SIMULATED` y se explica.
- Un test se marca `OBSERVED` y se enlaza al archivo de test.
- Una estimación se marca `CALCULATED` y se enlaza al script que la produce.

---

## 5. Pipeline de producción

### 5.1 Base existente

El pipeline probado está en `media/senda-film/`:

- `script.json` y `ruta.json`: guiones.
- `validate.mjs`: validación antes de gastar CPU.
- `voice.py`: Kokoro-ONNX 0.6.1, voces `ef_dora` (es) y `bf_emma` (en-GB), 0,95.
- `render.mjs` + `film.html`: Playwright, `window.seek(t)`, 25 fps, tramos en paralelo, ffmpeg.
- `sims.js`: escenas 3D/2D deterministas.
- `music.py`: música generada por código.
- `make.sh`: validar → voz → imagen → mezcla.
- `publish.sh`: copia a `investor-next/public/media/`.

### 5.2 Cambios mínimos necesarios

Antigravity debe implementar estos cambios, con pruebas, antes de renderizar:

1. **`voice.py`: tres VTT en la pasada inglesa.**
   - Si `lang == "en"`, generar `subtitles-<pfx>en.vtt`, `subtitles-<pfx>es.vtt` y `subtitles-<pfx>nl.vtt` usando **los mismos tiempos** de la voz inglesa.
   - Si falta `es` o `nl` en alguna escena, fallar cerrado.
   - No generar VTT en inglés desde la pasada española.
   - Mantener `lang` y `_say` separados: los subtítulos usan `sc[lang]`, nunca `sc[lang + "_say"]`.

2. **`make.sh` y `publish.sh`: publicación trilingüe.**
   - Usar nombres de guion/base `m95-film`, `m95-ruta`, `m95-90s`, etc., para que la salida sea `senda-m95-*` y no sobrescriba los vídeos antiguos. Si `make.sh` no lo deriva del nombre del guion, añadir `BASE` o `SCRIPT` explícito.
   - Copiar los tres VTT de la pasada inglesa.
   - Verificar que los tres existen y que empiezan por `WEBVTT`.
   - Generar póster a partir de un fotograma con texto legible, no de una pantalla en blanco.

3. **`render.mjs`: 1080p sin rehacer el layout.**
   - Añadir `deviceScaleFactor=1.5` a la página de Playwright con viewport 1280×720: la captura sale 1920×1080 y el texto sigue nítido.
   - Mantener 25 fps.
   - Añadir `JOBS=2` como valor recomendado para 1080p.
   - Conservar `--stills` y `--chunk`.

4. **`film.html`: modo inglés de página.**
   - Para escenas `page`, pasar `lang=en` a la página si lo soporta.
   - Si no lo soporta, no usar esa escena en el master inglés.
   - No tapar rótulos españoles con recortes: si no se puede internacionalizar, se sustituye la escena.

5. **Audio.**
   - Voz clara, música generada por código, ducking con sidechain.
   - Normalizar a `-16 LUFS` integrados y `-1,5 dBTP`; el MP4 de web con AAC-LC 192 kbps, 48 kHz, estéreo.
   - No usar música con licencia dudosa.

6. **Validación.**
   - `validate.mjs` debe comprobar, para `m95-film.json`, que existen `en`, `es`, `nl`, `en_say`, títulos en los tres idiomas y que las frases de subtítulo tienen longitud razonable.
   - Añadir un chequeo de VTT: `WEBVTT`, timestamps crecientes, sin solapamientos, sin cues vacíos, duración máxima 7 s, mínimo 0,8 s.

### 5.3 Comandos de referencia

```bash
# Dependencias (una vez)
pip install kokoro-onnx==0.6.1 numpy
# Modelos Kokoro en ~/.cache/kokoro (ver 07_VIDEOS_3D_RUNBOOK.md)
# Playwright con Chromium

cd media/senda-film
node validate.mjs m95-film en
CORE=<n> E2E=<n> JOBS=2 ./make.sh m95-film en
node render.mjs --stills en 5,40,90,150
```

Sustituir `<n>` por los valores reales del día. **No copiarlos de `estado.json` sin regenerarlo.**

### 5.4 Presupuesto de render

- Un vídeo de 4–5 min a 1080p con 2–3 procesos: 45–90 min en una máquina de 4 núcleos.
- No ejecutar E2E, benchmark o render a la vez.
- Si se cae la sesión, conservar `out/` y repetir solo el tramo que falte.

---

## 6. Voz y subtítulos

### 6.1 Voz

- Voz por defecto: `bf_emma`, `en-gb`, velocidad 0.95.
- No cambiar de voz sin aprobación del fundador.
- Tono: calmado, competente, sin épica publicitaria.
- Ritmo: 145–155 palabras por minuto.
- Pausa entre frases: 350 ms (la que ya usa `voice.py`).
- Números y siglas se escriben como palabras en `en_say`:
  - `112` → `one one two`
  - `DGT` → `D G T`
  - `DATEX II` → `DATEX two`
  - `QO-100` → `Q O one hundred`
  - `LoRa` → `LOR-ah`
  - `PCI` → `P C I`
  - `DTN` → `D T N`
  - `km/h` → `kilometres an hour`
  - `m/s²` → `metres per second squared`
- «SENDA» se pronuncia `Senda`.
- No usar signos que la voz lea mal (`→`, `²`, `%`, `≤`) en `en_say`.

### 6.2 Subtítulos

- Un cue = una frase; máximo 42 caracteres por línea, dos líneas.
- Duración mínima 0,8 s; máxima 7 s; sin solapamientos.
- Velocidad de lectura máxima: 20 caracteres por segundo.
- No cortar unidades, cifras ni nombres propios.
- Español: español de España, natural, no literal.
- Neerlandés: neerlandés estándar; revisión nativa o fluida obligatoria antes de producción.
- Inglés: UK spelling (`organisation`, `metres`, `kilometres`, `centre`).
- Nunca usar el texto fonético de `_say` como subtítulo.
- Mantener `112`, `DGT`, `Guardia Civil`, `ES-Alert`, `NL-Alert`, `DATEX II`, `PCI`, `DTN`, `Reed-Solomon`, `QO-100`, `LoRa`, `Iridium` sin traducir cuando sean nombres propios.
- «Punto kilométrico» → `kilometre point` / `hectometerpaal`.
- «Cruz roja sobre el carril» → `red cross over the lane` / `rood kruis boven de rijstrook`.
- «Pasillo» → `emergency corridor` / `reddingsstrook`.
- «Puntos cívicos» → `civic points` / `burgerpunten`.

### 6.3 Flujo de traducción

1. Bloquear el guion inglés y los tiempos de voz.
2. Generar VTT inglés desde `voice.py`.
3. Traducir es y nl desde el texto subtitulado, no desde la voz.
4. Revisar las tres versiones contra el audio.
5. Corregir y volver a generar VTT sin tocar los tiempos.
6. Guardar el informe de revisión en `evidence/video/m95/subtitles-review.md`.

Si no hay revisión nativa de neerlandés, publicar el preview con `REVIEW_REQUIRED` y **no** decir que los subtítulos están verificados.

---

## 7. Integración web

### 7.1 Página

La portada usa `investor-next/app/senda-home.tsx`. Añadir/actualizar el bloque de vídeo:

```tsx
<video
  controls
  preload="metadata"
  playsInline
  poster="/media/m95/senda-m95-film-poster.jpg"
  aria-label="SENDA: when the network falls. English narration with Spanish, English and Dutch subtitles."
>
  <source src="/media/m95/senda-m95-film-en.mp4" type="video/mp4" />
  <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-film-es.vtt" default={locale === 'es'} />
  <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-film-en.vtt" default={locale === 'en'} />
  <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-film-nl.vtt" default={locale === 'nl'} />
</video>
```

Notas:

- El audio es inglés en las tres locales.
- Solo un `track` puede ser `default` por locale.
- Añadir un texto visible: «English narration · Subtítulos: Español · English · Nederlands».
- Mantener los vídeos antiguos como archivo, no borrarlos.
- `preload="metadata"`; no `autoplay`.
- Póster con texto legible; no fotograma negro.
- Si se añade un segundo vídeo en la misma página, usar IDs únicos y no duplicar `default`.

### 7.2 Notas de copy

Actualizar `C.es/filmNote`, `C.en/filmNote`, `C.nl/filmNote` en `senda-home.tsx`:

- ES: `Narración en inglés; subtítulos en español, inglés y neerlandés. Las simulaciones y los renders 3D los calcula el mismo código que lleva la app.`
- EN: `English narration; subtitles in Spanish, English and Dutch. The simulations and 3D renders are computed by the same code the app runs.`
- NL: `Engelse voice-over; ondertiteling in het Spaans, Engels en Nederlands. De simulaties en 3D-renders worden berekend door dezelfde code als de app.`

No escribir «protegido», «certificado» ni «auditado» en el copy público.

### 7.3 Enlaces

Añadir el vídeo o su CTA en:

- portada (`/`, `/es`, `/nl`);
- `investor-next/public/senda/arquitectura.html`;
- `investor-next/public/senda/carretera.html` para la pieza de ruta;
- `investor-next/public/senda/estado.html` solo si el vídeo explica el estado de verificación y no promete más de lo que hay.

No romper las URLs existentes.

---

## 8. Despliegue

### 8.1 Antes de desplegar

```powershell
cd C:\Users\2fabr\civic-relay
git status --short
node --test packages/senda/tests/*.test.mjs
node --test packages/senda-pci/tests/*.test.mjs
node --test scripts/release-manifest.test.mjs
cd investor-next
npm run build
node test-locales.mjs
node --test tests/*.test.mjs
```

Si algo falla, no se despliega.

### 8.2 Vercel

- Proyecto: `civic-relay-investor`.
- Root: `investor-next`.
- ID: `prj_WAFcG0kyKgq11V5vkoTwLatk3GNt`.
- Producción: `https://civic-relay-investor.vercel.app`.

Flujo:

1. Crear una rama de vídeo desde `mission/senda-95-20261108` (por ejemplo `video/senda-m95-20261108`).
2. Abrir un PR en borrador contra la rama de misión, no contra `master`.
3. Desplegar primero un **preview**.
4. Verificar el preview con la checklist de § 10.
5. Solo entonces desplegar a producción.
6. Registrar la URL, el SHA de Git y la hora.

Si se usa el conector de Vercel, usar el SHA completo y target `preview` primero. No usar `target=production` sin la checklist.

### 8.3 Hostinger

Si también se actualiza la entrega estática:

```powershell
cd C:\Users\2fabr\civic-relay
node scripts/entrega/generar-entrega.mjs
```

Subir solo el zip web actualizado, extraerlo en `public_html` y conservar el `.htaccess`. Verificar:

- URLs limpias;
- MIME `text/vtt` y `video/mp4`;
- HTTPS;
- service worker sin caché;
- `.vtt` y `.mp4` accesibles.

No subir secretos ni `.env.local`.

### 8.4 Cabeceras de seguridad

**Hallazgo:** el proyecto desplegado tiene root `investor-next`; su `investor-next/vercel.json` actual no declara cabeceras de seguridad. El `vercel.json` de la raíz sí las declara, pero puede no aplicarse al proyecto. No asumir que están activas: comprobarlas en producción.

Si faltan, portar a `investor-next/vercel.json`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()`
- `X-DNS-Prefetch-Control: on`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` **copiada de la ya probada**, sin simplificarla:
  `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.vercel.app https://api.civic-relay.com; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`

No cambiar la CSP a algo más permisivo para que cargue un vídeo. Los archivos son del mismo origen. Tampoco simplificarla: la app usa estilos e imágenes externas y la CSP de la raíz ya está probada.

Para los medios:

- `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` para MP4/VTT con nombre estable.
- No usar `immutable` salvo que el nombre incluya hash de contenido.
- `Accept-Ranges: bytes` y respuestas `206` para MP4.

### 8.5 Verificación de producción

```powershell
curl.exe -sI https://civic-relay-investor.vercel.app/ |
  Select-String -Pattern "strict-transport-security|x-content-type-options|x-frame-options|content-security-policy|referrer-policy|permissions-policy"

curl.exe -sI https://civic-relay-investor.vercel.app/media/m95/senda-m95-film-en.mp4

curl.exe -sI -H "Range: bytes=0-1023" https://civic-relay-investor.vercel.app/media/m95/senda-m95-film-en.mp4

curl.exe -s https://civic-relay-investor.vercel.app/media/m95/senda-m95-film-es.vtt |
  Select-Object -First 5
```

Comprobar:

- `200` o `206` en MP4;
- `content-type: text/vtt` en VTT;
- `WEBVTT` en la primera línea;
- cabeceras de seguridad presentes;
- ningún `404` en los tres tracks;
- ningún error de consola en `/`, `/es` y `/nl`.

---

## 9. Protección e integridad

Un vídeo público de marketing **no se protege con DRM**. La protección realista es esta:

### 9.1 Derechos

- El código sigue bajo MIT. No cambiar `LICENSE`.
- La marca «SENDA» no está registrada y no se licencia por MIT.
- Añadir en el cierre del vídeo y en la ficha web: `© 2026 Abraham Haddioui · SENDA`.
- Documentar en `NOTICE` cualquier recurso nuevo (música, voz, fuente, textura, imagen).
- No usar datos de God's Eye View con licencia no comercial.
- No usar metraje de terceros sin licencia escrita.
- No usar caras, matrículas ni datos personales.

### 9.2 Integridad

- Generar `SHA256SUMS.txt` para todos los MP4, VTT, pósteres y transcripciones.
- Guardar `ffprobe` en JSON.
- Guardar el SHA de Git y la URL de despliegue.
- Versionar los nombres o los parámetros de caché; no reemplazar un MP4 con el mismo nombre sin invalidar caché.
- Opcional: firmar el manifiesto con la PCI si el fundador lo pide. No afirmar que la PCI está integrada en producción si solo se usó para firmar un archivo.

### 9.3 Web

- HTTPS/HSTS.
- Cabeceras de § 8.4.
- Sin secretos en el bundle ni en el repositorio.
- Sin trackers de terceros añadidos para el vídeo.
- Sin `autoplay` con sonido.
- Sin `iframe` de terceros para el reproductor.
- Sin anuncios ni cookies nuevas.

### 9.4 Contacto de seguridad

`SECURITY.txt` contiene hoy `security@civic-relay.example.com`, que es un marcador de posición, y `Canonical`/`Policy` apuntan a `civic-relay.github.io`, no al despliegue actual. Antes de afirmar que el proyecto está «protegido»:

- sustituir el correo por uno real que el fundador controle;
- actualizar `Canonical`, `Policy` y `Acknowledgments` al dominio vigente;
- verificar que el buzón responde.

Si el fundador no ha dado el correo, dejar la tarea `BLOCKED` y no hacer afirmaciones públicas de seguridad. El despliegue del vídeo puede continuar; la afirmación «protegido y verificado» no.

### 9.5 Qué no hacer

- No usar DRM falso ni ofuscación de URL.
- No bloquear por `Referer`: rompe privacidad y caché.
- No usar tokens en la URL de un vídeo público.
- No poner el vídeo detrás de login si el encargo es una web pública.
- No decir «imposible de copiar».

---

## 10. QA y aceptación

### 10.1 Puertas obligatorias

No se publica en producción si falla cualquiera:

1. **Contenido**
   - [ ] Cada cifra tiene fuente en `M95_VIDEO_SOURCES.md`.
   - [ ] Cada simulación está etiquetada.
   - [ ] No hay promesas de sustituir al 112, certificación o validación de campo.
   - [ ] El guion inglés está bloqueado y aprobado.

2. **Voz**
   - [ ] Voz inglesa audible, sin clipping.
   - [ ] Pronunciación correcta de SENDA, DGT, 112, DATEX II, QO-100, LoRa, PCI, DTN.
   - [ ] Sin frases cortadas ni saltos.

3. **Subtítulos**
   - [ ] Tres VTT por pieza: es, en, nl.
   - [ ] `WEBVTT` y timestamps válidos.
   - [ ] Sin fonética de `_say`.
   - [ ] Sin solapamientos; duración 0,8–7 s.
   - [ ] Revisión holandesa declarada.
   - [ ] Sincronización al final dentro de ±200 ms.

4. **Imagen**
   - [ ] 1920×1080, 25 fps, H.264, yuv420p, faststart.
   - [ ] Sin textos cortados en 5, 40, 90 y 150 s.
   - [ ] Sin pantallas en blanco.
   - [ ] Rótulos ingleses en el master inglés.
   - [ ] Contraste legible y zona inferior libre para subtítulos.

5. **Web**
   - [ ] `/`, `/es`, `/nl` cargan.
   - [ ] Los tres tracks responden 200 y `text/vtt`.
   - [ ] El póster carga.
   - [ ] Vídeo reproducible con range requests.
   - [ ] Sin errores de consola.
   - [ ] Sin enlaces rotos.

6. **Seguridad**
   - [ ] Cabeceras de § 8.4 verificadas en producción.
   - [ ] `SECURITY.txt` sin marcador de posición, o tarea declarada `BLOCKED`.
   - [ ] Sin secretos en el diff.
   - [ ] SHA-256 de todos los archivos publicados.

7. **Legal**
   - [ ] `LICENSE` intacta.
   - [ ] `NOTICE` actualizado si hay recursos nuevos.
   - [ ] Sin datos no comerciales.
   - [ ] Sin caras, matrículas ni datos personales.
   - [ ] Copyright visible.

### 10.2 Comandos de QA

```powershell
cd C:\Users\2fabr\civic-relay\investor-next\public\media\m95

ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate,channels,sample_rate -of json senda-m95-film-en.mp4

Get-FileHash senda-m95-film-en.mp4 -Algorithm SHA256
Get-FileHash senda-m95-film-es.vtt -Algorithm SHA256
Get-FileHash senda-m95-film-en.vtt -Algorithm SHA256
Get-FileHash senda-m95-film-nl.vtt -Algorithm SHA256
```

Comprobación de VTT:

```powershell
Get-Content senda-m95-film-es.vtt -TotalCount 3
Select-String -Path senda-m95-film-*.vtt -Pattern " --> "
```

Comprobación de pistas en navegador:

```js
const tracks = await page.$$eval('video track', (els) =>
  els.map((t) => ({ lang: t.srclang, label: t.label, src: t.src }))
);
```

### 10.3 Informe final

Antigravity debe entregar:

```text
ENTRADA
- Commit y rama de partida.
- Guiones usados.
- Fuentes consultadas.

PROCESAMIENTO
- Cambios de código.
- Comandos ejecutados.
- Archivos generados.

VALIDACIÓN
- Tests.
- ffprobe.
- VTT.
- Cabeceras.
- Capturas.
- Enlaces de producción.

SALIDA
- Rutas de MP4, VTT y pósteres.
- URL de preview y de producción.
- SHA-256.
- Qué falta y qué no se ha podido verificar.

BLOQUEOS
- Lista explícita.

CONFIANZA
- 0–100 %, con motivo.
```

No se acepta «todo listo» sin URLs, hashes y capturas.

---

## 11. Evidencia de release

Crear:

```text
evidence/video/m95/
  release.json
  qa-report.md
  headers.txt
  subtitles-review.md
  ffprobe-film.json
  ffprobe-ruta.json
  screenshots/
    home-es.png
    home-en.png
    home-nl.png
    film-t05.png
    film-t40.png
    film-t90.png
    film-t150.png
  SHA256SUMS.txt
```

`release.json` debe incluir:

- release id (`senda-m95-video-2026-11`);
- commit;
- branch;
- deploy URL;
- deployedAt;
- files con path, bytes, duration, sha256;
- audio language (`en`);
- subtitle languages (`es`, `en`, `nl`);
- verification status por gate;
- unresolved items.

Actualizar:

- `docs/video/M95_VIDEO_RELEASE.md`;
- `00_CHANGELOG.md`;
- `docs/handoff/SENDA_RESUME_CHECKPOINT.md` si cambia el estado operativo.

No incluir MP4 grandes en `evidence/`; solo hashes y metadatos.

---

## 12. Bloqueos y límites

| Bloqueo | Efecto | Qué hacer |
|---|---|---|
| `SECURITY.txt` con correo de ejemplo | No se puede afirmar «protegido» | Pedir correo real al fundador; dejar `BLOCKED` |
| `estado.json` desactualizado | Cifras viejas en pantalla | Ejecutar tests y `build-status-page.mjs` antes de renderizar |
| Sin revisión nativa de neerlandés | Subtítulos no verificados | Publicar preview con `REVIEW_REQUIRED`; no producción |
| Sin credenciales de Vercel | No hay despliegue real | Dejar comandos y `BLOCKED`; no fingir |
| Sin ensayos de campo | No se puede decir «validado» | Mantener el texto de límites |
| Sin auditoría externa | No se puede decir «auditado» | Mantener «0 auditorías externas» |
| Issue #19 abierto | Provenance de release no resuelta | No cerrarlo; no afirmar release atestiguada |
| Render 1080p lento | Riesgo de timeout | `JOBS=2`, tramos, conservar `out/` |
| Páginas de la app en español | Rótulos no ingleses en el master | Internacionalizar o sustituir la escena |

---

## 13. Orden de ejecución recomendado

1. Leer § 0 y verificar el estado de Git.
2. Crear `docs/video/M95_VIDEO_SOURCES.md` y la escena `s12b` en `m95-film.json`.
3. Implementar los cambios de `voice.py`, `validate.mjs`, `render.mjs`, `make.sh`, `publish.sh`.
4. Renderizar V1 y revisar stills.
5. Generar VTT es/en/nl y revisar.
6. Integrar en la web y desplegar preview.
7. Ejecutar QA de § 10.
8. Desplegar producción.
9. Generar evidencia y actualizar changelog.
10. Entregar el informe final.

Los prompts listos para pegar están en:

- `docs/handoff/prompts/antigravity/00_MASTER_PROMPT.md`
- `docs/handoff/prompts/antigravity/01_PELICULA_M95.md`
- `docs/handoff/prompts/antigravity/02_RUTA_Y_SIMULACIONES.md`
- `docs/handoff/prompts/antigravity/03_VOZ_Y_SUBTITULOS.md`
- `docs/handoff/prompts/antigravity/04_WEB_DESPLIEGUE_PROTECCION.md`
- `docs/handoff/prompts/antigravity/05_QA_ACEPTACION.md`

**Regla final:** si no hay URL, hash, captura y test, no está hecho.
