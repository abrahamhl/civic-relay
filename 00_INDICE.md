# SENDA · Índice de la entrega

Actualizado: 07-11-2026 · Sesión: biblioteca de investigación trilingüe.

## Abrir primero

| Qué | Ruta de Windows |
|---|---|
| Biblioteca de investigación en producción | https://civic-relay-investor.vercel.app/research/ |
| Registro de cambios (lo último arriba) | `C:\dev\02_PROJECTS\civic-relay\00_CHANGELOG.md` |
| Proyecto web | `C:\dev\02_PROJECTS\civic-relay\investor-next` |
| Build estático listo para servir | `C:\dev\02_PROJECTS\civic-relay\investor-next\out` |

## Biblioteca de investigación

| Pieza | Ruta de Windows |
|---|---|
| Página compartida EN/ES/NL | `C:\dev\02_PROJECTS\civic-relay\investor-next\app\research-page.tsx` |
| Estilos de la biblioteca | `C:\dev\02_PROJECTS\civic-relay\investor-next\app\research-page.css` |
| Ruta inglesa `/research/` | `C:\dev\02_PROJECTS\civic-relay\investor-next\app\(en)\research\page.tsx` |
| Rutas ES/NL | `C:\dev\02_PROJECTS\civic-relay\investor-next\app\(localized)\[locale]\research\page.tsx` |
| Fuente de los informes | `C:\dev\02_PROJECTS\civic-relay\investor-next\content\research\papers.json` |
| Manifiesto generado | `C:\dev\02_PROJECTS\civic-relay\investor-next\content\research\manifest.json` |
| Manifiesto público con hashes | `C:\dev\02_PROJECTS\civic-relay\investor-next\public\research\manifest.json` |
| Constructor HTML/fuentes/BibTeX/datos | `C:\dev\02_PROJECTS\civic-relay\investor-next\scripts\research\build-research.mjs` |
| Constructor de PDFs | `C:\dev\02_PROJECTS\civic-relay\investor-next\scripts\research\build-pdfs.mjs` |
| Verificador del export | `C:\dev\02_PROJECTS\civic-relay\investor-next\scripts\research\verify-export.mjs` |
| Informes HTML públicos | `C:\dev\02_PROJECTS\civic-relay\investor-next\public\research` |
| PDFs públicos | `C:\dev\02_PROJECTS\civic-relay\investor-next\public\research\*.pdf` |
| Fuentes Markdown públicas | `C:\dev\02_PROJECTS\civic-relay\investor-next\public\research\source` |
| Datos públicos | `C:\dev\02_PROJECTS\civic-relay\investor-next\public\research\data` |

Digest del bundle: `4c0f0e3498feac618c2fa2502a59a8545adbc98f75e0bf5f1f1916aa8f839f66`.

Informes publicados:

| Informe | HTML |
|---|---|
| SENDA-TR-2026-01 · Proof-Carrying Inference for Offline Emergency Software | `/research/tr-2026-01-proof-carrying-inference.html` |
| SENDA-TR-2026-02 · Exact Erasure Tails and Delay Bounds for Store-Carry-Forward Emergency Messaging | `/research/tr-2026-02-erasure-tails-dtn-bounds.html` |
| SENDA-TR-2026-03 · Display Determinism Across JavaScript Runtimes for Adaptive ODE Solvers | `/research/tr-2026-03-display-determinism-ode.html` |

Los informes son técnicos, no están revisados por pares y no acreditan mediciones físicas.

## Cómo comprobarlo

```powershell
cd C:\dev\02_PROJECTS\civic-relay\investor-next
npm run type-check
npm run check:locales
npm run check:research
npm run check:domain
npm run build
$env:EXPECTED_SOURCE_SHA='a622404c535affac27cf781e832fda6653427168'; npm run smoke:deploy
```

Resultado de esta sesión: 15 páginas estáticas, 123/123 pruebas, tres locales
(`en`, `es`, `nl`), 3 informes, 2 conjuntos de datos y 3 PDFs con digest
verificado. Navegador local
y producción a 390 px y 1440 px: 3 tarjetas, 3 PDFs, las 3 páginas HTML de
informe, cabecera fija visible, 0 desbordamiento horizontal, 0 errores de
consola, 0 errores de página y 0 respuestas 4xx/5xx. El smoke de producción
verifica además los 14 archivos del manifiesto (3 HTML, 3 PDFs, 3 fuentes
Markdown, 3 BibTeX, 2 datos) y el BibTeX agregado, con tamaño y SHA-256.

## Otros documentos y carpetas

| Qué | Ruta de Windows |
|---|---|
| Arquitectura | `C:\dev\02_PROJECTS\civic-relay\docs\ARCHITECTURE.md` |
| Estado de inversores | `C:\dev\02_PROJECTS\civic-relay\docs\audits\INVESTOR_READINESS_STATUS.md` |
| Documentación de investigación | `C:\dev\02_PROJECTS\civic-relay\docs\research` |
| Modelo de precisión (sesión anterior) | `C:\dev\02_PROJECTS\civic-relay\docs\research\PRECISION_INFERENCE_MODEL_2026-11-07.md` |
| Paquete de entrega anterior (06-11-2026) | `C:\dev\02_PROJECTS\civic-relay\entrega` |
| Configuración Vercel del sitio | `C:\dev\02_PROJECTS\civic-relay\investor-next\vercel.json` |
| Reglas de exclusión de despliegue | `C:\dev\02_PROJECTS\civic-relay\.vercelignore` |

## Despliegue

Proyecto Vercel: `civic-relay-investor` (equipo `2fabraham-7129s-projects`, id
`prj_WAFcG0kyKgq11V5vkoTwLatk3GNt`).
URL de producción: https://civic-relay-investor.vercel.app

El proyecto tiene `Root Directory = investor-next`; por eso se despliega desde
la raíz del repositorio:

```powershell
cd C:\dev\02_PROJECTS\civic-relay
npx vercel deploy --prod --yes --project civic-relay-investor --local-config investor-next/vercel.json
```

El despliegue de esta sesión quedó `READY` y aliaseado a producción el
07-11-2026 (`dpl_EEj1nqZRJgydYY4cNApgnV359JnA`). Incluye un rewrite en
`investor-next/vercel.json` para servir `/research/:slug.html` mediante la ruta
limpia de Vercel; sin él, los HTML daban 404 en producción. No se ha hecho
commit: los cambios están en el árbol de trabajo.
