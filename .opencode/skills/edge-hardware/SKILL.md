---
name: edge-hardware
description: "COTS ESP32/RPi, sensores, BLE/LoRa, energía e interoperabilidad"
license: MIT
compatibility: OpenCode project skill
---

# COTS ESP32/RPi, sensores, BLE/LoRa, energía e interoperabilidad

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Presupuesto por BOM, conexión USB/UART real, telemetría de RSSI/SNR/PER/energía, watchdog y captura de logs; probar bandas.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Sin radio físico no hay ACK aire; radio conforme al país, nada de frecuencias no autorizadas.

## Referencias primarias para comprobar versiones

- https://docs.espressif.com/projects/esp-idf/en/latest/
- https://www.raspberrypi.com/documentation/
- https://meshtastic.org/docs/

### Ingeniería económica real
- Separar los conjuntos: Android ↔ Android por Nearby, Android ↔ gateway IP, ESP32 ↔ ESP32 LoRa por radio apropiada; una PWA no obtiene permisos RF privilegiados sin puente hardware.
- Emitir BOM con referencia y precio encontrado por proveedor, alimentación, frecuencia legal NL/ES, antena, alcance esperado SOLO como hipótesis y consumo medido.
- Probar secuencia SOS con WAN desconectada: captura, firma, store, salto, ACK, sincronización; logs de ambos extremos con timestamps.
- Monitorizar watchdog, baterías, fallos de enlace, cola persistente, radios dormidas y clock drift. No conectar radio a bandas reguladas sin autorizaciones.
- Diseño de gateway modular bajo coste: SBC opcional + USB LoRa + Android, adaptadores USB serial/MQTT para medir y publicar estado real.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
