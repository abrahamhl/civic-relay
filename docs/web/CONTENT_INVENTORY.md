# Inventario de Contenidos y Auditoría Técnica — Web de SENDA (`investor-next/`)

**Fecha:** 2026-11-19 · **Rama:** `feat/web-redesign-20261119` · **Commit base:** `743c4f5`  
**Dominio canónico:** `https://civic-relay-investor.vercel.app` (rutas `/`, `/es/`, `/nl/`)

> Regla aplicada (§2 del Prompt Maestro): ningún contenido, ruta o módulo de `investor-next/` se elimina sin registro explícito de destino (`Conservar` / `Fusionar` / `Mover a Ciencia` / `Archivar`).

---

## 1. Rutas existentes en `investor-next/app/`

| Ruta actual | Idiomas | Contenido actual | Destino en la nueva IA |
|---|---|---|---|
| `/`, `/es/`, `/nl/` (`app/(en)/page.tsx`, `app/(localized)/[locale]/page.tsx`) | EN, ES, NL | `InvestorPage`: landing muy extensa (~18 componentes apilados, estética oscura densa, mezcla de marcas OEP/Civic Relay/SENDA, ~67 KB CSS monolítico) | **Rediseñar (Home)** — Portada sobria tipo producto (comprensible en <60 s), con `EvidenceBadge` en cada cifra y entrada clara a las 6 secciones |
| `/mission-control/`, `/es/mission-control/`, `/nl/mission-control/` | EN, ES, NL | `SurfaceView (MISSION_CONTROL)`: globo 3D Three.js + Sector Intelligence CCTV | **Conservar + Fusionar en `/platform/`** — Mantener la ruta operativa por compatibilidad de enlaces y tests; la nueva experiencia principal de Centro de Control vive en `/platform/` (`/es/platform/`, `/nl/platform/`) |
| `/mando/`, `/es/mando/`, `/nl/mando/` | EN, ES, NL | `SurfaceView (MANDO)`: `CommandSurface` (modelo `mando-2.2.0`, activaciones, RF budget, corredor A12) | **Conservar** — Mantener íntegra (validada por `test-locales.mjs` y `command-surface-model.test.mjs`) y enlazar desde `/platform/` y `/science/` |
| `/science/`, `/es/science/`, `/nl/science/` | EN, ES, NL | `SurfaceView (SCIENCE)`: teoremas, calibración LOFO, papers, simulador store-and-forward, lab hardware | **Rediseñar (Ciencia)** — Nueva página `/science/` (`/es/science/`, `/nl/science/`) con tarjetas de módulos científicos, resultados inconclusos explícitos (`H-FIRE-B`), biblioteca de papers y acceso directo al Visor 4D (`/senda/visor.html`, `/senda/fuego3d.html`) |
| `/defense/`, `/es/defense/`, `/nl/defense/` | EN, ES, NL | `SurfaceView (DEFENSE)`: bóveda aislada `noindex`, `data-classification="DUAL_USE_DEFENSE"` (Reglamento UE 2021/821) | **Conservar aislada** — Sigue `noindex`, fuera de la navegación civil, verificada por `test-locales.mjs` |
| `/senda/*` (`public/senda/*.html`) | ES | PWA offline-first (Service Worker + IndexedDB): `consola.html`, `visor.html`, `fuego3d.html`, `vuelo.html`, `aislamiento.html`, `radio.html`, `agua-nl.html`, `estado.html`, `papers/*` | **Conservar e integrar** — Enlazada y referenciada desde Plataforma, Ciencia y Evidencia; intacta para despliegue estático y Hostinger |
| *(Nueva)* `/product/`, `/es/product/`, `/nl/product/` | EN, ES, NL | — | **Crear (Producto)** — Narrativa en 5 escenas con scroll anclado + diagrama `MESSAGE → STORE → ROUTE → MULTIPATH → DEDUP → ACK` |
| *(Nueva)* `/platform/`, `/es/platform/`, `/nl/platform/` | EN, ES, NL | — | **Crear (Plataforma — Centro de Control)** — Mapa interactivo (MapLibre + fallback vector offline), panel capas/eventos, inspector de objeto, grafo de correlación, línea de tiempo, barra `⌘K`, 8 escenarios guiados y tour de 60–90 s |
| *(Nueva)* `/evidence/`, `/es/evidence/`, `/nl/evidence/` | EN, ES, NL | — | **Crear (Evidencia)** — Tabla filtrable y responsiva desde `EVIDENCE_REGISTER.md` + `evidence/` + gráficos 2D sobrios |
| *(Nueva)* `/investors/`, `/es/investors/`, `/nl/investors/` | EN, ES, NL | — | **Crear (Inversores)** — Resumen ejecutivo, uso de fondos (escenarios ilustrativos), hitos, riesgos, equipo, descargas y formulario mínimo RGPD |
| *(Nueva)* `/security/`, `/es/security/`, `/nl/security/` | EN, ES, NL | — | **Crear (Seguridad y gobernanza)** — Modelo de amenazas, privacidad por diseño, RGPD/ENS honesto, transparencia IA (NLnet v2.0), `SECURITY.txt` |
| *(Nueva)* `/design/` | EN/ES | — | **Crear (Design System interno)** — Catálogo de tokens, tipografía, semáforo de evidencia, `EvidenceBadge`, tarjetas, tablas y controles |

---

## 2. Componentes existentes en `investor-next/app/`

| Componente | Descripción breve | Destino |
|---|---|---|
| `investor-page.tsx` | Portada heredada con 18 bloques apilados | **Archivar (mantener módulo por tests `system-story.test.mjs` y `telecom-suite.test.mjs`)**; sustituida en `/` por `_senda/pages/HomePage.tsx` |
| `senda-home.tsx` + `senda-home.css` | Hero/landing intermedia de SENDA | **Fusionar** contenido verificado en `HomePage.tsx` y `ProductPage.tsx`; archivar archivo antiguo |
| `apple-living-nav.tsx`, `responsive-header.tsx`, `senda-banner.tsx` | Navegaciones superpuestas heredadas | **Archivar** — Sustituidas por un único `SiteHeader.tsx` translúcido de 6 ítems |
| `audience-filter.tsx` | Selector de audiencia antiguo | **Fusionar** en accesos directos de la Home e Inversores |
| `crisis-story.tsx`, `scroll-experience.tsx`, `system-explained.tsx`, `system-story-data.ts` | Historia 5 actos + flujo 8 etapas + globo Three.js | **Fusionar en `/product/`** (narrativa 5 escenas + flujo 6 pasos) y conservar fuentes por regresión de tests |
| `evidence-board.tsx` | Tablero resumido de evidencias | **Fusionar en `/evidence/`** con tabla filtrable completa y `EvidenceBadge` |
| `command-surface.tsx` + `lib/command-surface.ts` | Superficie `/mando/` v2.2.0 | **Conservar** en `/mando/` y reutilizar modelos/escenarios en `/platform/` |
| `mission-control.tsx`, `sector-intelligence-console.tsx` | Globo 3D y consola CCTV sectores (El Tiemblo, Valencia, Arnhem) | **Conservar** en `/mission-control/` y conectar datos/escenarios en `/platform/` |
| `coordination-lab.tsx`, `transport-sandbox.tsx`, `emergency-building.tsx` | Simulador store-and-forward, edificio 3D | **Mover a Ciencia** (referenciado desde `/science/` y accesible en `/mission-control/`) |
| `calibration-panel.tsx`, `scientific-theorems-lab.tsx`, `scientific-papers-deck.tsx`, `editorial-science.tsx`, `rail-safety-lab.tsx`, `vehicular-doppler-lab.tsx`, `telecom-rf-radar-suite.tsx` | Laboratorios científicos, calibración LOFO, 5 teoremas, papers, ferrocarril, Doppler, RF/NTN | **Mover a Ciencia** — Integrados/enlazados en `/science/` y preservados en `surface-view.tsx` |
| `live-hardware-console.tsx`, `device-field-diagnostics.tsx` | Diagnóstico hardware navegador WebCrypto/WebRTC | **Mover a Ciencia / Evidencia** (explícitamente etiquetado como loopback/laboratorio local) |
| `hyperframes-cinema-deck.tsx` | Reproductor múltiple de vídeos m95/m96 | **Fusionar** vídeos seleccionados (`senda-demo`, `m95`, `m96`) en Producto, Plataforma y Ciencia con `preload="metadata"` y póster |
| `master-vision.tsx` + `lib/master-vision.mjs` | Los 20 módulos, 8 escenarios (S01–S08) y 8 puertas (G0–G7) | **Conservar y reutilizar** — Los 8 escenarios alimentan directamente el Centro de Control `/platform/` |
| `defense-vault/*` | Módulos de doble uso (contramedidas UAV) | **Conservar aislados** únicamente en `/defense/` (`noindex`) |
| `language-document.tsx` | Sincroniza `document.documentElement.lang` | **Conservar** en layouts localizados |

---

## 3. Inventario de medios y vídeos (`investor-next/public/media/`)

| Recurso | Formato / Tamaño aprox. | Uso asignado en el rediseño |
|---|---|---|
| `senda-demo/SENDA-consola-promo.mp4` | MP4 (3,5 MB) | **Home & Plataforma** — Vista previa real de la consola de situación (etiquetado `Observado — grabación de app`) |
| `senda-demo/SENDA-demo-guiada.mp4` | MP4 (1,1 MB) | **Producto** — Escena de flujo completo y modo relé |
| `senda-demo/SENDA-demo-real-mensaje-sin-red.mp4` | MP4 (0,9 MB) | **Producto** — Escena 2/3: envío sin red y store-and-forward |
| `senda-demo/SENDA-demo-real-incendio-3d.mp4` | MP4 (4,5 MB) | **Ciencia** — Módulo SENDA-3D (San Martín de Valdeiglesias) |
| `senda-demo/SENDA-nepal-sobrevuelo.mp4` | MP4 (7,7 MB) | **Ciencia** — Sobrevuelo 3D real Langtang (USGS + Sentinel-2 + Copernicus DEM) |
| `senda-demo/SENDA-plataforma-promo.mp4`, `SENDA-demo-real-atlas.mp4`, `SENDA-demo-real-avisos-centro.mp4` | MP4 (0,6–3,1 MB) | **Plataforma / Prensa** — Galería y kit de prensa |
| `m95/senda-m95-30s-en.mp4`, `60s`, `90s`, `broadcast-special`, `reel-blacksky`, `sim-*` + `.vtt` (EN/ES/NL) | MP4 + VTT | **Producto & Kit de prensa** — Reproducción bajo demanda (`preload="metadata"`, póster estático, subtítulos VTT) |
| `m96/senda-m96-promo-{en,es}.mp4` + póster + `.vtt` | MP4 (~70 MB) | **Inversores / Kit de prensa** — Enlace de reproducción diferida (nunca autocarga en Home para preservar LCP < 2 s) |
| `media/renders/*.svg` (7 diagramas vectoriales) | SVG (6–13 KB) | **Ciencia & Evidencia** — Diagramas PAER, ITU-R P.838, Merkle RFC6962, ferrocarril, 4D globe, V16 |
| `media/vision/{dashcam,fixed}.{mp4,jpg,json}` | MP4 + JSON | **Ciencia** — Visión de tráfico real YOLOX-s + ByteTrack |

---

## 4. Fuentes reales integradas vs. datos simulados (verificado en código)

| Fuente | Estado en repositorio | Ruta en código / snapshot | Etiqueta en UI |
|---|---|---|---|
| **GDACS** (alertas globales) | Snapshot real fechado + parser | `public/senda/data/referencias/gdacs_eventos.json`, `apps/senda-live/tests/gdacs-osint.test.mjs` | `Observado` (snapshot, no tiempo real) |
| **DGT** (incidencias, V16 y cámaras España) | Snapshot real + parser DATEX II | `public/senda/data/referencias/dgt_incidencias.json`, `dgt_camaras.json`, `packages/senda/src/dgt-infra.mjs` | `Observado` (snapshot) |
| **NDW** (tráfico Países Bajos, CC0 1.0) | Snapshot real actualizado | `public/senda/data/referencias/ndw_situaciones.json`, `packages/senda/src/datex2.mjs` | `Observado` (snapshot) |
| **USGS / EMSC** (sismos reales) | Parsers + snapshots reales (incl. Langtang `us7000tbwb`) | `packages/senda/src/feeds.mjs`, `public/senda/data/referencias/{usgs,emsc}_sismos.json` | `Observado` (snapshot) |
| **NOAA GOES-R & HRRR** (incendios) | Snapshot 7 incendios reales + script reproduc. | `public/senda/data/referencias/goes_casos.json`, `experimental/senda-fire-physics/` | `Observado` / `Predicho` (H-FIRE-B inconcluso) |
| **Copernicus EMS / DEM / CDSE STAC / Sentinel-2** | Datos reales EMSR773 (Valencia), SMV 2026, Langtang | `packages/senda/src/copernicus-cdse.mjs`, `copernicus-ems.mjs`, `public/senda/data/{dana2024,smv2026,nepal2026}/` | `Observado` |
| **NASA FIRMS** | Conector de código (clave API requerida para vivo) | `packages/senda/src/nasa-firms.mjs` | `No probado` en vivo en web estática |
| **Rijkswaterstaat (Agua NL)** | Snapshot 25 estaciones (17-11-2026) | `packages/senda/src/water-nl.mjs`, `public/senda/agua-nl.html` | `Observado` (foto fija) |
| **Digitraffic / Tráfico ferroviario y marítimo** | No hay feed live Digitraffic en web estática; capa ferroviaria/marítima del Centro de Control marcada explícitamente | `packages/senda/src/rail-watch.mjs`, `rail-incident.mjs` | `Simulado` |
| **Rutas mesh, nodos relé, cobertura RF, acciones de mando** | Modelos deterministas en software (0 ensayos físicos de 2 teléfonos) | `packages/senda/src/router.mjs`, `investor-next/lib/*` | `Simulado` / `No probado` físicamente |

---

## 5. Lista de deuda técnica identificada (pre-rediseño)

1. **CSS monolítico sin tokens ni modo claro/oscuro (`app/globals.css`, 67 KB):** solo tema oscuro fijo, colores codificados a mano, sin escala tipográfica ni contraste AA verificado en modo claro.
2. **Sobrecarga de portada (`investor-page.tsx`):** 18 secciones heterogéneas en una sola página con carga pesada de JavaScript (incluye Three.js + laboratorios densos en la ruta inicial), perjudicando comprensión en <60 s y rendimiento LCP/JS inicial (<170 kB gz).
3. **Fragmentación de marca e IA:** coexisten encabezados distintos (`Civic Relay`, `OEP`, `SENDA`) y tres barras de navegación diferentes (`AppleLivingNav`, `ResponsiveHeader`, `topbar`) sin jerarquía única de 6 ítems.
4. **Ausencia de sistema unificado de evidencia (`EvidenceBadge`):** los avisos aparecen como bloques largos de texto en lugar de etiquetas interactivas trazables con fuente, fecha, SHA y límites por cada cifra.
5. **Iconografía mixta con emojis:** presencia de emojis (`🏔️`, `🌍`, `⚠️`, etc.) en vez de una librería uniforme de iconos de trazo fino (`lucide-react`).
6. **Falta de SEO estructurado completo:** ausencia de `sitemap.xml`, `robots.txt`, JSON-LD (`Organization`, `SoftwareApplication`, `WebSite`), `.well-known/security.txt` y Open Graph por página con imagen estática dedicada.
7. **Sin paquete de entrega actualizado en `entrega/`:** el ZIP actual en `entrega/` data del 06-11-2026 (`5b97a0e`) y no refleja las nuevas páginas ni el rediseño.
8. **Sin política explícita de cookies/analítica:** falta el aviso mínimo de solo cookies técnicas sin seguimiento previo.
