---
name: gis-digital-twin
description: "GIS 4D, DEM, altimetría, MapLibre, Three y rendimiento"
license: MIT
compatibility: OpenCode project skill
---

# GIS 4D, DEM, altimetría, MapLibre, Three y rendimiento

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Conservar CRS, datum vertical, latencia, resolución y atribuciones; render 3D reproducible desde un snapshot; 2D fallback.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

No colocar satélites reales desde animación paramétrica ni visualizaciones sin data manifest.

## Referencias primarias para comprobar versiones

- https://gdal.org/
- https://docs.maplibre.org/
- https://threejs.org/docs/
- https://registry.opendata.aws/terrain-tiles/

### Geometría honesta
- Modelos DEM con CRS/datum y precisión: corregir interpolación, elevaciones inválidas, cache offline de región y no mezclar altura ortométrica/ellipsoidal.
- Una escena Three.js tiene etiquetas por capa `OBSERVED`, `FORECAST`, `CALCULATED`, `SYNTHETIC` y `NOT_AVAILABLE` visibles.
- Renderizar tormenta/fuego con estado del simulador; no usar partículas independientes como señal de resultado.
- Optimizar draw calls, vertices, texturas, LOD y fps p95 con presupuesto por equipo Android. Fallback accesible 2D.
- Exportar render y metadata de run ID, seed, modelos y unidades para que el vídeo sea defendible.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
