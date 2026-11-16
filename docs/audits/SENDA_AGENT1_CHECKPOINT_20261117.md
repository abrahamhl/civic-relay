# SENDA — Checkpoint del Agente 1 · 17 noviembre 2026
**Estado: AUDITORÍA DE INGENIERÍA AMPLIADA; P0 de laboratorio Node mitigado, validación física y veracidad orbital PENDIENTES. NO activar Agente 2 hasta cierre formal.**

## Identidad / cadena de revisiones
- Repo: `abrahamhl/civic-relay`.
- Inicio auditoría PR #34 (`research/senda-authorization-truth-gate-20261116`): `b0337fbb541bd4ed98d0b78b1e65ee95d6f6a4e8`.
- PR #35 (`audit/senda-agent1-two-sandbox-20261117`), base PR #34: `fc2bebecc91c8a8607d2d0d32743a0465299c9a5` con 18/18 GitHub CI.
- PR #38 (`audit/senda-agent1-durable-lab-20261117`), base PR #35: módulo de persistencia Node separado y estudio matemático de contactos; cada PR está en DRAFT, sin merge.
- Verificación inicial de producción `civic-relay-investor.vercel.app`: Vercel READY en SHA de `master` `b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40`. No atribuirle #34, #35 ni #38 sin nueva comprobación.
- Los cambios documentales de este checkpoint no implican despliegue.

## Matriz de funciones y evidencias
| Capacidad | Fuente exacta | Prueba observada | Estado honesto | Límite y acción |
|---|---|---|---|---|
| Rutas sintéticas autorizadas | `experimental/senda-route-truth/route-truth.mjs` | 8 tests originales, 2 tests nuevos contra roles desconocidos | IMPLEMENTADA Y TESTEADA EN SOFTWARE | Model-reachable != delivered, ningún relay pasivo |
| Dos «móviles» sandbox | `two-sandbox-node.mjs`, `two-sandbox-offline.test.mjs` | Dos procesos, carpetas distintas, offline, reconnect, SIGKILL, ACK falso/ausente | SIMULACIÓN CIENTÍFICA | IPC sintético, sin Android/BLE/RF |
| Cola web in-memory | `investor-next/lib/store-forward.mjs` | Se constató pérdida después de SIGKILL en PR #35 | IMPLEMENTADA Y TESTEADA EN SOFTWARE | El engine original permanece in-memory |
| Cola Node file-backed nueva | `durable-lab-queue.mjs`, `durable-lab-queue.test.mjs` | Recupera después de SIGKILL; corrupción, TTL, revocación, reloj rollback, límite de intentos | IMPLEMENTADA Y TESTEADA EN SOFTWARE (LAB) | Solo un escritor, datos ficticios, checksum no autenticado, NO Android ni power loss |
| **Cola nativa Android YA existente** | `experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabPersistentQueue.java`, `MainActivity.java` | `LabPersistentQueueTest.java` JVM existente; restauración conectada en MainActivity | IMPLEMENTADA Y TESTEADA EN SOFTWARE (JVM) | La revisión inicial que decía «Android memory-only» era errónea; `onStop` purga; no retry automático ni dos dispositivos |
| ACK Native Nearby v3 | `LabReceiptSigner.java`, `LabDeliveryGuard.java`, `MainActivity.java` | Test unitario JVM para P-256/UUID/challenge, sujeta a compilación Android CI | PROTOTIPO EXPERIMENTAL | Clave efímera por peer consentido != identidad institucional, sin prueba física |
| Contact windows + riesgo correlacionado | `research-contact-planner.mjs`, `research-contact-planner.test.mjs` | Plazo, byte-rate, presupuesto energía, consentimiento, duty-cycle, Boole lower bound | HIPÓTESIS DE INVESTIGACIÓN / SIMULACIÓN CIENTÍFICA | Probabilidades inventadas, ninguna predicción física |
| Órbitas | `investor-next/lib/live-protocol-node.mjs` | Observado uso de subpuntos dependientes del observador y elevación truncada | SIMULACIÓN CIENTÍFICA | `#37` debe limitar «live ephemeris» hasta OMM+SGP4 y calibración; no duplicar Claude |
| Vercel app pública | `investor-next/` | Vercel READY SHA base, no QA de dos móviles físicos | DEMO WEB DESPLEGADA | Producción en SHA diferente de ramas de investigación |
| Satélite y redes oficiales | No existe prueba de acceso autorizado | N/D | BLOQUEADA POR PERMISOS O HARDWARE | No atribuir servicios 112, Direct-to-cell, C2000, SIRDEE o ASTRID |

## CI y artefactos
- PR #34 CI original: https://github.com/abrahamhl/civic-relay/actions/runs/43968851165 (8/8).
- PR #35 CI: https://github.com/abrahamhl/civic-relay/actions/runs/43976348465 (18/18).
- PR #38 con fuente de planificador: https://github.com/abrahamhl/civic-relay/actions/runs/43982125666 (31/31).
- PR #38 después de límite de enumeración: https://github.com/abrahamhl/civic-relay/actions/runs/43982594973 (success).
- Revisión posterior README Android: verificar estado exacto de `626d60baecac8521dbc48403ab24e9ff243ffa64` en https://github.com/abrahamhl/civic-relay/actions/runs/43983079416 antes de cierre. **APK solo build**, no dos teléfonos.

## Ficheros del PR #38
- `experimental/senda-route-truth/durable-lab-queue.mjs` (nuevo)
- `experimental/senda-route-truth/durable-lab-queue.test.mjs` (nuevo)
- `experimental/senda-route-truth/two-sandbox-node.mjs` (modificado)
- `experimental/senda-route-truth/two-sandbox-offline.test.mjs` (modificado)
- `experimental/senda-route-truth/research-contact-planner.mjs` (nuevo)
- `experimental/senda-route-truth/research-contact-planner.test.mjs` (nuevo)
- `experimental/android-nearby/README.md` (corregidas declaraciones históricas obsoletas)
- `docs/research/SENDA_SCIENTIFIC_GAPS_20261117.md` (nuevo)

## Problemas y backlog secuencial
- **P0 campo #36:** no vender resiliencia offline sin probar dos teléfonos, reboot/force-stop y recuperación nativa, reloj y atomicidad bajo fallo de almacenamiento. Android journal existe; no duplicarlo. Responsable: ingeniero Android/QA.
- **P0 veracidad #37:** visualizador orbital usa una geometría ilustrativa, no órbitas individuales reales. Etiquetado y calibración TLE/OMM+SGP4, con permisos y revisión de arquitectura científica de Claude. Responsable: científica telecom.
- **P0 gobernanza:** verificar CI Android del SHA exacto y revisiones de #34/#35/#38; no merge crítico automático. Responsable: QA + maintainer.
- **P1 datos:** no comenzar integración de fuentes externas hasta cierre Agente 1; catálogo de investigación ya separado en informe H1-H8. Responsable: Agente 2 futuro.
- **P1 hardware:** dos Android consentidos y dos LoRa EU868 homologados; 30+ intentos por escenario, hora UTC+monotónico, modelo de teléfono, OS, RSSI si existe, colisiones, batería, p50/p95 y fallos registrados. Responsable: ingeniero de laboratorio.
- **P1 UX/mercado:** comunicar diferencias entre simulación, código testado, radio medido, acceso satelital y certificación. Responsable: Agente 5 futuro.

## Fuentes y límites científicos
Ver `docs/research/SENDA_SCIENTIFIC_GAPS_20261117.md`, con ITU P.1812, P.618, IETF BPv7, 3GPP NTN, NASA y estudios 2025–2026. El nuevo planificador no es un descubrimiento confirmado; la desigualdad de Boole es conocida y los parámetros usados son inventados para falsación de lógica. Monte Carlo local 100.000 muestras por régimen de correlación, sin datos de RF.

**Energía/recursos:** GitHub CI logs proporcionan tiempo y resultado; no se dispone de consumo exacto de tokens/créditos. No compras, no merge, no despliegue, no acceso a redes ajenas.

**Puerta de salida: NO SUPERADA aún**. Priorizar evidencia de Android y medidas RF antes de iniciar el Agente 2; la investigación de física documentada no altera la arquitectura científica de Claude.
