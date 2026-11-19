# SENDA · Observaciones geoespaciales científicas v0.2 — NASA EONET + USGS

Fecha de trabajo: 2026-11-09 · rama de investigación `feat/senda-usgs-map-evidence-20261108`. Base PR #25. Todos los cambios permanecen en PR #26, sin promoción a producción.

## Objetivo verificable

Crear una segunda entrada real de información geográfica con trazabilidad y mantener la distinción entre un **catálogo de acontecimientos** y una **medición física del fenómeno**.

### Fuentes

1. **USGS Earthquake Hazards Program** — catálogo de terremotos M≥4,5 de la última semana. Endpoint https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson · contrato https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php. Los puntos indican ubicaciones catalogadas por USGS. No hay pronóstico sísmico.
2. **NASA EONET v3** — catálogo de eventos de incendios forestales, incluyendo referencias de fuentes de curación. Endpoint https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=all&days=30&limit=150 · documentación https://eonet.gsfc.nasa.gov/docs/v3.

La API EONET cataloga eventos naturales con geometrías y referencias de origen: **no** proporciona perímetros verificados, velocidad de propagación, intensidad, puntos calientes calibrados ni una alerta institucional operativa. La geometría POINT utilizada en el mapa es una localización representativa del catálogo, no un frente del incendio. No se convierte POLYGON en un centroide ficticio.

## Cambios implementados

- `apps/senda-live/server/domain/eonet-wildfires.mjs`: normaliza registros NASA EONET, rechaza valores imposibles, guarda la URL y huella SHA-256 de los bytes descargados, limita la memoria y trata la pérdida del upstream de forma explícita.
- `GET /api/sources/eonet-wildfires`: consulta un feed fijo, sin URL arbitraria; 503 ante indisponibilidad sin copia utilizable.
- `apps/senda-live/web/src/components/MapView.tsx`: nueva capa voluntaria para eventos de incendio catalogados, con color propio, fechas, fuente y enlace original. Los campos de terceros se muestran mediante `textContent`.
- `apps/senda-live/tests/eonet-wildfires.test.mjs`: pruebas deterministas de estructura, geometría, duplicados, procedencia, URL, caché, concurrencia, agotamiento y fallo de origen.
- `apps/senda-live/scripts/capture-eonet-research.mjs`: ejecución de adquisición real desde el runner CI, con recibo JSON que registra fecha, fuente, cantidad, muestra de IDs, SHA-256 y estatus. No se almacena contenido personalizado.
- Workflow `.github/workflows/senda-live-usgs-map.yml`: compilación, TypeScript, tests y adquisición real opcional con artefacto aislado. El paso de red no controla la validez del build.

## Estados de verdad

| Capa | Tipo científico | Adquisición | Capacidad inferencial |
| --- | --- | --- | --- |
| Sismos USGS | `HISTORICAL_OBSERVATION` | Feed público con caché, sin permisos especiales | Ubicaciones de eventos reportados, no anticipación |
| Incendios EONET | `CURATED_EVENT_METADATA` | Fuente NASA y referencias enlazadas; huella de bytes | Localización de eventos catalogados, no perímetros |
| Emergencias SENDA | Estados y políticas propias | Fuentes y verificadores independientes | No se promocionan automáticamente desde estos feeds |

Estados de disponibilidad: `SOURCE_SNAPSHOT`, `CACHED_SNAPSHOT`, `STALE_SNAPSHOT`, `UNAVAILABLE`. Una caché obsoleta se identifica y no representa un evento recién observado.

La huella criptográfica de los bytes protege la reproducibilidad de una descarga *si los bytes originales se guardan por un procedimiento externo*. No prueba que un modelo sea preciso, que la fuente sea una autoridad emisora de alertas, ni garantiza por sí sola la autenticidad del contenido remoto.

## Reproducción

```bash
node --test apps/senda-live/tests/eonet-wildfires.test.mjs apps/senda-live/tests/usgs-earthquakes.test.mjs
corepack pnpm --filter @senda/live test
corepack pnpm --filter @senda/live type-check
corepack pnpm --filter @senda/live build
node apps/senda-live/scripts/capture-eonet-research.mjs
```

El último comando requiere salida a Internet; el resto de pruebas de los adaptadores está aislado de la red.

## Mejoras siguientes, por impacto

1. Ejecutar prueba de interfaz en Chromium real: capas, popups, móvil, ausencia de HTML inyectado.
2. Reemplazar las teselas raster de OSM por un proveedor compatible con la política de almacenamiento de mapas offline.
3. Crear contrato común versión 1 de `SourceEvidence` para EONET, USGS, meteo y datos de carretera, con campos explícitos para *observation time*, *source published time*, *download time* y *model prediction time*.
4. Incorporar productos de perímetro históricos independientes (EFFIS/NIFC/MTBS según licencia y cobertura); medir predicciones de incendio frente a perímetros en horizonte congelado y sobre incendios fuera de muestra.
5. Conectar los resultados calibrados a la línea temporal 2D/3D mediante mapas de incertidumbre, distinguiendo claramente el *render* de los datos físicos.

## Dependencias y despliegue

PR #26 depende del código de SENDA LIVE en PR #25. No fusionar automáticamente PR #26 contra `master` hasta que la base y el despliegue estén revisados. Validar SHA exacto de GitHub Actions, interfaz y hosting por separado.
