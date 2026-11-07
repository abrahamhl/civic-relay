# Evidencia DTN SENDA — 2026-11-07

**Rama:** `fix/senda-dtn-receipt-quarantine-20261107`  
**Base:** `ccr-357397d4-i6q247` en `594bba7`  
**Checkpoint previo:** `checkpoint/pre-dtn-hardening-20261107`  
**Estado de la evidencia:** `SIMULATED_VALIDATED` para el flujo DTN simulado; `PHYSICAL_TEST_PENDING` para radio, Android y campo. El benchmark de routing es `SIMULATED_BENCHMARK`, no una validación de campo.

---

## 1. Alcance

Se endureció el flujo de almacenar-transportar-reenviar de `packages/senda` y el relé `packages/senda-relay`:

- validación de forma del sobre antes de descifrar;
- cuarentena de recibos sin sobre;
- reserve/commit para no consumir copias si el transporte falla;
- límites de tamaño, TTL, prioridad, cuota, difusiones e ingesta;
- conservación de estado en reinicios;
- comparación reproducible de estrategias de enrutado oportunista.

No se modificó el servicio 112, CAP ni ninguna radio.

---

## 2. Entorno

- Windows, PowerShell 5.1.
- Node.js `v22.22.2`.
- Sin `java`, sin Android SDK (`ANDROID_HOME`/`ANDROID_SDK_ROOT` vacíos) y sin teléfonos.
- Los PDFs y `docs/scientific/` no forman parte de este cambio.

---

## 3. Pruebas automatizadas

Comandos ejecutados desde `packages/senda`:

```powershell
node --check src/bundle.mjs
node --check src/envelope.mjs
node --check src/opportunistic-routing.mjs
node --check scripts/dtn-field-sim.mjs
node --check scripts/routing-benchmark.mjs
node --test tests/*.test.mjs
```

Resultado: **248 tests, 248 pass, 0 fail** (12,1 s).

Incluye:

| Bloque | Resultado |
|---|---:|
| Suite previa | 232/232 |
| `tests/dtn-hardening.test.mjs` (10 pruebas adversariales) | 10/10 |
| `tests/opportunistic-routing.test.mjs` (6 pruebas) | 6/6 |
| `tests/web-parity.test.mjs` (copia exacta del núcleo) | pass |

Relé, desde `packages/senda-relay`:

```powershell
node --test tests/relay.test.mjs
```

Resultado: **3 tests, 3 pass, 0 fail**.

Sincronización web, desde `packages/senda`:

```powershell
node scripts/sync-web.mjs
```

Resultado: **61 módulos** copiados a `investor-next/public/senda/core`.

---

## 4. Simulación DTN A → mula → C

Comando:

```powershell
node scripts/dtn-field-sim.mjs --trials=30 --seed=357397
```

Salida: `evidence/senda/dtn-field-sim-2026-11-07.json`.

| Métrica | Resultado |
|---|---:|
| Ensayos | 30 |
| Entregas | 30/30 |
| Recibo falsificado bloqueado | 30/30 |
| Reconstrucción 3-de-5 con 2 pérdidas | 30/30 |
| Reinicio conserva el sobre | 30/30 |
| Duplicado suprimido | 30/30 |
| Purga de la mula tras recibo auténtico | 30/30 |
| Sobre manipulado rechazado | 30/30 |
| Sobre malformado rechazado | 30/30 |
| Latencia simulada p50 / p95 | 1259 s / 1311 s |
| Tamaño del sobre p50 / p95 | 347 B / 347 B |
| Energía | `ENERGY_NOT_MEASURED` |

La latencia es la programación sintética del ensayo (contactos a 1200–1320 s), no una medición de radio. La energía no se midió; solo se cuentan bytes.

**Estado:** `SIMULATED_VALIDATED`. **Campo:** `PHYSICAL_TEST_PENDING`.

---

## 5. Benchmark de enrutado oportunista

Comando:

```powershell
node scripts/routing-benchmark.mjs --seeds=20 --seed=20261107
```

Salida: `evidence/senda/routing-benchmark-2026-11-07.json`.  
20 semillas × 5 escenarios × 6 estrategias; determinismo comprobado en todas las filas.

| Escenario | Estrategia | Entrega | p50 latencia (s) | Overhead | Energía proxy | Saltos |
|---|---|---:|---:|---:|---:|---:|
| scheduled-line | direct | 0 % | — | — | 0 | — |
| scheduled-line | flooding | 100 % | 600,4 | 1,000 | 4,00 | 4 |
| scheduled-line | epidemic | 100 % | 600,4 | 1,000 | 4,00 | 4 |
| scheduled-line | spray | 100 % | 600,4 | 1,000 | 4,00 | 4 |
| scheduled-line | earliest | 100 % | 600,4 | 1,000 | 4,00 | 4 |
| scheduled-line | adaptive | 100 % | 600,4 | 1,000 | 4,00 | 4 |
| scheduled-partition | direct | 0 % | — | — | 0 | — |
| scheduled-partition | flooding | 100 % | 700,4 | 1,000 | 5,00 | 5 |
| scheduled-partition | epidemic | 100 % | 700,4 | 1,000 | 5,00 | 5 |
| scheduled-partition | spray | 100 % | 700,4 | 1,000 | 5,00 | 5 |
| scheduled-partition | earliest | 100 % | 700,4 | 1,000 | 5,00 | 5 |
| scheduled-partition | adaptive | 100 % | 700,4 | 1,000 | 5,00 | 5 |
| crowd | direct | 0 % | — | — | 0 | — |
| crowd | flooding | 100 % | 220,4 | 1,341 | 13,15 | 3,85 |
| crowd | epidemic | 100 % | 220,4 | 1,000 | 9,80 | 3,85 |
| crowd | spray | 20 % | 300,4 | 1,000 | 5,05 | 3,25 |
| crowd | earliest | 100 % | 220,4 | 1,000 | 3,85 | 3,85 |
| crowd | adaptive | 100 % | 220,4 | 1,000 | 9,80 | 3,85 |
| energy-scarce | direct | 0 % | — | — | 0 | — |
| energy-scarce | flooding | 100 % | 101,5 | 1,000 | 7,00 | 2 |
| energy-scarce | epidemic | 100 % | 101,5 | 1,000 | 7,00 | 2 |
| energy-scarce | spray | 100 % | 101,5 | 1,000 | 7,00 | 2 |
| energy-scarce | earliest | 100 % | 101,5 | 1,000 | 6,00 | 2 |
| energy-scarce | adaptive | 100 % | 230,4 | 1,000 | 3,00 | 3 |
| held-out | direct | 0 % | — | — | 0 | — |
| held-out | flooding | 100 % | 660,4 | 1,363 | 26,55 | 8,70 |
| held-out | epidemic | 100 % | 660,4 | 1,017 | 19,20 | 8,70 |
| held-out | spray | 5 % | 619,4 | 1,000 | 7,60 | 3,00 |
| held-out | earliest | 95 % | 660,4 | 1,000 | 13,05 | 8,53 |
| held-out | adaptive | 100 % | 660,4 | 1,017 | 19,20 | 8,70 |

**Lecturas honestas:**

- `direct` falla siempre que no existe un contacto fuente→destino.
- En cadenas dispersas, flooding/epidemic/spray/earliest/adaptive entregan con el mismo coste porque no hay contactos duplicados que desperdiciar.
- En multitud, `flooding` gasta un 34 % más de transferencias que `epidemic` por duplicados; `earliest` es el más barato en energía (3,85) porque usa una sola ruta planificada.
- En `energy-scarce`, `earliest` entrega en 101,5 s con energía 6; `adaptive` prefiere la cadena BLE y entrega en 230,4 s con energía 3. Es un intercambio explícito, no una mejora gratuita.
- En `held-out`, `spray` con 16 copias solo entrega el 5 %; `earliest` entrega el 95 %; flooding/epidemic/adaptive entregan el 100 % con más energía. Es una limitación real, no se oculta.
- La energía es un proxy del catálogo de canales (`BLE=1`, `WIFI_DIRECT=3`, etc.), **no julios**. No se midió batería.

**Estado:** `SIMULATED_BENCHMARK`; `physicalValidation: PHYSICAL_TEST_PENDING`; `notFieldValidation: true`.

---

## 6. Qué se corrigió

1. Un recibo sin sobre ya no suprime la entrega: va a cuarentena.
2. Un recibo falso se descarta cuando llega el sobre; el mensaje se almacena.
3. La cuarentena está acotada por número de ids y secretos.
4. `reserveFor()`/`commit()` evitan consumir copias si el transporte falla; `syncPair()` hace rollback si la ingesta lanza.
5. Los sobres malformados, gigantes, caducados o con TTL absurdo se rechazan sin consumir cuota.
6. El reinicio conserva sobres, recibos verificados y pendientes; no resucita mensajes purgados.
7. El relé valida forma antes de almacenar y propaga `pendingReceipts` con límites.
8. Se añadió el benchmark de routing con estrategias y escenarios sembrados.
9. La web usa la copia exacta del núcleo probado (61 módulos).

---

## 7. Limitaciones y no-claims

- No hay validación física: sin Android SDK, sin APK y sin teléfonos.
- No hay radio BLE, Wi-Fi Direct, Nearby, LoRa ni satélite reales; los fragmentos se pasan en memoria.
- No se midió energía, batería, alcance, caudal ni latencia de radio.
- El relé no puede verificar la firma del emisor; el destinatario sí detecta manipulación.
- `earliest` depende de un plan calculado una vez; en `held-out` falla el 5 % por cambios de contactos.
- `spray` con 16 copias no cubre cadenas largas; el resultado del 5 % es una limitación del algoritmo en ese escenario.
- El benchmark usa contactos sintéticos; no es una predicción de campo.
- No se ha probado con 112, CAP, servicios de emergencia ni infraestructura institucional.
- Nada de esto certifica el sistema ni demuestra validez en una emergencia real.

---

## 8. Reproducción

```powershell
cd packages/senda
node --test tests/*.test.mjs
node scripts/sync-web.mjs
node scripts/dtn-field-sim.mjs --trials=30 --seed=357397
node scripts/routing-benchmark.mjs --seeds=20 --seed=20261107

cd ../senda-relay
node --test tests/relay.test.mjs
```

Los JSON incluyen `source.commitAtGeneration` y `source.worktreeDirty`. La evidencia se genera antes de su propio commit; el SHA del commit de evidencia figura en el PR.

---

## 9. Archivos principales

- `packages/senda/src/envelope.mjs`
- `packages/senda/src/bundle.mjs`
- `packages/senda/src/opportunistic-routing.mjs`
- `packages/senda/src/index.mjs`
- `packages/senda/scripts/dtn-field-sim.mjs`
- `packages/senda/scripts/routing-benchmark.mjs`
- `packages/senda/tests/dtn-hardening.test.mjs`
- `packages/senda/tests/opportunistic-routing.test.mjs`
- `packages/senda-relay/server.mjs`
- `investor-next/public/senda/core/*.mjs` (espejo sincronizado)
- `evidence/senda/dtn-field-sim-2026-11-07.json`
- `evidence/senda/routing-benchmark-2026-11-07.json`
