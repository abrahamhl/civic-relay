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
| `investor-next/public/senda/roadsafe.html` | Consola ciudadano / operador / científico |

## Reproducir

```bash
node --test packages/senda/tests/*.test.mjs packages/senda/tests/defense/*.test.mjs
node --test packages/senda/tests-adversarial/*.test.mjs
node packages/senda/scripts/roadsafe-experiment.mjs --n 3000
NODE_PATH=/ruta/a/playwright node investor-next/scripts/senda-roadsafe-e2e.mjs
```
