---
name: cameras-vision
description: "Dashcam, cámara propia, ONVIF, RTSP, WebRTC, detección y calibración"
license: MIT
compatibility: OpenCode project skill
---

# Dashcam, cámara propia, ONVIF, RTSP, WebRTC, detección y calibración

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Permisos expresos, modelo cámara intrínseco/extrínseco, homografía, FOV, calibración, blurring y trazas event-time.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Sin cámara, devolver NO_LIVE_STREAM; vídeo grabado=RECORDED_REAL_SAMPLE; TTC no calibrado no es medida.

## Referencias primarias para comprobar versiones

- https://www.onvif.org/profiles/
- https://mediamtx.org/docs/kickoff/introduction
- https://opencv.org/

### Calibración y privacidad
- Detectar y registrar cámara real con credenciales propias/permiso; separar preview de cámara, streaming, detecciones, seguimiento, inferencia y evidencia.
- TTC/rango/velocidad necesitan calibración de intrínsecos, extrínsecos, homografía, referencias y estimación de confianza. Un ancho de carril supuesto no es medición verificada.
- Validar YOLOX/ByteTrack contra clips independientes anotados con mAP, precisión/recall, IDF1/HOTA si aplica, iluminación/lluvia/fog y tasa de falsas alertas.
- Limitar retención de PII, difuminar rostros/matrículas y no indexar cámaras privadas sin acuerdo. Implementar health-check de stream (lag, dropframes, pérdida, latencia).
- Cuando no hay source autorizada, `NO_STREAM` con preview sintética sólo en laboratorio.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
