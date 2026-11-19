# Auditoría de Valor Científico y Preparación para Financiación (Fase 6 · 2026-11-17)

Siguiendo la taxonomía de 5 niveles de madurez tecnológica y científica definida en la Fase 6:
1. Concepto científicamente plausible
2. Algoritmo implementado con pruebas
3. Resultado experimental reproducible
4. Funcionamiento físico independiente
5. Capacidad validada para un ámbito operativo concreto

| Activo / Módulo SENDA | Nivel alcanzado hoy | Qué falta exactamente para subir al siguiente nivel | Valor defendible ante entidad financiadora / piloto |
|---|---|---|---|
| **Núcleo criptográfico, RS `GF(256)`, MFSK-16, `SND3` Ed25519, Centro/Visor PWA offline (`@senda/core` + `investor-next`)** | **Nivel 3** *(software offline reproducible; Chromium `28/28` + `815/815` tests)* | **Nivel 4:** ensayo entre ≥2 Android reales sin Internet y ≥2 LoRa EU868 con recibo firmado en receptor independiente | Stack completo verificable offline sin nube obligatoria y sin dependencia de servidor |
| **Instrumentación Física & Custodia (`LabPersistentQueue`, `LabTrialJournal`, `transport-telemetry.mjs`)** | **Nivel 2–3** *(FSM `CUSTODY_ACK` ≠ `DESTINATION_ACK`, detector de salto de reloj, esquema 18 campos listo)* | **Nivel 4:** ejecutar campaña `docs/field/PROTOCOLO_ENSAYO_CAMPO_2ANDROID_2LORA.md` y entregar `field_trials.csv` + NDJSON SHA-256 sin filtrar caídas | Expediente auditable listo para conectar un piloto controlado sin fabricar métricas de hardware |
| **Enrutamiento Adaptativo `H-ARR-R-v2` (`replan-v2.mjs` + `H-INN-ACK`)** | **Nivel 3** *(benchmark reproducible sobre 120 bloques independientes, -38,2 % airtime y -35,2 % energía a igual 94,2 % entrega)* | **Nivel 4:** replay sobre trazas RSSI/SNR/energía reales medidas en campo + latencia p95 en CPU Android físico | Demuestra disciplina experimental (conserva fallo en gate `+2 pp` raw y exhibe mejora de eficiencia Pareto verificada) |
| **Física Causal de Incendios `H-FIRE-B` (`level-set-solver.mjs`, `censor-audit.mjs`)** | **Nivel 2–3 numérico** *(6/6 tests matemáticos/CFL/Rothermel/fuga temporal + auditoría XOR y censura en GeoMAC 2018; externo `DATASET_BLOCKED`)* | **Nivel 3–4 externo:** descarga causal archivada de ≥10 incendios independientes con HRRR (`t_avail <= t0`) + LANDFIRE/EFFIS | Corrige un fallo real de topología (`XOR` en anillos concéntricos) y previene engaños de reanálisis futuro ERA5 o censura oculta |
| **Fusión Causal DAG (`H-FUS-1`) & Abstención (`H-ABST-1`)** | **Nivel 3** *(0/1000 certezas operativas indebidas; Brier DAG < Naive Bayes en duplicados)* | **Nivel 4:** validación en ≥10 incidentes multi-fuente externos con licencias y ensayo comprensivo con ≥12 usuarios | Diferenciación real en sala: el sistema sabe decir **ABSTAIN / UNKNOWN** y muestra por qué antes de inducir falsas alarmas |
| **Integración institucional 112 / Certificaciones** | **Bloqueado (Nivel 0–1)** | Auditoría criptográfica externa, ENS / DPIA GDPR, CE/RED hardware propio, convenio con autoridad de protección civil | Transparencia absoluta: `canPublicWarn = false` y `CAP Exercise` por defecto |
