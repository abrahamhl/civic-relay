---
name: acoustics-wave
description: "Ondas acústicas, STFT, beamforming TDOA y ruido ambiental"
license: MIT
compatibility: OpenCode project skill
---

# Ondas acústicas, STFT, beamforming TDOA y ruido ambiental

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Calibrar sample rate, posición de micrófonos, clock drift y reverberación, incertidumbre angular, falsas detecciones.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Test con grabaciones consentidas y SNR medido; ninguna capacidad no demostrada de atravesar paredes.

## Referencias primarias para comprobar versiones

- https://docs.scipy.org/doc/scipy/reference/signal.html
- https://librosa.org/doc/latest/index.html
- https://pyroomacoustics.readthedocs.io/

### Procesamiento de señales
- Diseñar STFT de audio con ventana, overlap, resolución f y t, anti-aliasing, canal, sample rate y clipping identificados.
- TDOA y beamforming necesitan geometría multicanal y sincronía; incluir velocidad del sonido dependiente de temperatura/humedad y límites de reverberación.
- Aplicar filtros robustos, estimación SNR, umbral de decisión y evaluación de eventos naturales no amenazantes para false positives.
- Captar solo sonido de dispositivos propios y consentidos. No registrar conversaciones; el micrófono mono no localiza posición 3D de una persona.
- Poner como baseline detección por energía y análisis espectral antes de modelos profundos.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
