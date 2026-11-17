# Revisión Adversarial Independiente (Agentes A–E) — Auditoría A0 (2026-11-17)

Todas las observaciones siguientes proceden de lectura directa de ficheros fuente y ejecución real en consola; ningún fallo se oculta ni maquilla.

## Agente A — Matemáticas y Estadística

1. **[ALTA · Verificado] Pseudorreplicación y censura por derecha tratada como negativo en H2**
   - **Evidencia:** `experimental/senda-arr/experiments/run-forecast-experiment.mjs:25-38`, `experimental/senda-arr/src/arr-forecast.mjs:57-95`.
   - **Detalle:** Se extraen `34` unidades `(fire, k0)` de **solo 3 incendios** (`camp`, `carr`, `woolsey`), tratándolas en `bootstrapCi` (`arr-sim.mjs:369`) como muestras independientes. Además, `outcome` usa `per[kEnd]` siendo `kEnd` el último perímetro publicado en `(t0, t0+24h]`: si el último mapeo ocurre en `t0+3h`, los puntos quemados entre `t0+3h` y `t0+24h` se etiquetan como `0` (negativo) en vez de **censurados**. Brier: persistencia `0.0539` < asimilado `0.0943` < prior `0.1214`.
   - **Corrección:** En `H-FIRE-B`, separar estrictamente `camp/carr/woolsey` como `DEVELOPMENT_DIAGNOSTIC_ONLY`, exigir evidencia hasta `t0+24h` para negativos reales, etiquetar `CENSORED` cuando falte cobertura hasta el horizonte y usar bootstrap jerárquico por incendio externo.
2. **[MEDIA · Verificado] Optimismo de selección y comparación de costes en ARR H-ARR-1**
   - **Evidencia:** `experimental/senda-arr/src/arr-core.mjs:314-348`, `experimental/senda-arr/src/arr-sim.mjs:269-363`.
   - **Detalle:** `samplingLowerBound` usa desviación de Hoeffding asumiendo miembros IID del conjunto de escenarios. La selección voraz `greedy` evalúa ganancia marginal usando el mismo conjunto que puntúa `predicted.ensembleProbability`, y `simulateRouting` en `arr-sim.mjs` compara planes estáticos por `maxReplicas` sin un presupuesto unificado explícito de `airtimeMs` ni inclusión de `PRoPHET` (RFC 6693) o `Spray-and-Focus`.
   - **Corrección:** En `H-ARR-R`, imponer presupuesto explícito compartido (`airtimeMaxMs`, `energyMaxMj`, `maxCopies`) para todos los comparadores en 3 familias topológicas independientes.
3. **[MEDIA · Verificado] Supuesto IID en intervalos anytime H14**
   - **Evidencia:** `packages/senda/src/anytime-scenario-confidence.mjs:9, 30-62`.
   - **Detalle:** Correcto matemáticamente bajo episodios IID causalmente independientes, pero las secuencias reales presentan estacionalidad/deriva meteorológica; si hay deriva de distribución, la cota no es válida (el propio módulo declara `calibratedUnderDistributionShift: false`).

## Agente B — Telecomunicaciones

1. **[ALTA · Verificado] Ausencia de presupuesto de airtime regulatorio SRD y parámetros RF hipotéticos sin medida física**
   - **Evidencia:** `packages/senda/src/channels.mjs:10-54`, `packages/senda/src/delivery-assurance.mjs:113-120`, `experimental/senda-arr/src/arr-sim.mjs:64-66`.
   - **Detalle:** Los perfiles (`LORA`, `BLE`, `WIFI_DIRECT`, `RADIO_PROFILES`) contienen cifras orientativas de catálogo (`p: 0.95`, `energyMj: 260`), **no medidas RF de campo**, y `arr-sim.mjs` no penaliza consumo de ciclo de trabajo por subbanda ni retransmisiones MAC reales.
   - **Corrección:** Etiquetar explícitamente los parámetros de catálogo como `HYPOTHETICAL_CATALOG_DEFAULT`, forzar presupuesto de `airtimeMs` por enlace/nodo en `H-ARR-R` y separar medidas reales de instrumento (`MEASURED_INSTRUMENT`) en el capturador físico `H-PHY-1`.
2. **[MEDIA-ALTA · Verificado] Baliza BLE de pruebas y telemetría de diario Android incompleta**
   - **Evidencia:** `apps/senda-android/app/src/main/java/eu/senda/field/BleBeacon.java:56-75`, `SendaFormats.java:20`, `experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabTrialJournal.java:20-28`.
   - **Detalle:** `SendaFormats.COMPANY_ID = 0xFFFF` es identificador reservado para pruebas Bluetooth SIG; `BleBeacon` emite trama no conectable sin desafío/ACK cifrado; y `LabTrialJournal` solo exporta 3 columnas (`trial_id,application_outcome,sender_monotonic_elapsed_ms`), omitiendo `nonce`, `boot_id`, `boot_counter`, `custody_state`, `destination_ack_verified`, `airtime_ms`, `energy_mj`, `energy_source`, `srlg_fault_id`, `revocation_state`, `clock_status` y `loss_reason`.

## Agente C — Sistemas Distribuidos

1. **[CRÍTICA · Verificado] Confusión potencial entre custodia y entrega final + identidad efímera por arranque en Nearby Lab**
   - **Evidencia:** `experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/LabPersistentQueue.java:21, 85-95`, `MainActivity.java:77, 140-150`, `LabDeadlinePolicy.java:10-24`.
   - **Detalle:**
     - `LabPersistentQueue.Status` solo contiene `{QUEUED, ACK_VERIFIED, EXPIRED, REVOKED}`; no distingue **`CUSTODY_ACK`** (el siguiente nodo aceptó custodiar el sobre) de **`DESTINATION_ACK`** (el destinatario final verificó entrega).
     - `MainActivity.java:77` regenera `new LabReceiptSigner()` en cada arranque de proceso, impidiendo reconocer el anclaje criptográfico tras un reinicio si el destinatario reinicia.
     - No existen `bootId`/`bootCounter` persistidos ni detección de **salto incoherente de reloj de pared** entre reinicios cuando `SystemClock.elapsedRealtime()` se reinicia.
   - **Corrección:** Ampliar la máquina de estados en `LabPersistentQueue.java` (`CREATED -> QUEUED -> CUSTODY_ACK -> DESTINATION_ACK | REVOKED | EXPIRED | FAILED_EXHAUSTED`), añadir persistencia de contador de arranque + chequeo de coherencia temporal (`CLOCK_INCOHERENT_QUARANTINE`), y conectar con validador Node compartido (`transport-telemetry.mjs`).
2. **[ALTA · Verificado] ARR actual (`arr-core.mjs`) no replantea por custodio ni propaga cancelación de copias por ACK**
   - **Evidencia:** `experimental/senda-arr/src/arr-sim.mjs:300-311`.
   - **Detalle:** `executePlan` congela los saltos en `t0`. Si el enlace principal cae tras el segundo salto o un nodo receptor ya entregó el paquete por otra rama, los demás custodios siguen consumiendo energía y aire transmitiendo réplicas obsoletas.

## Agente D — Física e Inferencia

1. **[ALTA · Verificado] Motores físicos existentes (`wildfire.mjs`, `fire-field.mjs`) desconectados de H2 + ausencia de solucionador PDE Level-Set causal**
   - **Evidencia:** `packages/senda/src/wildfire.mjs:36-73`, `packages/senda/src/fire-field.mjs:58-89` frente a `experimental/senda-arr/src/arr-forecast.mjs:4-7, 53`.
   - **Detalle:** `arr-forecast.mjs` (H2) usó una expansión cinemática radial sin viento, pendiente ni combustible, ignorando `directionalRos` y `arrivalOnField` ya presentes en el núcleo; a su vez, `wildfire.mjs` y `fire-field.mjs` utilizan Dijkstra discreto de 16 vecinos sin esquema upwind PDE monótono ni control estricto de `CFL`, ni bloquean explícitamente reanálisis futuro (`t_avail > t0`) ni censura de horizonte.
   - **Corrección:** Construir `H-FIRE-B` en `experimental/senda-fire-physics/` reutilizando `windShape` y coeficientes Rothermel de `wildfire.mjs`, con solucionador upwind Level-Set (`CFL <= 0.45`), verificación analítica, filtro causal `t_avail <= t0` y auditoría de censura.
2. **[MEDIA-ALTA · Verificado] Dos grafos parciales de fuentes no integrados en fusión causal bayesiana**
   - **Evidencia:** `packages/senda/src/source-evidence.mjs:28-93`, `packages/senda/src/cross-source.mjs:19-32`, `packages/senda/src/fusion.mjs:66-103`.
   - **Detalle:** Aunque `cross-source.mjs` y `source-evidence.mjs` detectan dependencias declaradas (`GDACS_EQ -> USGS_NEIC`), `fusion.mjs` solo ordena por recuento de capas y no calcula actualización bayesiana por ancestro causal ni abstrae recortes duplicados de un mismo producto derivado ni cuantifica contradicción explícita (`ABSTAIN`).

## Agente E — Seguridad y Producto

1. **[ALTA · Verificado] Contrato explícito de abstención incompleto en salidas de modelos y riesgo de falsa continuidad offline**
   - **Evidencia:** `packages/senda/src/evidence-contract.mjs`, `investor-next/public/senda/visor.html`.
   - **Detalle:** Aunque las alertas públicas `Actual` están correctamente bloqueadas (`roles.mjs`, `hazard-reports.mjs`, `interop.mjs`), las salidas técnicas no exponen de forma uniforme el bloque estructurado de P4 (`known`, `computed`, `assumed`, `unverified`, `validUntilUtc`, `abstainReasons`) ni muestran por qué el sistema se abstiene ante contradicción entre fuentes o falta de entrada meteorológica.
2. **[MEDIA · Verificado] Riesgo de dependencia no declarada en CI al incorporar módulos cross-workspace**
   - **Evidencia:** fallo de `usgs-live` (`apps/senda-live` importando `@senda/core` antes de `pnpm install`) y fallo de `canonical-gate` (`playwright` en `investor-next`) en PR #46.
