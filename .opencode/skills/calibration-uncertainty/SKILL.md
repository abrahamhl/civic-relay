---
name: calibration-uncertainty
description: "Calibración de probabilidades, inferencia bayesiana y validación externa"
license: MIT
compatibility: OpenCode project skill
---

# Calibración de probabilidades, inferencia bayesiana y validación externa

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Separar ranking heurístico de probabilidad, particiones fuera de muestra por evento/sitio/fecha, Brier/ECE, fiabilidad y bootstrap.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

La etiqueta 95% sólo si el modelo alcanza cobertura calibrada en HOLDOUT independiente.

## Referencias primarias para comprobar versiones

- https://scikit-learn.org/stable/modules/calibration.html
- https://arxiv.org/abs/1706.04599

### Playbook de validación numérica
- La nota inicial de confianza basada en sumas de pesos sólo puede llamarse `heuristicScore`. Para una probabilidad, entrenar con casos etiquetados y evaluarlos en conjuntos completamente separados por tiempo, territorio y evento.
- Estratificar por fuente, región, tipo de desastre y severidad; comparar Brier score, log-loss, ECE, curvas de fiabilidad, AUROC/AUPRC y prevalencia.
- Aplicar Platt/isotonic o enfoque bayesiano cuando exista suficiente muestra y justificar sobreajuste. Para trayectorias, usar residuals por evento y bandas con cobertura empírica.
- Test explícito de trilateración con 0,1,2,3 anclas, geometría colineal, errores heterocedásticos, matrices singulares, sesgo y covarianza congruente con WLS.
- Si el holdout aún no existe, estado `UNCALIBRATED`, sin probabilidades decorativas ni intervalos falsos.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
