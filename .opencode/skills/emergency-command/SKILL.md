---
name: emergency-command
description: "Protección civil, incident command, roles y alertas verificadas"
license: MIT
compatibility: OpenCode project skill
---

# Protección civil, incident command, roles y alertas verificadas

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Separar aviso institucional firmado, reporte civil, simulacro y predicción; controlar quién puede difundir y corregir.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Cero autoenvío a organismos no autorizados; toda decisión operativa requiere control humano.

## Referencias primarias para comprobar versiones

- https://www.oasis-open.org/standard/cap-v1-2-os/
- https://www.un-spider.org/
- https://www.gdacs.org/

### Integración institucional legítima
- Diseñar roles civil, periodista, observador, voluntario autorizado, operador sanitario, protección civil y administrador de plataforma con límites precisos.
- Estados de eventos: UNVERIFIED, CORROBORATED, DISPUTED, OFFICIAL_ALERT, RETRACTED y SIMULATION; los usuarios no pueden elevar el estado institucional sin acreditación.
- Protocolo CAP para ingestión de advertencias oficiales, nunca confundir publicar un reporte con emitir una alerta estatal.
- Pruebas de ejercicios tabletop sin notificaciones reales a servicios 112/911. En caso de fallo de red mostrar QUEUED, no notificar como recibido.
- En cooperación con cuerpos de seguridad/defensa: datos mínimos, canales autorizados, coordinación logística defensiva; nada de vigilancia masiva ni targeting.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
