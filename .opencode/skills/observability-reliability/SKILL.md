---
name: observability-reliability
description: "SLO, consumo, telemetría real, coste cloud e impacto energético"
license: MIT
compatibility: OpenCode project skill
---

# SLO, consumo, telemetría real, coste cloud e impacto energético

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Instrumentar latency P50/P95, error rate, memory leak, VRAM, batería, costo/observación, calidad por snapshot.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Pruebas reproducibles con caídas y carga; degradación no falsa apariencia de online.

## Referencias primarias para comprobar versiones

- https://opentelemetry.io/docs/
- https://prometheus.io/docs/
- https://grafana.com/docs/

### SRE cuantitativa
- Instrumentación OpenTelemetry con métricas por fuente/portador/módulo, latencia P50/P95/P99, errores, tasa de reintentos, cola y backlog.
- Circuit-breaker y presupuesto de llamadas para proveedores externos; en modo offline no reintentos activos ilimitados.
- Perfil WebGL: js heap, GPU drawcalls, frame p95, FPS y memory leaks; detener gráficos no visibles, limpiar geometry/materials/texturas.
- Evaluar Android battery y radio wake locks bajo permisos; coste por 1.000 incidentes procesados y costes de egress vídeo.
- Test caos restringido a laboratorio: cae WAN, backend, token, stream, feed y gateway; registrar estados de experiencia sin declararse LIVE.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
