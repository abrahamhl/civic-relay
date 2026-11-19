---
name: satellite-gnss
description: "SGP4, CelesTrak, Galileo OSNMA y hardware satelital compatible"
license: MIT
compatibility: OpenCode project skill
---

# SGP4, CelesTrak, Galileo OSNMA y hardware satelital compatible

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Obtener TLE/OMM con época y checksum, propagar SGP4 a hora UTC, calcular az/el y horizon mask, registrar error. OSNMA con vectores oficiales.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Órbita animada por seno NO es telemetría. Sin módem y permiso, disponibilidad de enlace = UNKNOWN.

## Referencias primarias para comprobar versiones

- https://celestrak.org/
- https://www.gsc-europa.eu/
- https://docs.px4.io/main/en/simulation/

### Dinámica y límites
- Utilizar SGP4 con TLE/OMM, epoch UTC, coordenadas TEME→ECEF→ENU, línea de visión y máscara de horizonte; contrastar con referencia externa. No estimar contacto con seno de un renderer.
- Si la edad de TLE es excesiva, reportar incertidumbre o no disponibilidad. Derivar velocidad radial/geométrica para Doppler, no usar únicamente `cos(elevación)` como solución general.
- Galileo OSNMA autentica mensajes de navegación, no confiere acceso a un satélite de comunicaciones; exigir chips/receptor y vectores de referencia.
- Para NTN, registrar hardware, modem, bandas, licencias, red propietaria, protocolo, disponibilidad real de servicio y consentimiento.
- A falta de hardware, rotular `MATHEMATICAL_VISIBILITY_ONLY` y `NO_SATELLITE_COMMUNICATION_TEST`.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
