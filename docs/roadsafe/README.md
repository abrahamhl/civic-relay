# SENDA RoadSafe — índice

Capa federada de prevención de colisiones secundarias y coordinación de asistencia. **Estado: banco de pruebas (sin integraciones reales firmadas).**

| # | Documento | Contenido |
|---|---|---|
| 0 | [00_AUDIT_AND_DECISIONS.md](00_AUDIT_AND_DECISIONS.md) | Auditoría Git/CI, base elegida (PR #47 `743c4f5`), matriz de reutilización, decisiones, arquitectura, handoff |
| ADR | [../adr/ADR-ROADSAFE-001.md](../adr/ADR-ROADSAFE-001.md) | Decisión arquitectónica y alternativas descartadas |
| 1 | [01_INTEROP_MATRIX.md](01_INTEROP_MATRIX.md) | Fichas DGT 3.0, NAP, Waze, Google, C-ITS, 112, asistencia privada |
| 2 | [02_VULNERABILITY_REGISTER.md](02_VULNERABILITY_REGISTER.md) | P0–P3 con corrección y prueba |
| 3 | [../../evidence/roadsafe/ROADSAFE_RESULTS.md](../../evidence/roadsafe/ROADSAFE_RESULTS.md) | Resultados reproducibles (A–E, barridos, controles negativos, H-ROAD-2/3) |
| 4 | [04_HYPOTHESES.md](04_HYPOTHESES.md) | H-ROAD-1/2/3 preregistradas |
| 5 | [05_PILOT_AND_FUNDING.md](05_PILOT_AND_FUNDING.md) | TRL, piloto ES→NL, costes, acuerdos pendientes |
| 7 | [07_DATASET_ES_DE_NL_BE.md](07_DATASET_ES_DE_NL_BE.md) | Dataset oficial armonizado (652 224 accidentes ES/DE/NL/FR/GB), hallazgos replicados |
| 10 | [10_SEVERITY_MODEL_CALIBRATION.md](10_SEVERITY_MODEL_CALIBRATION.md) | Modelo multivariante de gravedad (551 260 accidentes, AUC 0,78), OR ajustados, validación por país |
| 11 | [11_ROAD_BACKBONE_WARNING_BUS.md](11_ROAD_BACKBONE_WARNING_BUS.md) | La carretera como senda principal: bus de avisos, horizonte, presupuesto de atención, cadena BLE frente a portador del sentido contrario, intercambio entre dispositivos blindado |
| 12 | [12_DRIVING_PHYSICS_SIGHT_URGENCY.md](12_DRIVING_PHYSICS_SIGHT_URGENCY.md) | Conducción: visibilidad calculada por trazado (validada con la ordenada media), deceleración necesaria (DRAC) y peligro oculto tras la curva; la urgencia física manda en la atención |
| 13 | [13_BLE_RELAY_HMI_VALIDATION.md](13_BLE_RELAY_HMI_VALIDATION.md) | H-ROAD-BLE-1 / H-ROAD-HMI-1: viabilidad del relé BLE por la calzada contraria y árbitro de atención (rama lateral #49) |
| 14 | [14_ROAD_ALERT_FABRIC_COVERAGE.md](14_ROAD_ALERT_FABRIC_COVERAGE.md) | Road Alert Fabric: aviso canónico, horizonte y cobertura verificable (rama lateral #50) |
| 15 | [15_ROBUST_QUEUE_REACHABILITY_RESEARCH.md](15_ROBUST_QUEUE_REACHABILITY_RESEARCH.md) | H-ROAD-RRE-1 / H-ROAD-COVER-1: alcance robusto del final de cola y cotas de cobertura (rama lateral #51) |
| 16 | [16_CONSOLIDATION_F0.md](16_CONSOLIDATION_F0.md) | Consolidación F0: ramas unidas, decisiones de fusión y módulos paralelos pendientes de unificar |
| 9 | [09_DIFFERENTIATION_DETECTION_SECURITY.md](09_DIFFERENTIATION_DETECTION_SECURITY.md) | Soluciones existentes, diferenciación, detección de accidentes, blindaje |
| 8 | [08_COMPANION_WAZE_SENSORS_STRATEGY.md](08_COMPANION_WAZE_SENSORS_STRATEGY.md) | Alcance a todos los conductores, Waze, sensores, física del impacto, emergencia guiada |
| 6 | [06_CASUISTRY_RISK_AND_CONCLUSIONS.md](06_CASUISTRY_RISK_AND_CONCLUSIONS.md) | Evidencia con fuentes, 8 mecanismos, probabilidades por circunstancia, conclusiones |

## Código

| Módulo | Función |
|---|---|
| `packages/senda/src/roadsafe-frame-trust.mjs` | Autenticidad/replay/plausibilidad de tramas; cápsula firmada |
| `roadsafe-correlation.mjs` | Correlación espacio-temporal y fusión por raíz causal |
| `roadsafe-incident-twin.mjs` | Gemelo digital: FSM con autoridades, auditoría, vistas |
| `roadsafe-secondary-risk.mjs` | Física de parada, Monte Carlo, política de aviso |
| `roadsafe-dispatch.mjs` | Orquestador de asistencia + simulador contractual |
| `roadsafe-emergency-gateway.mjs` | Expediente 112, nunca llamada automática |
| `roadsafe-delivery.mjs` | Estados de entrega y política de canales |
| `roadsafe-interop.mjs` | CIFS, DATEX II, deep links, DENM/SRTI, registro de capacidades |
| `roadsafe-accident-sim.mjs` | Simulador contrafactual del caso + ranking de circunstancias |
| `roadsafe-evidence.mjs` | Registro de evidencia (fuente, grado, transferencia) y casuística |
| `roadsafe-risk-factors.mjs` | Índice de riesgo explicable (física + factores con evidencia) |
| `roadsafe-priority.mjs` | Priorización explicable de incidentes |
| `roadsafe-zone.mjs` | Plan dinámico de señalización de zona y cola |
| `roadsafe-dataset.mjs` / `roadsafe-dataset-analysis.mjs` | Armonización ES/DE/NL(/BE) y estadística (OR, Wilson, Bayes empírico, casos similares) |
| `scripts/roadsafe-data/build-dataset.mjs` | Descarga oficial + SHA-256 + agregados |
| `roadsafe-guidance.mjs` | Preguntas de seguridad, ¿quedarse o salir?, recuento de implicados |
| `roadsafe-occupants.mjs` | Manifiesto de ocupantes, comprobación tras choque, móviles perdidos |
| `roadsafe-location-share.mjs` | Plus Code, PK, SMS GSM, geo:, tel:112 |
| `roadsafe-crash-physics.mjs` | Impacto plano, momento angular, trayectoria, envolvente de peligro |
| `roadsafe-vehicle-sensors.mjs` | IMU, GNSS, OBD-II, choque vs caída del móvil |
| `roadsafe-announcer.mjs` | Megafonía por voz en 5 idiomas |
| `roadsafe-service-stop.mjs` | Parada señalizada de taxi/grúa |
| `roadsafe-responders.mjs` | Servicios compartidos con autorización |
| `roadsafe-routes.mjs` | Rutas favoritas, paquete sin conexión, comparación por riesgo |
| `roadsafe-crash-detect.mjs` | Detección de accidente por fusión de evidencias físicas y de contexto |
| `roadsafe-severity-model.mjs` | Regresión logística IRLS, AUC/Brier/calibración, dejar un país fuera, probabilidad de gravedad |
| `roadsafe-guard.mjs` | Cifrado por incidente, custodia firmada, anti-abuso, privacidad |
| `investor-next/public/senda/roadsafe.html` | Consola ciudadano / operador / científico |

## Reproducir

```bash
node --test packages/senda/tests/*.test.mjs packages/senda/tests/defense/*.test.mjs
node --test packages/senda/tests-adversarial/*.test.mjs
node packages/senda/scripts/roadsafe-experiment.mjs --n 3000
NODE_PATH=/ruta/a/playwright node investor-next/scripts/senda-roadsafe-e2e.mjs
```
