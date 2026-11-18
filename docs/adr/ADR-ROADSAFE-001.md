# ADR-ROADSAFE-001 · Capa federada de prevención de colisiones secundarias y coordinación de asistencia

- **Estado:** Propuesto (pendiente de decisión del titular del proyecto)
- **Fecha:** 2026-11-17
- **Contexto de caso:** escenario de investigación anonimizado del 17-11-2026 (avería en arcén con V16, taxi, alcance y empuje). No se conocen datos físicos del caso; no se atribuye defecto a la baliza.

## Contexto

SENDA tenía piezas viales (trama BLE de 24 B, lector DATEX II, escena PAS, CIFS) sin autenticidad, sin topología de calzada y con estados que podían sobredeclarar («112 avisado»). La pregunta científica: *¿podemos convertir la señalización pasiva de una avería en una gestión federada, verificable y anticipativa del riesgo, sin permisos inexistentes ni cobertura universal?*

## Decisión

Se crea una capa **RoadSafe** de 9 módulos (`packages/senda/src/roadsafe-*.mjs`), sin dependencias externas, sincronizados a la web por `sync-web`, que:

1. **Autentica o degrada** (frame-trust): sin firma ⇒ pista ADVISORY; con clave inscrita ⇒ SIGNED_PEER/AUTHORITY_VERIFIED.
2. **Correlaciona por raíz causal** (correlation): evita contar V16, su reflejo en DGT 3.0 y el navegador como tres fuentes.
3. **Modela el incidente como gemelo** (incident-twin): 11 estados, tabla de transiciones con autoridades y pruebas exigidas, idempotencia, STALE, auditoría SHA-256 encadenada, vista pública sin datos personales.
4. **Estima riesgo y decide si avisar** (secondary-risk): física de parada con incertidumbre (Monte Carlo pareado) + política de ventana útil con abstención.
5. **Coordina asistencia sin ser central** (dispatch): contrato `request/acknowledge/updateStatus/cancel/handover/audit`; 2xx ⇒ TRANSPORT_ACCEPTED como máximo.
6. **Prepara el 112 sin llamar** (emergency-gateway): expediente PIDF-LO/CAP-like, `tel:112` humano, modo TEST, dedupe, TTL y revocación.
7. **Entrega con estados honestos** (delivery): QUEUED…DELIVERY_UNKNOWN; reutiliza `posteriorReliability`.
8. **Exporta contratos verificados** (interop): CIFS validado contra la especificación oficial, DATEX II v3 con ida y vuelta, deep links, mapeo DENM/SRTI (prototipo).
9. **Experimenta contrafactualmente** (accident-sim): A–E pareados con procedencia de parámetros y controles negativos.

## Alternativas descartadas

| Alternativa | Motivo del descarte |
|---|---|
| Inyectar avisos en Google Maps | No existe operación pública documentada (NOT_SUPPORTED). |
| Leer avisos de Waze por ingeniería inversa | Prohibido por la misión y por términos de servicio; solo programas de socios. |
| Depender de malla BLE ciudadana | Adopción incierta, límites de Android en segundo plano, alcance corto; se mantiene como canal complementario y no crítico. |
| Emitir DENM C-ITS desde el móvil | Requiere estación homologada y PKI C-ITS; solo mapeo semántico. |
| Ordenar frenadas al conductor | Sin validación de factores humanos; riesgo de distracción; se describe el peligro. |
| Duplicar `causal-evidence-fusion.mjs` | Su grafo de fuentes no cubre tráfico; se reutiliza el principio con un registro de linaje vial propio. |

## Consecuencias

- (+) Cada afirmación del sistema tiene fuente y estado verificable; defendible ante administraciones y aseguradoras.
- (+) Contratos listos para el día en que exista convenio (DGT 3.0, socio Waze, aseguradora, PSAP).
- (−) Sin convenios, el beneficio para conductores reales es **cero**: el valor actual es de arquitectura, banco de pruebas y expediente.
- (−) Los umbrales de la política de aviso son hipótesis hasta un estudio de simulador/campo.

## Diagrama de interoperabilidad

Ver `docs/roadsafe/00_AUDIT_AND_DECISIONS.md §5` (Mermaid) y la matriz `docs/roadsafe/01_INTEROP_MATRIX.md`.
