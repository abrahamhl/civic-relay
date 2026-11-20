# Informe de Rediseño Completo — Web Pública de SENDA (`investor-next/`)

**Fecha:** 2026-11-20 · **Rama:** `feat/web-redesign-20261119` · **Dominio canónico:** `https://civic-relay-investor.vercel.app`  
**Estado:** Completado en rama local con QA automatizado en verde (sin fusionar a `master` hasta aprobación del fundador).

---

## 1. Resumen ejecutivo (Antes vs. Después)

| Dimensión | Antes (`investor-page.tsx` heredada) | Después (Rediseño SENDA) |
|---|---|---|
| **Arquitectura de información** | Portada única sobrecargada con 18 secciones heterogéneas y 3 barras de navegación superpuestas | Navegación fija translúcida con **6 ítems** (`Producto`, `Plataforma`, `Evidencia`, `Ciencia`, `Inversores`, `Seguridad`), selector `ES / EN / NL`, tema claro/oscuro y único CTA primario «Solicitar dossier» |
| **Lenguaje visual y tono editorial** | Solo oscuro fijo (`globals.css` monolítico de 67 KB), mezcla de acentos y emojis en UI | Sistema de tokens (`styles/tokens.css`), claro por defecto + modo oscuro completo (`prefers-color-scheme` + `<meta name="color-scheme">` + `data-theme`), una familia (`Inter` 400/500/600), **un solo acento** (azul señal), **iconografía Lucide 100 % sin emojis** y tono centrado en las capacidades construidas (conservando únicamente avisos legales imprescindibles para servicios sensibles de emergencia) |
| **Catálogo completo de servicios, ciencia y vibe coding** | Servicios y papers dispersos sin catálogo unificado ni narrativa de ingeniería asistida | **12 servicios interactivos filtrables** (PWA sin red, malla multiportador, módem MFSK-16, radio DEM, consola de 16.699 fuentes, Visor 4D, Mando/Mission Control 3D, SENDA-3D incendios, riadas EMSR773 + agua NL, Langtang 3D, fusión ferroviaria + visión YOLOX y gemelo 3D de edificios), **los 5 papers científicos**, **los 7 renders vectoriales SVG** y sección dedicada a **delegación y orquestación en vibe coding bajo dirección humana constante** |
| **Vídeos completos con idioma automático y subtítulos ES/EN/NL** | Reproductor básico sin autodetección de navegador ni subtítulos multilingües unificados | Componente `MediaVideo` con detección automática de `navigator.languages` / `navigator.language`, selección automática del vídeo en el idioma del navegador (y activación automática de subtítulos en neerlandés para navegadores `nl`), selector en 1 clic de **audio (`ES`/`EN`)** y **subtítulos (`No`/`ES`/`EN`/`NL`)**, con los vídeos más completos (`senda-m96-promo`, `senda-film`, `senda-m95-broadcast-special`, `senda-ruta`, `reel-blacksky`, `reel-math`, `role-citizen`, `role-developer`, demos 3D y visión YOLOX) y `preload="none"` para carga instantánea |
| **Plataforma operativa (`/platform/`)** | Superficies separadas sin barra de comandos ni grafo de correlación unificado | **Centro de Control (`/platform/`)** a pantalla completa: mapa central (MapLibre GL offline sobre Natural Earth + fallback SVG), 7 capas conmutables, cola de eventos por prioridad, ficha de objeto, grafo de correlación interactivo (`Evento <-> Sensor <-> Ruta <-> Equipo <-> Decisión`), línea de tiempo `T+00m..T+90m`, barra `⌘K`, 8 escenarios canónicos (`S01–S08`), demo guiada de 6 pasos y controles simulados en 2 pasos con registro de auditoría |
| **i18n y SEO** | Sin `sitemap.xml`, `robots.txt`, `favicon.ico`, JSON-LD ni `.well-known/security.txt` | **3 idiomas completos** (`/`, `/es/`, `/nl/` en las 6 secciones), `hreflang`, `canonical`, `favicon.ico`, `sitemap.xml`, `robots.txt`, JSON-LD (`Organization`, `SoftwareApplication`, `WebSite`), Open Graph / Twitter Cards (`/og-senda.svg`) y `.well-known/security.txt` |

---

## 2. Métricas reales verificadas

### Lighthouse (Home `/` sobre servidor estático limpio `investor-next/out/`)

| Categoría | Puntuación medida | Objetivo | Estado |
|---|---:|---:|---|
| **Performance** | **99 / 100** | ≥ 95 | PASS |
| **Accessibility** | **100 / 100** | ≥ 95 | PASS |
| **Best Practices** | **100 / 100** | ≥ 95 | PASS |
| **SEO** | **100 / 100** | ≥ 95 | PASS |

**Core Web Vitals y presupuesto de carga (Home `/`):**
- **LCP:** `1.66 s` (objetivo `< 2.0 s`)
- **FCP:** `1.66 s`
- **CLS:** `0.000` (objetivo `< 0.05`)
- **TBT:** `77 ms`
- **JS inicial en Home (gzip):** `167.1 kB` en 7 chunks (objetivo `< 170 kB gz`)

### QA Automatizado (Tests, Locales, Dominio y Playwright)

| Comprobación | Comando | Resultado real |
|---|---|---|
| TypeScript estricto | `pnpm --dir investor-next run type-check` | **PASS** (0 errores) |
| Tests unitarios + rediseño | `pnpm --dir investor-next run test` | **117 / 117 PASS** (112 existentes + 5 en `tests/senda-redesign.test.mjs`) |
| Exportación estática + `lang` | `pnpm --dir investor-next run build` | **33 / 33 rutas estáticas**, 20/20 páginas `es`/`nl` verificadas por `finalize-locales.mjs` |
| Verificación de idiomas y bóveda | `pnpm --dir investor-next run check:locales` | **PASS** (EN/ES/NL Home + 6 secciones + `/mando/` + `/defense/` aislada `noindex` + SEO) |
| Gate de dominio canónico | `pnpm --dir investor-next run check:domain` | **PASS** (`https://civic-relay-investor.vercel.app`) |
| Playwright multi-viewport (`390`, `834`, `1440`) | `node investor-next/scripts/redesign-qa-playwright.mjs` | **38 vistas comprobadas**, **0 enlaces/vídeos/pistas/SVG rotos**, **0 desbordamiento horizontal**, **0 errores de consola**, autodetección real de navegador `es-ES` y `nl-NL` en `MediaVideo` + subtítulos `ES`/`EN`/`NL`, `EvidenceBadge`, modo oscuro, `⌘K`, demo guiada de 6 pasos, grafo de correlación y acción simulada en 2 pasos con auditoría: **PASS** |
| Paquetes ZIP de Hostinger | `node scripts/entrega/generar-entrega.mjs` + extracción limpia verificada | **PASS** (`1-web-hostinger.zip` 89,92 MB + 4 ZIPs de películas HD < 68 MB cada uno; 36/36 ficheros clave verificados en extracción limpia) |

---

## 3. Capturas Antes / Después

- **Antes (referencia histórica en repo):** `evidence/senda/home-es.png`
- **Después (generadas por Playwright en este build):**
  - Portada escritorio claro (1440 px): `docs/web/screenshots/home-en-1440-light.png`
  - Portada escritorio oscuro (1440 px): `docs/web/screenshots/home-en-1440-dark.png`
  - Portada móvil (390 px, sin scroll horizontal): `docs/web/screenshots/home-es-390-mobile.png`
  - Centro de Control — Mapa multicapa (1440 px): `docs/web/screenshots/platform-es-1440-map.png`
  - Centro de Control — Grafo de correlación (1440 px): `docs/web/screenshots/platform-es-1440-graph.png`
  - Producto — Narrativa en 5 escenas (1440 px): `docs/web/screenshots/product-es-1440.png`
  - Evidencia — Registro filtrable y gráficos (1440 px): `docs/web/screenshots/evidence-es-1440.png`

---

## 4. Pendiente / Decisiones del fundador

1. **Push remoto / PR en GitHub y despliegue en Vercel:** el entorno local no tiene credenciales activas hacia `origin`. Todos los commits están limpios en la rama local `feat/web-redesign-20261119` listos para `git push -u origin feat/web-redesign-20261119`.
2. **Actualización de seguridad de Next.js (`16.4.2`):** Next.js mostró durante el build una recomendación de actualización de seguridad; no se aplicó automáticamente porque `tests/dossier-truth-gate.test.mjs` fija `next@16.4.2` en `docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md`. Queda a decisión del fundador.
