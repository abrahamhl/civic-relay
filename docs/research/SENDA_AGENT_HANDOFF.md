# SENDA — Traspaso operativo inequívoco para OpenCode y Antigravity

**Orden científica:** 17-11-2026. Documentos normativos para esta iteración: SENDA_SCIENTIFIC_DECISIONS_20261117.md, SENDA_NEXT_HYPOTHESES_PREREGISTER.md, SENDA_SOURCE_EVIDENCE_MATRIX.md. Este handoff NO da permiso para actuar en emergencias ni transmitir por infraestructuras de terceros. No modificar master, producción, despliegue, alertas 112, certificados ni PR existentes.

## 0. Regla de ejecución

Antes de escribir código: leer los cuatro documentos, abrir los cinco PR en sus HEAD concretos, ejecutar auditoría básica, escribir un registro de decisiones y bloquear cambios si los supuestos no se cumplen. No reinventar ARR, H11–H16, journaling Android, CGR, CAP ni cifrado. Cambios solo en nuevas ramas research/* basadas en los HEAD correctos, y siempre en módulos aislados. No fusionar PR, no cambiar sus bases ni activar auto-merge. Si se encuentra un gate P0 explotable, reportarlo de forma reproducible y dejar el parche en rama separada para revisión humana.

### Refs exactos contrastados

- master b8360c9bdc30c0264bc4277d35f2c2ab5bce4e40
- #44 ce9ab69fbae2773f3256659197c9d83937fca9b8, rama ccr-ea048c78-86gcio, base de PR #38
- #38 74631c052605ecca3f8517c6e6327363bf11e126, audit/senda-agent1-durable-lab-20261117
- #32 cdabff3ee28422080ac05ec0be252fe385006bd3, claude/promotional-video-prompts-p5vzh8
- #39 d7ed6bd80a0500f12b71f54c805bee5733291700, audit/senda-pr32-safety-gates-20261117
- #42 d8feb5e523f51e809c3ea4c01d25da5ade9c74eb, su base es #39

Repetir consultas en el instante de ejecutar: HEAD pueden cambiar. Diferencia comparada #44...#42: diverged con merge-base 4c310f7895f565b3dfe410fc616d0f1ce4b1b9b3; por tanto NO intentar merge directo ni dar por probado un adaptador. El dossier #44 que dice «no merge-base» es obsoleto en la foto contrastada. No sobreescribir la rama ccr de Claude ni la investigación #42.

### Comandos de arranque sugeridos (lectura, no mutación)

    git fetch --all --prune
    git rev-parse master
    git show --no-patch --format=fuller ce9ab69fbae2773f3256659197c9d83937fca9b8
    git merge-base ce9ab69fbae2773f3256659197c9d83937fca9b8 d8feb5e523f51e809c3ea4c01d25da5ade9c74eb
    git diff --name-status master...ce9ab69fbae2773f3256659197c9d83937fca9b8
    git diff --name-status master...d8feb5e523f51e809c3ea4c01d25da5ade9c74eb
    git worktree add --detach ../senda-arr-inspect ce9ab69fbae2773f3256659197c9d83937fca9b8
    git worktree add --detach ../senda-robust-inspect d8feb5e523f51e809c3ea4c01d25da5ade9c74eb

Crear cualquier nueva rama de investigación después de inspeccionar worktrees separados; nunca sobre un HEAD flotante sin SHA.

## 1. Responsabilidades secuenciadas

### A0 — OpenCode: auditoría reproducible y congelación de protocolo (PRIORIDAD ABSOLUTA)

1. Confirmar digest de cada módulo, origen, tests y dependencias; generar inventory.json y refs.json con PR/base/head/merge-base.
2. Leer los módulos existentes:
   - #44 experimental/senda-arr/src/arr-core.mjs, arr-sim.mjs, arr-forecast.mjs; experiments/run-forecast-experiment.mjs; results/RESULTS.md, FORECAST_RESULTS.md.
   - #38 experimental/senda-route-truth/durable-lab-queue.mjs, research-contact-planner.mjs; Android LabPersistentQueue.java + MainActivity.java (no reemplazar journal Android).
   - #42 packages/senda/src/delivery-assurance.mjs, robust-assurance-audit.mjs, robust-scenario-risk.mjs, dependency-agnostic-shards.mjs, scenario-frequency-evidence.mjs, anytime-scenario-confidence.mjs, shared-risk-topology.mjs, failure-domain-cuts.mjs, cross-layer-survivability.mjs.
   - #39 packages/senda/src/hazard-reports.mjs, interop.mjs, incident-ops.mjs y copias web si están presentes en ese SHA.
3. Reproducir tests de cada HEAD bajo Node 22; registrar exit code, comandos, SHA, OS, paquetes, duración y resultados. NO decir tests pasan si solo se leen comentarios de GitHub; adjuntar log nuevo.
4. Auditoría estadística H2: revisar horizontes t0+24h, uso de kEnd, timestamps, censura, tres incendios/34 tiempos, leakage, bootstrap, área de evaluación, puntos ya quemados, geometría con islas; emitir un FAIL/FIXABLE/UNRESOLVED por defecto con pruebas minimales. **NO reescribir H2 para que parezca ganador.**
5. Congelar datos y splits del siguiente experimento, registrarlos en archivo inmutable con checksum. Cerrar gate A0 con test de no-leakage que falle deliberadamente al inyectar observación futura.

**Salida:** docs/research/executions/<fecha>/GIT_COMPATIBILITY_AUDIT.md, H2_LABEL_AUDIT.md, REPRODUCIBILITY_MANIFEST.json, SUMMARY.json. La carpeta executions se crea solo en rama experimental nueva. Si no hay acceso a datasets, anotar NOT_TESTED.

### A1 — OpenCode: banco de pruebas físico, no transmisiones autónomas

1. Diseñar interfaz aislada de observación de transporte, NO duplicar implementación Android: transporte autorizado, t_obs/t_avail, bytes/paquete, ACK firmados con nonce, boot ID, contador, energía medida o estimada rotulada, tiempo de radio, estado de revocación, ID de fallo común (power/gateway/site), reloj y causa de pérdida.
2. Añadir al laboratorio (rama de #38, no master) SOLO capturador y validador de logs CSV/NDJSON con esquema versionado, tests con fixtures falsos declarados SYNTHETIC. No emitir BLE/LoRa sin operadores y hardware autorizados: entregar lista de acciones manuales para sesión en laboratorio.
3. Producir QA manifest con firmware, handset/Android version, permiso/grant, duty cycle regional, configuración de enlace, instrumento y protocolo de consentimiento. Ensayar a nivel JVM/Node manipulaciones: ACK inválido, destino incorrecto, reboot, duplicación, revocación, expiración, journal corrupto, escritura interrumpida, rollback, caída gateway.
4. A futuro, con hardware físico: 2 Android + LoRa propios y sesiones. Un test de JVM con recibo firmado nunca se etiqueta «entregado por RF». Conectar auditor independiente para firmar manifiesto de campo.

**Salida:** test vectors, CSV schema, plan de campaña física, scripts de ingestión offline + informe con estado NOT_TESTED hasta obtener RF. Criterio: 0 excepciones de autorización y PDR medido con receptor independiente. Si no hay equipo, NO fabricar números.

### A2 — OpenCode: H-ARR-R en laboratorio de política, después de A0

1. Crear un ADAPTADOR de datos en experimental/ que cargue salidas de ARR y H11–H16 en worktrees distintos mediante JSON fixtures/versionado. NO importar directamente entre historias divergentes, ni copiar módulos completos. Escribir CONVERGENCE_CONTRACT.md con semánticas de ACK, hazard, SRLG y shard comunes, campos UNKNOWN y autoridad.
2. En simulador de eventos, ejecutar política por custodio solo cuando se produce un contacto observado; conservar K, TTL, presupuesto airtime/energía y fragmentos. Cada custodia reevalúa con los datos que posee localmente, no oracle global. Preservar causalidad de cada mensaje, consentimiento, revocación y deduplicación.
3. Baselines fuertes + ablaciones preregistradas, incluir instancias sin rutas. Evaluar coste CPU p95 en Android real antes de claims offline. Incluir adversario con apagón simultáneo de antena+energía y fragmentos k-de-n que no pueden reconstruirse a pesar de sobrevivir un enlace.
4. Reproducir pruebas invariantes #44 y oráculos H11–H16 #42 en sus ramas sin cambiarlos; construir tests de contrato sobre ficheros estáticos entre ramas. Mantener inalterados los resultados negativos CVaR/candidatas por escenario.
5. Exportar por episodio diff pareado de entrega/aire/energía y gate PASS/FAIL/INCONCLUSIVE. Si mejora menos de 2pp o supera presupuesto, archivar como negativo.

**Salida:** experimental/senda-arr-replan/ con README, schema, simulador, tests, scripts/run-confirmatory, results/README.md (no cifras hasta ejecutar), hash de dataset y gráficos declarados SIMULADO; nueva PR draft aislada.

### A3 — Antigravity: H-FIRE-B, física y evidencia, NO marketing primero

1. Construir registro de fuentes con DOI, URL, licencia, variable, CRS, resolución, unidad, hora observada, hora publicada, fecha de ingestión y SHA-256. Verificar HRRR issue-time en archivo (no ERA5 futuro), NIFC perimetraje y fuentes combustibles. Si hay insuficiencia, emitir DATASET_BLOCKED y seguir solo con benchmarks sintéticos analíticos.
2. Revisar si paquetes/senda ya contiene motor de incendio físico / FARSITE / WRF / level-set y reutilizar. No abrir un segundo motor por comodidad. Si la rama difiere, implementar adaptador de evaluación en experimental y documentar qué no puede reutilizarse.
3. Desarrollar tests de ecuación física: velocidad 0→sin propagación, viento uniforme→asimetría con orientación correcta, pendiente 0 y combustible constante→solución simple, estabilidad CFL, monotonicidad temporal en frente creciente, geometría multi-polígono/islas, tiempos de incertidumbre. No producir «animación científica» antes del test.
4. Implementar observación censurada en t0+24h: separar UNKNOWN de no quemado, exigir evidencia hasta el horizonte; validar no leakage temporal usando metadata t_avail. Partición por incidente físico, no por 300 puntos ni por 34 timestamps de 3 incendios.
5. Ejecutar persistencia, isotrópico, elipse viento, candidato Rothermel+level-set y FARSITE de referencia si hay acceso/licencia. Congelar criterio de Brier antes del primer test; buscar incendios externos y publicar resultados negativos completos.
6. Preparar render científico offline que consuma JSON con observaciones y predicción **desde el motor**, no curvas CGI dibujadas aparte. Aviso visible «PREDICCIÓN NO VALIDADA / NO USAR PARA EVACUAR» y visualización de abstención.

**Salida:** DATA_LICENSE_REGISTER.md, CAUSAL_TIMELINE_AUDIT.md, tests, negative-results archive, model comparison por incendio, reproducible SVG/WebGL con metadata; PR draft propia sin merge.

### A4 — Antigravity + OpenCode: revisión cruzada y puertas

- Antigravity audita salidas de OpenCode: falsos ACK, zonas con permiso declarado, consumo energético real vs supuesto, dependencias de replay y trazas invisibles. OpenCode audita Antigravity: causalidad, etiqueta de 24h, versión meteo, sesgo por incendios y tests de fusión.
- Browser QA en 320/390/768/1440px, sin desbordamientos; capturas REALES del navegador si hay ejecución de navegador, distinguiéndolas de mockups.
- Todo output del visor debe portar evidenceKind: OBSERVED/PREDICTED/SIMULATED/UNKNOWN; observedAt, availableAt, modelSHA, datasetSHA, units, horizon, confidence, cannotIssuePublicAlert.
- Si no hay acceso a dispositivos/cámara/antena reales: NOT_TESTED, no narrativa de acceso.
- PRs de investigación deben permanecer DRAFT y disponer de reviewers; no activar deployment, no editar secrets, no promover CAP Actual ni asumir permiso institucional.

## 2. Contratos y gates para CI

**GIT_GATE:** revisar HEAD/base/merge-base, no overwrite, branch aislada, clean diff, nada fuera de experimental y docs/research salvo tests explícitamente autorizados.

**EVIDENCE_GATE:** cada dato con SHA, origen/URL, terms, capturedAt, availableAt, modelTime; falla si availableAt > modelTime en ejecución confirmatoria o se utiliza etiqueta de futuro como feature.

**SECURITY_GATE:** 0 mensajes institucionales Actual sin credencial y confianza verificable; 0 fake receipts aceptados; 0 transports no consentidos; 0 «operationallyAuthorized» true en investigación; 0 recopilación de PII sin base/consentimiento.

**STAT_GATE:** unidades independientes por incidente o sesión causal, IC por cluster, criterios de aceptación preregistrados, baselines de coste iguales y resultados negativos conservados. Reportar abstenciones, NA y exclusiones.

**PHYSICAL_GATE:** 2 dispositivos reales, evidencia de radio independiente, logs de receptor, reboot físico, identidad de equipo y consentimientos; hasta entonces permanece FAILED/NOT_TESTED.

**RELEASE_GATE:** revisión independiente de derecho, datos, seguridad, hardware y operadores + aprobación institucional; explícitamente FUERA DE ALCANCE de estos agentes.

## 3. Formato obligatorio de cada cierre

    {
      "task": "A0|A1|A2|A3|A4",
      "baseSHA": "sha real",
      "newCommitSHA": "sha o null",
      "codePathsChanged": [],
      "datasets": [{"source": "...", "sha256": "...", "license": "..."}],
      "metrics": [{"name":"...", "unit":"...", "value": null, "evidenceKind":"NOT_TESTED"}],
      "hypothesisDecision": "PASS|FAIL|INCONCLUSIVE|NOT_TESTED",
      "securityGate": "PASS|FAIL|BLOCKED",
      "physicalGate": "NOT_TESTED|PASS|FAIL",
      "tests": [{"command":"...", "exitCode":null, "logSHA256":null}],
      "regressions": [],
      "negativeFindings": [],
      "reviewBlockedBy": [],
      "draftPR": null
    }

No inventar nulls como ceros. Cada PR enlaza al preregistro y a informes reales. El cierre de A0 es requisito para A1/A2/A3; los módulos de investigación pueden desarrollarse aislados después, pero no liberar resultados ni implementar producción hasta resolver el control externo.
