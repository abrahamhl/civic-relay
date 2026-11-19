# RoadSafe · Consolidación F0 (2026-11-18)

**Objetivo:** una sola rama canónica de SENDA Drive en lugar de dos cadenas de PR apiladas.

| Cadena | PR | Contenido |
|---|---|---|
| Principal | #46 → #47 → #48 → #53 | Integración canónica, iteración científica, RoadSafe P0, bus de avisos, horizonte, atención, gossip, física de la conducción, auditoría de valores por defecto |
| Lateral (desde 1c47714) | #49 → #50 → #51 | Relé BLE por la calzada contraria, árbitro de atención, Road Alert Fabric, alcance robusto de la cola, cotas de cobertura |

Ambas cadenas se fusionan en `claude/modest-gauss-4qkcps` sin descartar código.

## Decisiones tomadas en la fusión (auditoría del corredor C1–C6, hecha por separado en las dos ramas)

Regla: en cada bloque se queda la versión **más estricta**; si las dos son igual de honestas, la más explícita.

| Punto | Decisión | Motivo |
|---|---|---|
| Confianza fuera de [0, 1] | `null` (rama lateral) | Antes la rama principal la recortaba a [0,01; 0,999]: un valor fuera de rango no es un dato |
| Fusión del corredor | Solo cuentan fuentes verificadas con confianza > 0,5 (rama lateral) | La falta de evidencia no puede sumar ni tranquilizar |
| Radio combinado | Envolvente conservadora; `null` si algún radio no está declarado (rama lateral) | No se supone independencia |
| Intervalo del 90 % | `null` + `uncertaintyIntervalBasis` HEURISTIC (ambas) | No existe un intervalo calibrado |
| DATEX II de la DGT | Exige hora **y** descarta registros suspendidos (ambas) | Combinación de las dos auditorías |
| Puente MQTT sin tokens | Falla al crearlo (rama principal) | Falla cerrado antes y de forma explícita |
| `objectClass` sin dato | `null` (rama lateral) | «Desconocido» no es una etiqueta |
| Marca de calidad por defecto | `VALIDATION_NOT_ESTABLISHED` (rama lateral) | Más explícita |
| Estado del canal | `hardwareAvailability: 'UNKNOWN'` (rama lateral) | Antes se suponía disponible |

Las pruebas de las dos ramas se ajustaron a estas decisiones; ninguna se ha desactivado.

## Pendiente: módulos paralelos que hacen lo mismo

Las dos cadenas construyeron por separado piezas equivalentes. **Conviven** tras la fusión; falta elegir la canónica:

| Función | Rama principal | Rama lateral |
|---|---|---|
| Aviso canónico y difusión | `roadsafe-warning-bus` | `roadsafe-road-alert-network` |
| Horizonte electrónico | `roadsafe-horizon` | `roadsafe-road-alert-network` |
| Atención del conductor | `roadsafe-attention` | `roadsafe-alert-arbiter` |
| Paso de avisos sin red | `roadsafe-gossip` | `roadsafe-opposite-relay` (viabilidad) |
| Pantalla | Pestaña «Carretera» | Pestaña «Laboratorio de carretera» |

Sin equivalente en la otra rama (se conservan): `roadsafe-queue-reachability`, `roadsafe-coverage-bounds`, `roadsafe-drive-physics`, `roadsafe-exposure`.
