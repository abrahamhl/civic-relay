---
name: interoperable-apis
description: "Waze for Cities, Google Maps Routes, NDW, C-ITS, APIs exteriores"
license: MIT
compatibility: OpenCode project skill
---

# Waze for Cities, Google Maps Routes, NDW, C-ITS, APIs exteriores

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Gateway contract-first con scopes, credenciales, rate-limits, licencia, fallback y auditoría. Waze partners para feed.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

No scraping Waze/Maps; partner pending no LIVE, datos de terceros no se redistribuyen sin permisos.

## Referencias primarias para comprobar versiones

- https://support.google.com/waze/partners/answer/10618477
- https://developers.google.com/waze/data-feed/overview
- https://developers.google.com/maps/documentation/routes/
- https://developers.google.com/maps/documentation/roads/policies

### Contrato multisoftware
- Un `SourceAdapter` versionado debe exponer `permissions`, `discover`, `health`, `fetchObservation`, `normalize`, `subscribe`, `disconnect`, `evidence`, `rights` y `rateBudget`.
- Waze for Cities: acceso a feed mediante Partner Hub/GeoRSS y área aprobada; un usuario común puede compartir enlace/deeplink, no acceder al feed privado.
- Google Routes API: resultados sujetos a uso y almacenamiento restringidos; no copiar mapas ni derivar datos para motor cartográfico ajeno. OSM self-host/Valhalla para alternativas cuando licencias lo permiten.
- NDW desde portal público y sus condiciones; DATEX II con version/schema verificado y timestamp; interfaces C-ITS V2X con acuerdos técnicos.
- En cada conector test de auth, 429/rate, latencia, 500, data stale, esquemas inválidos, revocación y trazabilidad.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
