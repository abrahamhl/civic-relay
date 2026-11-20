---
name: senda-cinematic-web
description: Dirección suprema de frontend, web y explicaciones de SENDA (aprobada por el fundador el 20-11-2026). Úsala SIEMPRE que crees o cambies una página, una presentación, un vídeo, un explicador, un laboratorio web o cualquier material visual de SENDA / civic-relay (investor-next, /senda/*, películas, dosieres). Define el lenguaje cinematográfico, la mezcla de guía sencilla y ciencia real, las piezas vivas que ejecutan el núcleo, el uso de material real con licencia y la verificación antes de entregar.
---

# SENDA · dirección cinematográfica de web y explicaciones

Referencia canónica: `investor-next/public/senda/explica.html` + `explica-escenas.mjs` + `explica-vivo.mjs`
(capítulos «El ojo · El camino · El mando · Los sentidos · Drones · Sinestesia · Plataforma · Europa»).
Si dudas, copia su forma. La regla de veracidad de `CLAUDE.md` §1 manda sobre todo lo que sigue.

## 1. La idea que hay que transmitir
SENDA es **software** que convierte todo lo que sigue vivo (móviles, coches, cámaras públicas, drones, satélites,
radios) en una sola red de emergencia:
- **El ojo**: una superficie única con satélite, cámaras, vídeo de a bordo y testigos, con procedencia visible.
- **El camino**: cada mensaje viaja por todas las redes vivas a la vez (k de n, Reed-Solomon), con probabilidad honesta.
- **El mando**: cada cuerpo en su canal cifrado; mando unificado; la persona atrapada sabe que la ayuda llega.
- **La sinestesia**: hacer visible y audible lo invisible (radio, sonido, órbitas, respiración) **calculándolo**, nunca fingiéndolo.
Siempre: **coordinar hasta que llegan los servicios de emergencia, y ayudarles a coordinar mejor**.

## 2. Lenguaje visual (lo que el fundador aprobó)
- Fotografía **real** a sangre (100 % del ancho, `min-height` ~90–100svh) con degradado oscuro y crédito pequeño abajo a la derecha.
- Titulares enormes y cortos (`clamp(36px,5.6vw,80px)`, peso 800, `letter-spacing:-.035em`), una frase de apoyo grande y gris claro.
- Capítulos numerados (`01 · EL OJO`) en monoespaciada naranja `#ff7756`; mucho aire vertical (`padding:16vh 0`).
- Disposición `split` (escena interactiva 1,55fr + texto 1fr). Cifras en grande con contador animado al entrar en pantalla.
- Paleta: fondo `#04080b`, tinta `#eef3f4`, gris `#93a7b1`, ascua `#ff7756`, menta `#34d399`, cielo `#91d7e8`, sol `#fbbf24`, rosa `#ff5b6e`.
- Movimiento con sentido: Ken Burns lento en fotos, aparición al hacer scroll (`.rv`), pulsos en el incidente; todo se apaga con `prefers-reduced-motion`.
- Animaciones en `<canvas>` que **solo corren en pantalla** (IntersectionObserver), retina-aware.

### Antipatrones prohibidos (lo que el fundador llamó «diseño generado por IA»)
- Rejillas de tarjetas grises con `padding` grande y **borde de color a la izquierda**.
- Bloques de texto plano sin imagen, sin interacción y sin «vida».
- Etiquetas/pastillas en cada línea; emojis como iconografía principal; listas de viñetas como contenido central.
- Ilustraciones genéricas o imágenes generadas presentadas como fotos.

## 3. Guía sencilla + ciencia real, a la vez
- Cada capítulo: **frase llana** (qué problema, para quién) → **pieza viva** que lo demuestra → **detalle científico** desplegable
  (modo «Ciencia»: ecuaciones en MathML, nombre del módulo, supuestos, límites). El conmutador global «Guía / Ciencia» no oculta la verdad: solo la profundidad.
- Traducir siempre la jerga la primera vez (emisor = *sender*, vecino = *neighbor*, BLE…).
- Analogías que sean **ciertas**: «como una app de estrellas: no ve, calcula dónde está». Nunca prometer «ver a través de paredes», «100 % de entrega», «predecir terremotos» o «compatible con todos los cuerpos» si no está firmado.

## 4. Piezas vivas: el núcleo se ejecuta en el navegador
Importar de `/senda/core/*.mjs` (copia exacta de `packages/senda/src`, sincronizada con `node packages/senda/scripts/sync-web.mjs`).
Ejemplos ya hechos y reutilizables:
| Pieza | Módulo |
|---|---|
| Apagón hora a hora y pasarelas | `blackout.mjs` |
| Carrera de caminos k de n + fallos correlacionados | `bearers.mjs`, `erasure.mjs`, `delivery-assurance.mjs` |
| Baliza BLE bajo escombros proyectada en cámara | `rubble.mjs` |
| Respiración por Wi-Fi CSI y tabla de capacidades | `through-wall.mjs` |
| Notas de comunidad (credibilidad auditable) | `hazard-reports.mjs` |
| Cielo AR con satélites reales y Doppler | `orbital.mjs` + `data/tle/amsat-*.txt` |
| Datos por sonido (módem MFSK-16) | `acoustic-modem.mjs` |
| Remote ID de drones, dron mula, barrido | `drone.mjs`, `house-sweep.mjs` |
| Aviso de riada aguas arriba | `flood-watch.mjs` |
| Mensajes firmados entre cuerpos | WebCrypto ECDSA P-256 |
Si una pieza necesita un dato que no existe, **no se inventa**: se declara escenario (`SIMULACIÓN`) o se busca la fuente.

## 5. Material real disponible (usar antes que nada)
- Fotos con licencia: `investor-next/public/senda/fotos/` + `creditos.json` (autor, licencia, enlace, SHA-256). Nuevas fotos: Wikimedia Commons API
  (miniaturas en tamaños estándar, máx. ~1 petición/10 s; ante 429, parar), guardar crédito y huella **después** de recomprimir.
- Satélite real: `public/senda/data/smv2026/` (Sentinel-2 San Martín de Valdeiglesias + dNBR), `data/nepal2026/`.
- Cámaras DGT fechadas (CC BY): `data/perimetro/cam_*.jpg` + `medicion.json`; TfL en `data/referencias/`.
- Vídeo real procesado: `public/media/vision/dashcam.mp4` (YOLOX + ByteTrack), grabaciones de la app en `public/media/senda-demo/`.
- Capturas de la app: `docs/media/consola/`, `docs/media/nuevos/` (miniaturas en `fotos/app-*.jpg`).
- TLE reales: `data/tle/amsat-nasabare-2026-11-20.txt` (+ `.json` de procedencia). Los `ILLUSTRATIVE_TLES` del núcleo NO son reales.
Imágenes generadas por IA: solo con permiso del fundador y **siempre** rotuladas «ilustración generada», nunca como documento.

## 6. Etiquetas de veracidad (discretas, una por pieza)
`.truth.t-real` dato o imagen real con fuente · `.truth.t-calc` calculado por el código (nombra el módulo) ·
`.truth.t-sim` escenario inventado · `NO POSIBLE` cuando la física lo impide. Las fuentes van como pie de foto o `cite`, no en cajas.

## 7. Vídeo de la página
Grabar con Playwright (`recordVideo`, 1280×720) recorriendo los capítulos y pulsando las piezas; `ffmpeg -c:v libx264 -crf 30 -movflags +faststart -an`;
póster desde un fotograma de portada. El pie dice siempre «grabación de la página con simulaciones; no es un ensayo de campo».

## 8. Comprobación antes de entregar (obligatoria)
1. Chromium sin errores de página (`pageerror`/`console.error`) en escritorio 1440 px y móvil 390 px; `scrollWidth` = ancho de ventana.
2. Capturas de cada capítulo **miradas de verdad**: textos legibles, nada que se pise, marcadores dentro de cuadro.
3. Cada cifra: «¿de dónde sale?» → medido / calculado por este código / fuente X. Redondeos coherentes con el texto (no «99,0 %: no llega al 99 %»).
4. Unidades físicas plausibles (velocidades, tiempos de llegada, distancias): si la animación va acelerada, se dice y se convierte.
5. `node --test packages/senda/tests/*.test.mjs`, `cd investor-next && npm test && npx tsc --noEmit`, `node scripts/prove.mjs`.
6. Si se tocó el núcleo: `sync-web.mjs`, subir la versión de `public/senda-sw.js` y añadir la página o los módulos nuevos a su precaché.
7. Registrar en `docs/CUMPLIMIENTO.md` con hora UTC y hash real del commit.

## 9. Trampas ya pisadas (no repetir)
- La clase del modo Ciencia en `<body>` es `mode-sci`; si se llama igual que los bloques (`.sci{display:none}`) se oculta la página entera.
- Rejillas en móvil: `grid-template-columns:minmax(0,1fr)`, nunca `1fr` (el contenido ancho, como una fórmula, ensancha la página).
- Etiquetas `.truth` sin `nowrap`; fórmulas con `overflow-x:auto` dentro de su bloque.
- Las huellas SHA-256 de las fotos se calculan **después** de recomprimirlas.
- Las animaciones aceleradas convierten a unidades reales en el texto (los drones a 80 m/s eran un error).
- Una cámara AR debe apuntar también en vertical al objetivo, o el marcador se sale de cuadro.
- Comprobar las afirmaciones de plataforma en el código (p. ej. «el núcleo corre en Android»: sí, en WebView sin conexión).

## 10. Estructura de archivos
- Página: `investor-next/public/senda/<nombre>.html` (HTML + CSS en línea, sin dependencias externas; la CSP solo permite `'self'`).
- Lógica: módulos ES junto a la página (`<nombre>-*.mjs`), importando `/senda/core/…`.
- Enlazarla desde la portada (`investor-next/app/senda-home.tsx`) y la app (`public/senda/index.html`).
