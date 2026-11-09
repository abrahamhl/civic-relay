# Backlog exacto de correcciones SENDA — PR30 (`62d2b743`)

> Hallazgos base de auditoría 2026-11-09; no presupongas que siguen abiertos sin revalidar el SHA.

| Ticket | Fallo | Módulo | Agente | PASS verificable |
|---|---|---|---|---|
| P0-01 | COTS drones devuelve escenario ficticio desde getActiveTracks | `apps/senda-live/server/domain/cots-drone-recon.mjs` | `senda-robotics-uav` | Sin dispositivo: lista vacía y NO_LIVE_DETECTIONS; simulador separado y rotulado |
| P0-02 | Trilateración devuelve error/GDOP cero con geometría insuficiente | `investor-next/lib/command-surface.ts` | `senda-statistics` | UNDERDETERMINED, incertidumbre nula/no disponible, test 0/1/2/3 anclas y colinealidad |
| P0-03 | Score confianza heurístico aparenta probabilidad calibrada | `apps/senda-live/server/domain/spatial-reconciliation-engine.mjs` | `senda-statistics` | Renombrar score y calibrar con holdout; Brier/ECE fiabilidad |
| P0-04 | Independencia de fuente conocida limitada a string exacto | `apps/senda-live/server/domain/spatial-reconciliation-engine.mjs` | `senda-osint-provenance` | GDACS/USGS si comparten upstream no se cuentan como dos |
| P0-05 | Recibo SHA publicitado como árbol Merkle sin proofs | `apps/senda-live/server/domain/spatial-reconciliation-engine.mjs` | `senda-cyber-crypto` | Pruebas de inclusión/consistencia y firma o cambiar etiqueta a checksum |
| P0-06 | Globo indica datos verificados tras Promise.allSettled incluso con fallos | `apps/senda-live/web/src/components/Globe4DStudio.tsx` | `senda-gis-4d` | Panel por fuente; prueba 9 fallos => no dice VERIFIED |
| P0-07 | Satélites orbitan mediante seno y velocidades arbitrarias | `apps/senda-live/web/src/components/Globe4DStudio.tsx` | `senda-satellite-gnss` | SGP4/TLE fechado o etiqueta órbita ilustrativa; pruebas de posición |
| P0-08 | Aproximación de lluvia usada como conformidad ITU P.838 | `packages/senda/src/telecom-mathematical-physics.mjs` | `senda-rf-spectrum` | Coeficientes oficiales interpolados, vec validación y error vs referencia |
| P0-09 | Docs prometen DTN 100%, 14min ventaja, pericial y zero hardware | `docs/funding/SENDA_INVESTOR_READINESS.md` | `senda-rights-funding` | Matriz claim→evidencia, retirar sin fuente y ensayo |
| P0-10 | Publicaciones PRIVATE/FOLLOWERS en eventos e historias pueden filtrarse | `apps/senda-live/server/services/events.mjs; social.mjs` | `senda-cyber-crypto` | Prueba dos cuentas, rutas y feed, no filtración |
| P0-11 | Sesión token devuelto en JSON de auth, cookie sin Secure | `apps/senda-live/server/api.mjs` | `senda-cyber-crypto` | Cookie segura producción y sin token JSON; CSRF test |
| P0-12 | No hay paridad entre GitHub PR30 y Vercel público | `PR #30; issue #19; Vercel` | `senda-release-devsecops` | Provenance verificada, preview y smoke tests; no deploy producción sin permiso |
| P1-13 | Modelos RF y de incendio sin campaña independiente de campo | `packages/senda/src/**` | `senda-scientific-redteam` | HOLDOUT real independiente, intervalos, error y datasets con licencia |
| P1-14 | Interoperabilidad Waze/Maps/DGT/NDW sin contrato formal | `docs/integrations/**` | `senda-api-interoperability` | Partner/permiso por fuente, no scrapear, prueba API de consentimiento |
| P1-15 | Offline hardware sin cadena de recepción física validada | `apps/senda-android/**; hardware/**` | `senda-edge-cots` | Dos nodos reales y gateway, logs transmitidos recibidos, SNR y energía |
| P1-16 | Vídeos M95 y visualizador no íntegros en producción | `investor-next/public/media/m95/**` | `senda-release-devsecops` | URL HTTP 200/206 para cada MP4, checksum y manifest; pruebas visuales |
