# SENDA · Traspaso completo (handoff v2) para cualquier IA o persona

> **Fecha:** 05-11-2026 · **Versión del producto:** v0.19 · **Rama:** `ccr-357397d4-i6q247` · **PR:** #13 (borrador, apilado sobre #12 `ccr-bb7a95b8-t79scj`).
> **Estructura:** Entrada → Procesamiento → Validación → Salida. Este documento sustituye como punto de partida a `README.md` (v1, 04-11-2026), que sigue valiendo como contexto histórico.
> **Responsable y última palabra:** Abraham Haddioui (fundador). Ninguna IA decide alcance, licencia, marca, precio ni promesas públicas.

## 1. Ficha

| Campo | Valor |
|---|---|
| Nombre | **SENDA**: Sistema de Enrutamiento de Emergencia por canales alternativos |
| Qué es | Una capa que funciona **sin red**: mensajes, voz y avisos de emergencia por sonido, red local, Bluetooth, satélite y de mano en mano. Detecta peligros y coordina a quien ayuda hasta que llegan los servicios |
| Repositorio | `abrahamhl/civic-relay` (GitHub) |
| Producción | https://civic-relay-investor.vercel.app · app en `/senda` · portada en `/`, `/es` y `/nl` |
| Despliegue | Vercel, proyecto `civic-relay-investor` (raíz `investor-next`, id `prj_WAFcG0kyKgq11V5vkoTwLatk3GNt`) |
| Estado | Prototipo avanzado verificado por máquina. **Sin ensayos de campo, sin convenios firmados y sin certificaciones** |

## 2. Principios que no se negocian

1. **Primero sin red** (*offline first*): toda pantalla abre y calcula sin conexión tras la primera visita (service worker).
2. **Verdad verificable:** nada de fuentes, precios ni normas inventados. Lo dudoso se marca «pendiente de verificar». Lo simulado se dice simulado.
3. **Canal secundario:** SENDA **nunca sustituye** al 112, a ES-Alert o NL-Alert, al eCall ni a la atención del conductor.
4. **Permisos en el código:** cada integración declara su acceso en `packages/senda/src/platforms.mjs`.
   - **PASIVO:** legal hoy (datos abiertos, emisiones públicas, marcas visibles).
   - **CONVENIO:** preparado, pero necesita acuerdo, licencia o clave.
   - **NUNCA:** prohibido por diseño.
5. **Lo que es NUNCA:**
   - interceptar comunicaciones;
   - entrar en sistemas ajenos o controlarlos;
   - emitir sin licencia;
   - encender radios sin el toque del usuario;
   - declarar víctimas sin confirmación oficial;
   - el censo radio en zonas de conflicto;
   - cámaras privadas sin permiso, agregadores tipo «Ojo de Dios», reconocimiento facial o de matrículas;
   - leer Waze o Google Maps fuera de sus programas oficiales;
   - usar la SIM o la radio de la baliza V16;
   - **detectar o inhibir radares;**
   - publicar controles móviles de la policía;
   - premiar con puntos la rapidez o acercarse al peligro.
6. **Antes de quitar contenido, preguntar al fundador.** «Acortar» no es «sustituir».

## 3. Estado (v0.20)

| Medida | Valor |
|---|---|
| Pruebas del núcleo y del relé | 234/234 (`node --test packages/senda/tests/*.test.mjs packages/senda-relay/tests/*.test.mjs`) |
| E2E en Chromium, sin red | 49/49, con accesibilidad en 28 pantallas (`node investor-next/scripts/senda-offline-e2e.mjs`). La misma batería pasa contra la **exportación servida por Apache** con el `.htaccess` de Hostinger (`SENDA_BASE_URL=http://127.0.0.1:8088/senda`) |
| Web | `npm run build`, `node test-locales.mjs`, `node --test tests/*.test.mjs` (98/98) en `investor-next` |
| Módulos del núcleo | 60 ficheros en `packages/senda/src` (v0.20: `fire-cases`, `traffic-fusion`) (copiados a `investor-next/public/senda/core` con `sync-web.mjs`) |
| Pantallas de la app | 29 en `investor-next/public/senda/*.html` (v0.20: `/senda/referencias` y `/senda/evacuacion`) |
| Datos reales | `investor-next/public/senda/data/smv2026/` (Copernicus DEM, Sentinel-2 y GFS del 23-07-2026). Se reproducen con `scripts/datos-reales/` y `packages/senda/scripts/fire3d-real.mjs` |
| Paper | `docs/paper/SENDA_FUEGO3D_paper.(md\|html\|pdf)`, generado con `node packages/senda/scripts/build-paper.mjs --pdf` desde `resultados_v019.json` y `resultados_v020.json` |
| Incendios de referencia y tráfico (v0.20) | `investor-next/public/senda/data/referencias/` (GOES + HRRR de 7 incendios, cámaras TfL y Caltrans). Se reproducen con `scripts/datos-reales/goes_hrrr_incendio.py`, `packages/senda-vision/camera_flow.py` y `node packages/senda/scripts/referencias-real.mjs [dirGOES dirTfL dirCaltrans]` |
| Vídeos publicados | Película v5 (es/en), capacidades v0.12 (es), **ruta** (es/en, subtítulos es/en/nl) y visión real (`/media/vision/`) |
| Entrega autocontenida | `entrega/` con 7 zips deterministas (web para Hostinger, vídeos, código, documentación, evidencias, visión), `LEEME_PRIMERO` y huellas SHA-256. Se regenera con `node scripts/entrega/generar-entrega.mjs [--build]` |
| Financiación | `docs/financiacion/RONDA_FINANCIACION_2026-11-05.md` (convocatorias con fecha y fuente, diligencia, ajustes del software, plan de 90 días) |

## 4. Mapa del repositorio

| Ruta | Qué hay |
|---|---|
| `packages/senda/src/` | **Núcleo** (JavaScript ES puro, sin dependencias; corre igual en navegador, Node, service worker y relé) |
| `packages/senda/tests/` | Pruebas `node:test` del núcleo |
| `packages/senda/scripts/` | `sync-web.mjs` (copia el núcleo a la web; **obligatorio tras tocarlo**), `build-status-page.mjs` (página de estado), `datex-pack.mjs` (descarga DGT o NDW para el relé) |
| `packages/senda-relay/` | Relé del organismo, ciego al contenido (Docker) |
| `apps/senda-android/` | App Android (baliza BLE; paridad de formatos con la web) |
| `hardware/esp32-survey/` | Accesorio ESP32 (misma trama en C++) |
| `investor-next/` | Web Next.js (portada es/en/nl) y app estática en `public/senda/` |
| `investor-next/public/senda/kit.mjs` | Utilidades de las pantallas y **modo película** (`?film=1&viz=<id>`, `SENDA_VIZ.seek(t)`) |
| `investor-next/public/senda-sw.js` | Service worker (versión `senda-campo-v18`); **añadir aquí cada página o módulo nuevo** |
| `investor-next/scripts/senda-offline-e2e.mjs` | E2E sin red con tres teléfonos virtuales |
| `media/senda-film/` | Vídeos: ver [07_VIDEOS_3D_RUNBOOK.md](07_VIDEOS_3D_RUNBOOK.md) |
| `docs/research/SENSORES_Y_CANALES_ANDROID_2026-11-04.md` | Investigación con fuentes, por versión (§ 1–9) |
| `docs/evaluacion/` | Auditoría desde 5 perspectivas y **foco y acotación** (`FOCO_Y_ACOTACION_2026-11-05.md`) |
| `00_CHANGELOG.md` | Registro de cambios por versión: entrada, procesamiento, validación y límites |

### Núcleo por dominios

| Dominio | Módulos |
|---|---|
| Mensajes y cifrado | `envelope`, `bundle`, `b64`, `acoustic-modem`, `erasure`, `bearers`, `router`, `ladder`, `channels`, `beacon` |
| Llamadas y malla | `sdp-compact` (señalización de 80–110 bytes), `voice-mesh` |
| Sin red | `net-reserve` (batería de Internet), `swarm-cache` (biblioteca de vecinos), `coverage-memory` (puntos de rebote), `blackout` (caída de antenas), `orbital`, `satellites` |
| Personas y edificios | `occupancy`, `sensor-fabric`, `rf-census`, `rubble`, `through-wall`, `senses`, `house-sweep`, `building-twin`, `vision-layers`, `triage` |
| Peligros | `seismic`, `wildfire`, `flood-watch`, `rail-watch`, `rail-incident`, `geo-offline`, `zones`, `feeds` |
| Carretera (v0.14–v0.16) | `road-guard` (frenada, choque, trama de 24 B, columna de coches, SOS por coches, PK, pasillo, avisos, escena PAS y puntos cívicos), `drive-cases` (20 situaciones, V16 + SENDA), `datex2` (DATEX II de la UE, aforos, paneles, rood kruis), `cameras` (visibilidad por Koschmieder), `dgt-infra` (equipos de la DGT) |
| Gobierno y permisos | `platforms` (plataformas, integraciones, planes por escenario, perfiles de país), `roles` (credenciales firmadas), `remote-command`, `interop` (CAP 1.2), `drone` |

### Pantallas

`/senda` (app de campo) · `llamada` · `dron` · `arquitectura` · `sentidos` · `agua` · `triaje` · `monte` · `barrido` · `reserva` · `carretera` · `camaras` · `paises` · `dgt` · `red` · `incidente` · `edificios` · `organismo` · `ojo` · `incendio` · `via` · `estado`.

## 5. Cómo trabajar (procedimiento)

1. **Entrada:** lee este documento, el último bloque de `00_CHANGELOG.md` y `docs/evaluacion/FOCO_Y_ACOTACION_2026-11-05.md`.
2. **Antes de afirmar un dato** (cifra, norma, precio, API), búscalo y cita la fuente. Si no se puede verificar, márcalo «pendiente de verificar».
3. **Procesamiento:** el núcleo primero, con pruebas; después la pantalla, con su modo película si tiene visualización; después la arquitectura, la portada (es, en y nl), el service worker y el E2E.
4. **Validación**, siempre antes de hacer commit:
   ```bash
   node packages/senda/scripts/sync-web.mjs
   node --test packages/senda/tests/*.test.mjs packages/senda-relay/tests/*.test.mjs
   node investor-next/scripts/senda-offline-e2e.mjs           # con la CPU libre (no a la vez que un render)
   cd investor-next && npm run build && node test-locales.mjs && node --test tests/*.test.mjs && cd ..
   node packages/senda/scripts/build-status-page.mjs
   ```
5. **Salida:**
   - commit en español;
   - push a la rama asignada;
   - despliegue y comprobación en producción;
   - actualizar el PR;
   - entrada en `00_CHANGELOG.md`;
   - si hubo investigación, nueva sección en `docs/research/…`.

### Despliegue (Vercel)

Con el conector de Vercel, crear el despliegue con estos parámetros:
```json
{"name":"civic-relay-investor","project":"civic-relay-investor","target":"production",
 "gitSource":{"type":"github","org":"abrahamhl","repo":"civic-relay","ref":"<rama>","sha":"<sha completo>"}}
```
Después, esperar el estado `READY` y comprobar un archivo nuevo, por ejemplo `/senda/estado.json` o `/senda/core/<modulo>.mjs`. El contenedor de la sesión no puede leer `vercel.app` directamente: hay que usar el conector.

### Exportar a otro alojamiento (Hostinger o cualquier Apache/LiteSpeed)

1. `cd investor-next && npm run build`; si hay dominio propio, `SITE_URL=https://dominio npm run build`.
2. `node scripts/entrega/generar-entrega.mjs`, que crea `entrega/zips/*.zip`, `MANIFIESTO.json`, `SHA256SUMS.txt` y `LEEME_PRIMERO.md/.html`.
3. Se suben a `public_html` los zips `*-web-*` y se extraen allí. El `.htaccess` replica lo que hacía Vercel:
   - URL limpias;
   - tipos MIME de `.mjs`, `.vtt` y `.webmanifest`;
   - el service worker sin caché;
   - HTTPS obligatorio.
4. Para probarlo en local: Apache con `AllowOverride All` y los módulos `rewrite`, `headers` y `deflate`. Después, `SENDA_BASE_URL=http://127.0.0.1:8088/senda node investor-next/scripts/senda-offline-e2e.mjs`.

### Convenciones de git

- Commits en español, terminados con las líneas de atribución que indique la sesión.
- Cuerpos de PR terminados con la línea «Generated with Claude Code» y el enlace de la sesión.
- Comentarios en GitHub con el pie «Generated by Claude Code».
- **Ningún identificador de modelo** en commits, PR ni código.

## 6. Bloqueos conocidos

| Bloqueo | Efecto | Cómo se desbloquea |
|---|---|---|
| Entorno de sesión `civic-relay` (v0.20) | Permite Caltrans, WSDOT, DelDOT, NSW, Digitraffic, TfL, Generalitat, DGT y `wzmedia.dot.ca.gov`. Otras sesiones deben elegir ese entorno | Ya creado y aprobado por el fundador |
| La red de la sesión deniega `nap.dgt.es`, `opendata.ndw.nu`, `docs.ndw.nu` y `english.ndw.nu` | El lector DATEX II solo se ha probado con publicaciones construidas según el esquema | Añadir esos dominios en la configuración de red del entorno, o ejecutar `datex-pack.mjs` en otra máquina |
| No hay app nativa con difusión BLE, Wi-Fi Aware ni segundo plano | Sin aviso real entre coches ni malla Bluetooth | Prioridad técnica número 1 |
| Convenios no firmados (DGT 3.0, 112, Waze for Cities, Rijkswaterstaat, veiligheidsregio) | Las piezas CONVENIO están preparadas pero sin activar | Decisión y gestión del fundador |
| Sin ensayos de campo | Umbrales y alcance de radio sin calibrar | 3 ensayos propuestos en `FOCO_Y_ACOTACION` |
| Servidor de contenidos de la reserva | Mapas detallados, albergues y hospitales pendientes | Diseño hecho; falta implementarlo |
| La red de la sesión deniega NASA FIRMS, NASA Worldview/GIBS, Open-Meteo, AEMET OpenData, EFFIS y comunidad.madrid | El seguimiento de incendio usa una reconstrucción ilustrativa sobre la geografía real; no hay imagen de satélite real del incendio de julio de 2026 | Añadir esos dominios a la red del entorno, o descargar en una máquina sin bloqueo y guardar en `fixtures/` con su licencia |
| La web de la Comunidad de Madrid con fuegos y cámaras que recuerda el fundador no se ha localizado | Se integra lo verificable: páginas del ASEM 112 (PASIVO) y torres INFOMA (CONVENIO) | Pedir la URL al fundador y verificar titular y licencia |

## 7. Decisiones pendientes del fundador

1. Por dónde empezar: flotas, ayuntamiento o ambos.
2. Qué reconocen los puntos cívicos y si habrá clasificación pública.
3. Licencia del núcleo (hoy MIT; ver [01](01_PROPIEDAD_INTELECTUAL_Y_LICENCIA.md)).
4. Primer convenio: DGT 3.0 o un ayuntamiento.
5. Socio para el piloto neerlandés.
6. Fusionar los PR #12 y #13.
7. Vídeos: piezas verticales y si se traducen al inglés los rótulos de los lienzos de la app (hoy en español también en el vídeo inglés de `ruta`).
8. ¿La sociedad está constituida? Lo exigen ENISA, EIC y ESA BIC.
9. Dominio propio para Hostinger (`SITE_URL`) y cuándo cambiar los DNS.
10. Presentarse al **12.º CASSINI Hackathon** (27-29-11-2026) con el flujo de incendio.
11. Programas de doble uso (NATO DIANA, fondos de defensa): sí o no.
12. URL de la web de fuegos y cámaras de la Comunidad de Madrid que recuerda.
13. Condiciones de reutilización de las imágenes de Caltrans (hoy solo se publican números y enlaces, no imágenes).
14. Siguiente fuente de entrenamiento: VIIRS 375 m y perímetros oficiales por hora (NIFC) o casos europeos (EFFIS, MTG-FCI).

## 8. Historial resumido

| Versión | Qué añadió |
|---|---|
| v0.7–v0.9 | Fusión de evidencias, visión por capas, vigilancia ferroviaria, Ojo de SENDA, incendio cartográfico, película v4 |
| v0.10–v0.11 | Llamadas sin Internet (arranque por sonido), censo radio con dron, arquitectura visual, malla de voz real, película v5 (es/en) |
| v0.12 | Plataformas y permisos, riadas y maremotos, triaje, monte, sentidos, dron casa por casa, auditoría desde 5 perspectivas, vídeo de capacidades |
| v0.13 | Batería de Internet, biblioteca de vecinos, puntos de rebote |
| v0.14 | Ruta protectora: frenada, choque, SOS por coches, PK sin red, escena PAS y puntos cívicos |
| v0.15 | 20 situaciones al volante, V16 + SENDA, cámaras públicas (visibilidad), DATEX II, rood kruis, perfiles España y Países Bajos |
| v0.17 | Visión con vídeo real (`packages/senda-vision`: YOLOX Apache + ByteTrack), coches conectados y fusión (`vehicle-link.mjs`: Ley de Datos, DFRS, k-anonimato, Kalman, posición de ~10 m a ~1-2 m), renders realistas en el kit, `/senda/trafico`, `/senda/vehiculos`, documento `docs/architecture/BACKEND_VEHICULOS_Y_FUSION_2026-11-05.md` |
| v0.19 | Incendio en 3D con datos reales (terreno Copernicus, Sentinel-2, GFS): masa de aire, viento 3D con conservación de masa, pluma, cámaras con oclusión, coches-estación, aviones, conjunto y asimilación de la cicatriz; visor three.js con gestos; paper científico; investigación del 112 y de canales |
| v0.18 | Seguimiento de incendio (`fire-watch.mjs`, `/senda/fuego`): columna situada cruzando rumbos de torres, cámaras y la brújula del móvil, perímetro y avance por satélite, 30-30-30, HDW, Fosberg e ISI, intensidad de Byram, criticidad, carreteras a cortar y avisos a coches. Caso real: M-501, 23-07-2026. Entrega autocontenida para Hostinger (`entrega/`), validada con Apache. Paquete de financiación |
| v0.20 | Incendios de referencia con satélite real (GOES + HRRR, 7 incendios, validación dejando uno fuera, contraste con NIST), coches + cámaras de tráfico + fuego (`traffic-fusion.mjs`: CTM, EnKF, cierres, umbral dinámico), cámaras reales de Caltrans y TfL, registro de 32 fuentes, `/senda/referencias` y `/senda/evacuacion` |
| v0.16 | Infraestructura de la DGT validada (ninguna pasarela de radio; datos publicados y DGT 3.0), aforos → cola, paneles → avisos, radares publicados → límite. Kit de vídeo para otras IA (`validate.mjs`, `make.sh`, `ruta.json`) y este handoff |

## 9. Mensaje de arranque para otra IA

> Trabajas en SENDA (`abrahamhl/civic-relay`). El fundador escribe en español y tiene la última palabra. Antes de nada, lee `docs/handoff/HANDOFF_COMPLETO_2026-11-05.md` (este documento), el último bloque de `00_CHANGELOG.md` y `docs/evaluacion/FOCO_Y_ACOTACION_2026-11-05.md`. Respeta los principios del § 2: el código ya los aplica en `platforms.mjs`. Verifica con búsquedas cada dato nuevo y cita la fuente. Sigue el procedimiento del § 5 y no hagas commit sin las pruebas en verde. Si la tarea son vídeos, sigue `docs/handoff/07_VIDEOS_3D_RUNBOOK.md`. Al terminar, informa en español: qué has hecho, cómo lo has validado, qué falta, qué decide el fundador y una nota de confianza (0–100 %).
