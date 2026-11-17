---
name: osint-corroboration
description: "GDACS, USGS, EONET, EFFIS, AEMET CAP y dependencias de sensores"
license: MIT
compatibility: OpenCode project skill
---

# GDACS, USGS, EONET, EFFIS, AEMET CAP y dependencias de sensores

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Normalizar UTC/CRS/procedencia, grafo upstream con alias, licencias, falsos positivos, TTL y anomalías.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

GDACS-USGS misma señal no corroboración independiente; Merkle auténtico sólo con proofs y firmas.

## Referencias primarias para comprobar versiones

- https://www.gdacs.org/
- https://earthquake.usgs.gov/fdsnws/event/1/
- https://eonet.gsfc.nasa.gov/docs/v3
- https://effis.jrc.ec.europa.eu/

### Correlación reproducible
- Representar dependencia upstream como grafo con aliases, versión del catálogo y relación de redistribución; manejar GDACS y USGS como fuente potencialmente compartida.
- Matching multirriesgo: identificar fenómeno, rango espacial, ventana temporal y entidad reportada. No emparejar dos incendios solo por proximidad cuando las fechas no concuerdan.
- Separar detección térmica (píxel activo) de perímetro, frente y orden de evacuación. Separar pronóstico NWP de estaciones medidas y alertas oficiales.
- Para cadena de custodia, preservar bytes originales y hashes, origen de firma, verificador independiente; árbol Merkle únicamente con pruebas de inclusión/consistencia.
- Añadir `source_dependency_group`, `collection_time`, `event_time`, `max_age`, `provenance_verdict`, `calibration_status` y `license`.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
