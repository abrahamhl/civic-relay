# SENDA · Guía para hacer los vídeos promocionales 3D (para cualquier IA)

> **Para quién:** un agente más barato que retome los vídeos sin el historial de conversación.
> **Regla de oro:** los vídeos **no se animan a mano**. Cada fotograma lo calcula el **mismo núcleo de la app**, de forma determinista (`seek(t)`). Si algo no está en el núcleo o en una página de la app, **no sale en el vídeo**.
> Versión 1 · 05-11-2026 · rama `ccr-357397d4-i6q247`.

## 0. Qué hay

| Pieza | Ruta | Qué hace |
|---|---|---|
| Guiones | `media/senda-film/*.json` | `script.json` (película principal), `features.json` (capacidades v0.12), **`ruta.json`** (carretera, cámaras, Países Bajos y DGT; listo para grabar) |
| Validador | `media/senda-film/validate.mjs` | Comprueba el guion **antes** de gastar CPU |
| Todo en uno | `media/senda-film/make.sh` | Valida → voz → imagen → mezcla → publica |
| Voz | `media/senda-film/voice.py` | Kokoro TTS (ONNX, local, sin nube). Genera `out/voice-*.wav`, `out/timeline-*.js` y los subtítulos `out/subtitles-*.vtt` |
| Imagen | `media/senda-film/render.mjs` + `film.html` | Chromium sin pantalla (Playwright) fotograma a fotograma, 1280×720 a 25 fps, en 3 tramos en paralelo; luego ffmpeg (H.264 + AAC) |
| Escenas 3D y 2D propias | `media/senda-film/sims.js` | `arch3d`, `drone3d` (three.js 0.158) y `call`, `howsim` (canvas) |
| Escenas «page» | páginas de la app con `?film=1&viz=<id>` | La propia app dibuja la simulación: `window.SENDA_VIZ.seek(t)` (ver `investor-next/public/senda/kit.mjs`) |
| Música | `media/promo-video/music.py` | Fondo generado por código, con compresión ante la voz |
| Salidas | `media/senda-film/out/` (ignorada por git) | `senda-<guion>-<idioma>.mp4` |
| Publicación | `investor-next/public/media/` | `senda-<guion>-<idioma>.mp4`, `.vtt` y póster |

## 1. Preparar la máquina (una vez)

```bash
# Node 22, ffmpeg y Python 3 con:
pip install kokoro-onnx==0.6.1 numpy
# Modelos de voz (≈ 330 MB). Fuente: lanzamientos del proyecto kokoro-onnx («model-files-v1.0»)
mkdir -p ~/.cache/kokoro && cd ~/.cache/kokoro
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
# Playwright con Chromium (en los contenedores de Claude Code ya está: no reinstalar)
```

Si las URL de los modelos fallan, búscalas en el repositorio `thewh1teagle/kokoro-onnx`, en «Releases», y **no uses otro modelo sin avisar**: cambia la voz.
Voces usadas: `ef_dora` (español) y `bf_emma` (inglés), a velocidad 0,95.

## 2. Hacer un vídeo (el camino corto)

```bash
cd media/senda-film
node validate.mjs ruta es                          # 1) sin errores
CORE=192 E2E=43 ./make.sh ruta es                  # 2) voz + imagen + mezcla → out/senda-ruta-es.mp4
SCRIPT=ruta CORE=192 E2E=43 node render.mjs --stills es 5,40,90,150   # 3) fotogramas sueltos (out/stills-es/)
CORE=192 E2E=43 ./make.sh ruta es publicar         # 4) publicar en investor-next/public/media/
```

- `CORE` y `E2E` son las cifras de pruebas que muestra la escena `verify`. Cópialas de `investor-next/public/senda/estado.json` del último commit; no las inventes.
- Para `--stills` hay que generar antes la voz (paso 2), porque los tiempos salen de `out/timeline-*.js`.
- **`--stills` necesita `SCRIPT=<guion>`** (y `CORE`/`E2E` si sale la escena `verify`): sin él carga `script.json` y la línea de tiempo de la película, no la del guion que estás revisando.
- Duración orientativa en un contenedor de 4 núcleos: la voz tarda 2–4 min y la imagen de un vídeo de 4 min unos 20–40 min.

## 3. Escribir o cambiar un guion

```json
{
  "note": "qué vídeo es",
  "voices": { "es": { "voice": "ef_dora", "lang": "es", "speed": 0.95 } },
  "scenes": [
    { "id": "r1",
      "visual": { "kind": "page", "src": "/senda/carretera?film=1&viz=cadena" },
      "title": { "es": "La frenada que no ves" },
      "es":     ["Lo que se LEE en los subtítulos, con cifras: 120 km/h."],
      "es_say": ["Lo que se DICE: ciento veinte kilómetros por hora."] }
  ]
}
```

- **Tipos de escena (`visual.kind`):** `page`, `arch3d`, `drone3d`, `call`, `howsim`, `hub`, `kpis`, `shots`, `stack`, `verify` y `cta`.
- **`es` y `es_say` tienen el mismo número de frases.** `es_say` escribe con palabras lo que la voz lee mal (números largos, unidades, símbolos, «SENDA» → «Senda», «112» → «ciento doce»). Si se omite, se pronuncia `es`.
- **Inglés:** `en` y `en_say` (voz `bf_emma`; «112» → «one one two», siglas separadas: «D G T»).
- El validador bloquea las promesas falsas («replaces 112», «sustituye al 112») salvo si van negadas («SENDA never replaces 112», «nunca sustituye al 112»).
- Los subtítulos neerlandeses (`nl`) solo se generan si **todas** las escenas traen `nl`, con los tiempos de la voz inglesa.
- **Una frase = un subtítulo.** Que tenga menos de 260 caracteres; mejor 2–3 frases por escena.
- **Escenas `page` disponibles** (página: identificadores):

| Página | Visualizaciones |
|---|---|
| agua | riada, maremoto |
| barrido | barrido |
| camaras | niebla |
| carretera | cadena, sos, pk, escena, retencion, kamikaze |
| dgt | detectores |
| monte | monte |
| paises | msi |
| reserva | reserva, enjambre, rebote |
| sentidos | coral, arva, respira |
| triaje | triaje |

- Para **ver** una visualización suelta: abre `/senda/<pagina>?film=1&viz=<id>` y en la consola ejecuta `SENDA_VIZ.seek(5)`.

## 4. Crear una visualización nueva

Ni en `sims.js` ni en el guion: **en la página de la app**. Así sirve a la vez para la web, las pruebas y el vídeo.
1. En la página, una `<section class="card" data-viz="<id>">` con un `<canvas>` dentro.
2. Una función `draw(t)` que dibuje **solo en función de `t`**, sin `Date.now()`, sin azar y sin temporizadores. Para el azar, una semilla fija (mulberry32).
3. Regístrala en `run({ ..., <id>: draw })` (kit.mjs). En modo película (`?film=1&viz=<id>`) la página oculta todo lo demás y espera `seek(t)`.
4. Los números que se vean deben salir del **núcleo** (`/senda/core/*.mjs`), no escritos a mano.
5. Si la visualización es sintética o ilustrativa, **dilo en pantalla** («imagen sintética», «carretera inventada»).
6. Añade la página al E2E (`investor-next/scripts/senda-offline-e2e.mjs`) si tiene datos comprobables.

Escena 3D nueva en `sims.js` (solo si no puede vivir en una página): añade el tipo en `window.SIMS.full`, `canvasFor` y `draw`, y su `init` con three.js. Añádelo también a `KINDS` en `validate.mjs`.

## 5. Revisión de calidad (antes de publicar)

- [ ] `node validate.mjs <guion> <idioma>` sin errores.
- [ ] Fotogramas sueltos (`--stills`) en el arranque, la mitad y el final de 3 escenas: sin textos cortados ni solapados y sin pantallas en blanco.
- [ ] Subtítulos (`out/subtitles-*.vtt`) **sin fonética**: deben ser las frases de `es`, no las de `es_say`.
- [ ] Cifras de `verify` iguales a `estado.json`.
- [ ] Ninguna promesa falsa. SENDA **no sustituye** al 112, a ES-Alert o NL-Alert, al eCall ni a la atención del conductor. Lo simulado se dice simulado.
- [ ] Duración razonable: 3–5 min el vídeo largo; 45–90 s una pieza corta.
- [ ] Tamaño publicado ≤ ~35 MB (lo ajusta `make.sh` con CRF 27).

## 6. Errores ya vistos (y su arreglo)

| Síntoma | Causa | Arreglo |
|---|---|---|
| Página en blanco en una escena `page` | `render.mjs` no encontraba `/senda/x` sin `.html` | Ya resuelto: sirve `.html` y los MIME correctos |
| Errores «null» en modo película | El modo película borraba el DOM | Ya resuelto: `kit.mjs` oculta `<main>`, no lo borra |
| La voz dice «ocho segundos» y la pantalla 8,8 s | Texto redondeado a mano | Las cifras salen del núcleo; en `es_say`, el mismo valor en palabras |
| La voz lee mal «m/s²», «→», «%» | Símbolos | El validador avisa: escríbelos con palabras en `es_say` |
| Render lento o «timeout» | CPU ocupada (E2E o render a la vez) | Una tarea pesada cada vez; `JOBS=2` si hay poca CPU |
| Se reinicia el contenedor a mitad | Sesiones en la nube | Repetir solo el idioma o el tramo que falte; las salidas quedan en `out/` |

## 7. Mensaje listo para la IA que hará los vídeos

> Eres el editor de vídeo de SENDA. Repositorio `abrahamhl/civic-relay`, rama de trabajo indicada por el usuario. Lee `docs/handoff/07_VIDEOS_3D_RUNBOOK.md` y `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md`. Tarea: [describe el vídeo]. Reglas:
> 1. Usa solo escenas de la tabla del § 3 o crea visualizaciones nuevas en las páginas, como explica el § 4.
> 2. Valida el guion antes de renderizar.
> 3. Revisa fotogramas sueltos antes del render completo.
> 4. No inventes cifras: todas salen del núcleo o de `estado.json`.
> 5. Etiqueta lo simulado como simulado.
> 6. Antes de cada commit, ejecuta las pruebas del § 6 del handoff completo.
> 7. Commits en español con las líneas de atribución que pida la sesión.
>
> Entrega el MP4, los subtítulos y 4 fotogramas de muestra, y di qué no has podido verificar.

## 8. Ideas de vídeo preparadas

| Vídeo | Guion | Estado |
|---|---|---|
| Ruta protectora, cámaras, Países Bajos y DGT (es) | `ruta.json` | **Publicado** (05-11-2026): `investor-next/public/media/senda-ruta-es.mp4`, `.vtt` y póster; enlazado en la portada, en `/senda/arquitectura` y en `/senda/carretera` |
| La misma versión en inglés (+ subtítulos nl) | `ruta.json` (campos `en`, `en_say`, `title.en` y `nl`) | **Publicado** (05-11-2026): `senda-ruta-en.mp4`, `.vtt` en/nl y póster. Los subtítulos `nl` usan los tiempos de la voz inglesa. Los rótulos dibujados en los lienzos de la app siguen en español: la narración dice en voz alta «simulation», «synthetic image» e «invented road» |
| Piezas verticales de 45–60 s (una por escena) | un guion de 1–2 escenas | Pendiente; el formato vertical necesitaría otra plantilla de `film.html` |
