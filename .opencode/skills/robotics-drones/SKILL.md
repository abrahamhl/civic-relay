---
name: robotics-drones
description: "ROS2/MAVLink, PX4/Gazebo SITL, fotogrametría GSD y aerodinámica"
license: MIT
compatibility: OpenCode project skill
---

# ROS2/MAVLink, PX4/Gazebo SITL, fotogrametría GSD y aerodinámica

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Probar PX4 SITL→MAVSDK→SENDA sin vuelo real; plan de barrido, battery margin, GSD y limitación de ráfagas; Remote ID autorizado.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Falso positivo de UAV: sin receptor, 0 detecciones live; etiquetar simulación; desactivar comandos reales por defecto.

## Referencias primarias para comprobar versiones

- https://docs.px4.io/main/en/simulation/
- https://mavsdk.mavlink.io/
- https://docs.ros.org/
- https://ardupilot.org/dev/docs/sitl-simulator-software-in-the-loop.html

### Piloto seguro de robótica
- Reusar ROS 2 para topics/servicios/acciones; PX4 o ArduPilot SITL conectado por MAVSDK y Gazebo para sensores simulados, validando timestamp y sistema de referencia.
- Calcular GSD desde parámetros ópticos, solape, autonomía y límites operativos; distinguir plan de misión de ejecución.
- Remote ID es anuncio transmitido por el UAV; la presencia de un hardware en catálogo no prueba captura. No inferir ubicación exacta del piloto desde un ID sin datos proporcionados.
- AERO: contrastar drag, propeller thrust, viento cruzado, masa/energía y margen de seguridad. En SITL puede fallar motor/sensor sin riesgo real.
- En pruebas físicas: piloto cualificado, entorno autorizado, límites de seguridad, operador humano. No control autónomo sobre terceros ni interferencia RF.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
