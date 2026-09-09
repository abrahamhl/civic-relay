# RELEASE TRUTH V0.1

Verificación ejecutada en HEAD `3f1c398` + endurecimiento aplicado. Resultados reales de comandos, no afirmaciones.

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm build` | PASS (schemas, transports, core, api, web) |
| `pnpm test` | PASS (21 tests, 0 fallos) |
| `pnpm lint` (== `pnpm -r type-check`) | PASS |

## Qué es verdad

- **Multipath:** un mensaje puede propagarse por varias rutas **simuladas** ACK.
- **Store-and-forward:** sin rutas disponibles queda `QUEUED`.
- **Deduplicación:** el receptor retiene un único mensaje lógico con ambas rutas.
- **Crypto:** primitivas separadas Ed25519 (firma) y X25519/XSalsa20-Poly1305 (cifrado experimental); sin conectarse al flujo de la demo.
- **Validación:** `MessageEnvelopeSchema` rechaza `OFFICIAL` no autenticado, UUIDs malformados, payloads no-JSON y fechas futuras/caducadas.

## Qué NO es verdad (y se declara)

- **No hay persistencia.** Cola/historial/dedup viven en memoria y se pierden al recargar.
- **No hay PWA funcional.** No se registra service worker; el manifiesto es mínimo.
- **No hay E2E.** No hay backend, autenticación, autorización ni integración de emergencias.
- **No hay aval institucional ni conformidad ENS.** Cualquier referencia es histórica/sintética o ha sido retirada.
- **No hay garantía de disponibilidad ni de recepción real.** Todos los transportes son simulaciones en la misma página.

## Evidencias clave

- `packages/core/src/demo.ts` — escenario dorado conectado al flujo real.
- `packages/core/src/dispatcher.ts` — `DELIVERED` solo con ACK del receptor.
- `packages/core/src/store.ts` — cola de sesión, TTL, colisiones rechazadas.
- `packages/core/tests/delivery.test.mjs` + `crypto.test.mjs` — 21 pruebas.
- `docs/AUDITORIAS_INVERSION_PUBLICA.md` — justificación y roles.
- `docs/ASTRA_RED_TEAM.md` — matriz de liberación.
