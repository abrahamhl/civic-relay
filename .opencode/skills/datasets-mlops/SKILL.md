---
name: datasets-mlops
description: "Catálogo de datos científicos, versionado, QA y coste"
license: MIT
compatibility: OpenCode project skill
---

# Catálogo de datos científicos, versionado, QA y coste

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Por dataset: proveedor, URL, licencia, hash original, fecha de obtención, UTC, precisión, CRS, derechos y retención; train/test.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

No tratar datos oficiales derivados como independientes; no almacenar PII sin necesidad.

## Referencias primarias para comprobar versiones

- https://docs.xarray.dev/
- https://dvc.org/doc
- https://mlflow.org/docs/latest/index.html
- https://docs.greatexpectations.io/

### Registro científico de datos
- Estrato raw inmutable: hash de bytes originales + URL, permisos, headers, UTC y formato. Estrato normalized: parser/version + unidades/CRS + validaciones.
- Estrato features: graph ID, expiry, split, model version; estrato evidence: output, firma y links verificables.
- Monitorear staleness, completeness, skew, missingness, duplicates, schema drift y coste por acquisition. No ETL 24/7 contra APIs que lo prohíban.
- Versionar muestras con DVC/MLflow solo si compensa recursos. Evitar almacenamiento de vídeo original o datos de matrículas cuando basta un metadato anónimo.
- Nunca obtener ground truth desde la misma fuente que se trata como predictor independiente.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
