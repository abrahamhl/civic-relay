# ASTRA Red Team — Auditoría adversarial de liberación

Revisión independiente sobre HEAD `3f1c398` y la implementación endurecida. Principio: **toda afirmación se considera falsa hasta que el código o una prueba ejecutable lo demuestra**. Máximo 15 hallazgos; solo se listan los materiales (P0/P1/P2), se omiten cosméticos.

## Hallazgos

### RX-01 · P0 (resuelto) — "hecho" sin acknowledgment del receptor
- **Componente:** Dispatcher / estado de entrega.
- **Evidencia:** `send(true)` es aceptación; ahora `dispatcher.ts` solo marca `DELIVERED` si existe `acknowledgment` del receptor y valida `messageId`/`transportId`. Sin ACK → `IN_TRANSIT`, nunca `DELIVERED`.
- **Por qué importa:** evitaba la promesa de multipath y una entrega falsa.
- **Fix mínimo:** el que se aplicó (estado `ACKNOWLEDGED` + `completeDelivery` con conteo de ack).
- **Verificación:** `pnpm --filter @civic-relay/core test` → "transport accepted without receiver acknowledgment never becomes delivered".

### RX-02 · P1 (resuelto) — TTL no impedía enviar caducados
- **Evidencia:** `dispatcher.ts` y `store.ts` comprueban `isExpired` en enqueue y antes de rutar; caducados se rechazan o marcan `EXPIRED`.
- **Por qué importa:** un mensaje caducado no debe salir tras ser eliminado.
- **Verificación:** test "expired messages are rejected before routing".

### RX-03 · P1 (resuelto) — Deduplicador no conectado al flujo
- **Evidencia:** `demo.ts` (createDemoSession/runGoldenScenario) enlaza los tres transportes a un receptor `Deduplicator`; `receiver.deduplicate(...)` retiene ambas rutas y produce un único mensaje.
- **Por qué importa:** es la prueba de la característica central, no un test suelto.
- **Verificación:** test "golden scenario … one logical message" y "same message delivered twice … both paths".

### RX-04 · P1 (mitigado) — pérdida por recarga/no persistencia
- **Evidencia:** `store.ts`, `deduplication.ts` y `demo.ts` usan memoria de sesión; el README lo declara explícitamente.
- **Por qué importa:** evita vender IndexedDB como persistencia real.
- **Fix mínimo:** declarado; se rechaza "PWA/persistencia completas".

### RX-05 · P1 (resuelto en demo) — crypto: Ed25519 usado como X25519
- **Evidencia:** `crypto.ts` → `generateKeyPair()` Ed25519, `generateEncryptionKeyPair()` X25519, `encryptMessage` usa `crypto_box_seal` con clave X25519 y prueba ida/vuelta, destinatario incorrecto y ciphertext alterado.
- **Por qué importa:** curvas incompatibles rompían el cifrado.
- **Verificación:** `crypto.test.mjs` "sealed boxes round-trip", "rejects wrong recipient and signing keys", "rejects tampered and truncated ciphertext".

### RX-06 · P1 (resuelto) — deduplicación solo en tests
- **Evidencia:** el receptor es el mismo código de producción en el flujo de demo; ya no es un objeto suelto.
- **Verificación:** test "one failing transport does not block a healthy path from acknowledging" y los de dedup.

### RX-07 · P1 (resuelto) — "ENS Alto Compliant / Ready for Pilot / 93%"
- **Evidencia:** README sustituido por "demo ficticia … sin aval institucional"; `AUDITORIAS_INVERSION_PUBLICA.md` y `RELEASE_TRUTH_V0_1.md` recogen la realidad.
- **Por qué importa:** son afirmaciones sin evidencia ejecutable; riesgo reputacional y de veracidad.

### RX-08 · P1 (resuelto) — tenants con dominios institucionales reales
- **Evidencia:** `config/tenants/*.json` usan `*.civic-relay.example`, mantenedor "kinkydisorder/civic-relay (demo independiente)", sin endpoints operativos; `tenant.ts` refleja "fictional demo tenant".
- **Por qué importa:** evita inducir vinculación o endorsement gubernamental.

### RX-09 · P2 (resuelto) — identidad/GPS falsos
- **Evidencia:** `App.tsx` usa `origin: 'demo-citizen'`, `source: 'MANUAL'`, `confidence: 'LOW'`; ya no afirma adquisición de posición GPS real.

### RX-10 · P2 (resuelto) — API sin autenticación
- **Evidencia:** la demo estática no expone `packages/api`; no se despliega y no se promete.

### RX-11 · P2 (limitación) — conexiones externas del mapa
- **Evidencia:** teselas OSM e iconos unpkg son peticiones de terceros; se declara como límite, no como funcionalidad.

## Verificación de liberación

- **CLEAN INSTALL:** PASS (`pnpm install --frozen-lockfile`)
- **BUILD:** PASS (`pnpm build`)
- **TESTS:** PASS (21/21)
- **GOLDEN SCENARIO:** PASS (offline → mesh → IP → receptor único → 2 rutas)
- **MULTIPATH:** PASS (una ruta falla y la otra ACK; estado de ack por ruta)
- **DEDUP:** PASS (mismo sobre, dos rutas, un mensaje, historial de ambas)
- **PERSISTENCE:** FAIL (declarada limitación de sesión/memoria; no se afirma producción)
- **CRYPTO:** PASS (primitivas) / no E2E en el flujo (documentado)
- **SCHEMA CONTRACT:** PASS (validación `MessageEnvelopeSchema`, rechazo de `OFFICIAL` no autenticado, fechas, UUIDs)
- **CLAIM TRUTHFULNESS:** PASS para la demo estática declarada; no hay afirmaciones de producción.

## Veredicto

**PUBLIC RELEASE VERDICT:** GO **para demo estática ficticia** (con límites declarados, sin API ni emergencias). **NO-GO** para operación, adquisición o uso en situación real con el estado actual.
