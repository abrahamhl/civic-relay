---
name: dtn-bpv7
description: "BPv7 RFC 9171, BPSec RFC 9172, store-carry-forward"
license: MIT
compatibility: OpenCode project skill
---

# BPv7 RFC 9171, BPSec RFC 9172, store-carry-forward

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Especificar CLA real vs simulado; expiración, fragmentación, reserva/commit, revocación, recibos autenticados y estados de entrega.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Cortes 0/30/90%, replay, reset y energía; confirmación de app ≠ ACK físico.

## Referencias primarias para comprobar versiones

- https://www.rfc-editor.org/rfc/rfc9171
- https://www.rfc-editor.org/rfc/rfc9172
- https://www.rfc-editor.org/rfc/rfc9174

### Ensayo de ingeniería de redes
- Construir un Convergence Layer Adapter por bearer real, con descubrimiento, autenticación, fragmentación, MTU, estado de disponibilidad y teardown; mantener simulador independiente.
- Estados inequívocos: CREATED, QUEUED, IN_CUSTODY, FORWARDED, DELIVERED_VERIFIED y EXPIRED. Sólo ACK firmado/verificado por destinatario puede cambiar a DELIVERED_VERIFIED.
- Simular particiones con ns-3/CORE o harness existente, y repetir en 2+ dispositivos autorizados; registrar retransmisiones, pérdida, energía, p50/p95, contactos.
- Implementar BPSec interoperable sin inventar esquemas; pruebas de replay, suplantación, privación de buffer, clock drift, key loss y recibo falsificado.
- Contrastar routing EAOR contra spray-and-wait, epidemic y baseline de mínima energía en topologías independientes; reportar CI y cortes correlacionados.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
