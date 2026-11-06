# SENDA v0.20 — punto de recuperación sin pérdida de contexto
**Fecha de auditoría:** 6 noviembre 2026 (UTC) · **Resumen canónico** [issue #15](https://github.com/abrahamhl/civic-relay/issues/15).

## Hechos confirmados (GitHub / Vercel)
| Superficie | Estado |
| --- | --- |
| master | `4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3` |
| PR #12 base SENDA | draft, head `14250b1e603ebc3a22f3c7432f9985622e4bcd75`, base master |
| PR #13 SENDA v0.20 | draft, head `594bba717d9c5efc107ee25f9fb6c1677e04974a`, base PR #12 |
| PR #14 financiación / reel | draft, head `93dd83934cb24025e532f508c65c4fff75824dbd`, base master |
| Vercel investor production | READY, `dpl_EGyb9J6wqwdNnjSnA8rdy9Y72d32`, SHA `594bba7`, alias `civic-relay-investor.vercel.app` |
| CI #13 head | Actions runs `42145731505` (research) y `42145731506` (Chromium) success |
| OEP anterior | PR #3 sigue draft; los issues #4 privacidad, #5 pruebas físicas y #6 paridad permanecen abiertos |

**Trazabilidad del trabajo:** el último commit v0.20 de #13 lleva metadatos de Claude Opus. El identificador privado de una tarea Codex, sin exportar sus logs, NO prueba que ese trabajo se haya subido. Consultar el historial de esa tarea por separado.

## Qué sí y qué no acredita v0.20
- **Sí:** código fuente y tests CI de investigación, prototipos Android/ESP32 y flujos browser; presentación SENDA con fuentes documentadas y estudios de fuego/evacuación.
- **No:** pruebas de campo de comunicaciones entre coches o móviles, latencias en emergencia real, integración oficial 112/DGT, CSI trans-pared validado, derechos de explotación de todas las cámaras, resultados clínicos o certificación.
- **Precaución adicional:** en la rama #13, `investor-next/public/senda/estado.json` contiene `sha: c0b10e6`, mientras el SHA servido por Vercel es `594bba7`. Diferenciar SHA de generación de evidencia vs SHA de despliegue. Evitar afirmar paridad sin investigar.
- **Docs #14:** referencian `master` y dicen que aún no hay vehículos; no niegan el código experimental posterior de #12/#13. Actualizarlos antes de presentación y verificar convocatorias vigentes.

## Orden de trabajo recomendado (una fase por vez)
1. **Inventario de base y ramas:** capturar `git status --short`, `git rev-parse HEAD`, `git log -5 --oneline`, archivos cambiados por PR y dependencia #13 → #12. No fusionar todavía.
2. **Truth-gate:** buscar en web, docs y vídeos claims de velocidad, malla física, cámara real, satélite, alertas, CSI y 112. Para cada claim: evidencia, fuente, estado `implemented-in-code / CI-tested / simulated / licensed / field-measured / independently-reviewed`. Reparar solo afirmaciones injustificadas, preservando UX.
3. **Paridad de release:** comprobar SHA exacto en Vercel y dominio canónico; build y E2E de rutas `/`, `/es/`, `/nl/`, `/senda/`, `/senda/referencias`, `/senda/evacuacion`; revisar `estado.json`. No confiar solo en READY.
4. **Financiación:** reubicar PR #14 sobre la versión efectiva SENDA, actualizar fecha del cierre Horizon del 5-nov-2026, criterios de elegibilidad/consorcio, LOI y dossier en tres idiomas. El reel es de simulación; no usarlo como evidencia física.
5. **Validación experimental:** preparar piloto opt-in de dos Android y mínimo 30 ensayos, incluidos fallos y denominadores. Contactar autoridades para acceso a fuentes bajo convenio, sin acceder a sistemas sin autorización.
6. **Reconciliación:** después de pruebas y revisión, fusionar #12 antes de #13; incorporar #14 con resolución de conflictos y actualizar `master`. Confirmar nueva producción y luego cerrar issue #6.

## Instrucciones de coste/continuidad para agentes
- Elegir el modelo económico adecuado; reservar razonamiento alto solo para arquitectura, seguridad y análisis de fallos no triviales.
- Máximo un subagente a la vez; especificar archivos y comandos de interés. Evitar lecturas recursivas de `media/`, `entrega/`, artefactos grandes y repositorio completo.
- No regenerar películas ni repetir pruebas masivas si no cambia su código. Reutilizar informes y logs por SHA.
- Antes de alcanzar límites, guardar **hecho / pendiente / último SHA / comandos y resultados / siguiente primer paso** en este documento o en `docs/handoff/LAST_AGENT_CHECKPOINT.md`.
- Prohibido prometer trabajo en segundo plano sin programación real; no mezclar CI con certificación; no tocar `master` o producción sin verificación expresa.

## Referencias
- [PR #12](https://github.com/abrahamhl/civic-relay/pull/12)
- [PR #13](https://github.com/abrahamhl/civic-relay/pull/13)
- [PR #14](https://github.com/abrahamhl/civic-relay/pull/14)
- [Issue #15](https://github.com/abrahamhl/civic-relay/issues/15)
- [Vercel deployment](https://vercel.com/2fabraham-7129s-projects/civic-relay-investor/EGyb9J6wqwdNnjSnA8rdy9Y72d32)
