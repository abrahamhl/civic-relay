---
name: release-provenance
description: "Trazabilidad de Git, CI, Vercel, SBOM y despliegues"
license: MIT
compatibility: OpenCode project skill
---

# Trazabilidad de Git, CI, Vercel, SBOM y despliegues

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Construir manifest SHA commit+tree+lockfile+artefacto+deployment; no usar READY como certificación; comprobar URL y rollback.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Test manipulación de SHA o artefactos debe fallar cerrado; PR #19 con prueba reproducible.

## Referencias primarias para comprobar versiones

- https://slsa.dev/spec/v1.1/
- https://docs.sigstore.dev/
- https://docs.github.com/en/actions

### Procedimiento avanzado
- Comparar `git rev-parse HEAD`, `git write-tree`, `pnpm-lock.yaml`, `npm ci` si aplica y variables de build. Aislar la compilación para evitar caché obsoleta.
- Producir manifiesto de procedencia de artefactos con firma/autenticidad; contrastar el JSON servido públicamente con el manifest del pipeline.
- Matriz CI: typecheck, unit, browser real, seguridad, perf, tests de científicos; reportar flakiness.
- Verificar despliegue preview exacto y rutas; nunca dar por publicado /live/ a partir de READY del proyecto de inversores.
- Prever rollback, revocación de tokens, backups, y no tocar master sin autorización.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
