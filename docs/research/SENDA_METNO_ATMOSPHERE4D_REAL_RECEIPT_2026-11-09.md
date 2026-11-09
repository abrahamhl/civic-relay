# SENDA Atmosphere 4D — Primer recibo meteorológico real (MET Norway)

Fecha de adquisición UTC: **2026-11-08 23:52:48**. Región **Valencia**. Rama `feat/senda-atmosphere4d-offline-20261109`; adquisición ejecutada en PR #27.

## Evidencia verificable

- [GitHub Actions #42537237262](https://github.com/abrahamhl/civic-relay/actions/runs/42537237262)
- [Artefacto JSON `senda-metno-source-receipt` #13639449454](https://github.com/abrahamhl/civic-relay/actions/runs/42537237262/artifacts/13639449454)
- Fuente oficial: [MET Norway Locationforecast 2.0 / compact](https://api.met.no/weatherapi/locationforecast/2.0/documentation).
- Licencia fuente: CC BY 4.0, permite uso comercial con atribución. [MET Norway FAQ](https://api.met.no/doc/FAQ). El servicio requiere User-Agent identificable y caching respetuoso.

| Propiedad | Resultado comprobado |
| --- | --- |
| Estado de descarga | `SOURCE_SNAPSHOT` |
| Puntos de modelo obtenidos | **9** (una cuadrícula regional 3×3) |
| Horas de predicción alineadas | **24** |
| Primera validez del modelo | 2026-11-08 23:00 UTC |
| Última validez del modelo | 2026-11-09 22:00 UTC |
| Fecha de actualización de producto más antigua reportada por el proveedor | 2026-11-08 23:17:53 UTC |
| Digest compuesto de nueve SHA-256 de respuestas raw | `e21d18c0c337ec4894fa9f21088bd702891f94abfbdc2b2852321f0981e63799` |
| Tipo de información | `MODEL_FORECAST` |
| Lectura de estación física | NO |
| Simulación CFD validada | NO |
| Perímetros forestales o predicción del incendio | NO |
| Emisión de alerta institucional | NO |

Se conservaron nueve hashes individuales de las respuestas en el artefacto JSON del workflow. El hash compuesto se calcula sobre esos hashes concatenados: permite detectar diferencias entre conjuntos si se preservan los originales, pero no demuestra precisión científica ni calidad de sensores.

## Pruebas independientes de la adquisición

En el mismo SHA y workflow se aprobaron los tests deterministas del backend y el build/typecheck. Chromium real superó la prueba de 4D, navegación temporal, persistencia IndexedDB y reinicio de PWA offline en 1440×900 y 390×844, usando **fixtures sintéticos únicamente para la parte del navegador**.

El pronóstico de 24 horas procede del servicio meteorológico real en la adquisición separada. No se ha verificado aún la combinación **live upstream → servidor desplegado → navegador público** y no existe release a producción de PR #27.

## Uso correcto en comunicación a inversores

> SENDA integra y renderiza un pronóstico meteorológico horario suministrado por MET Norway, con 9 puntos de referencia, 24 intervalos y evidencia reproducible de adquisición. La interfaz permite orbitar una representación tridimensional de los valores y consultar la predicción previamente descargada sin conexión. El motor no afirma predicciones propias de incendios ni precisión microclimática no validada.

## Límites y siguientes ensayos

1. El grid 3×3 no es cobertura mundial continua; la navegación a nuevas regiones necesita solicitud y caché por región.
2. La altura de la superficie del renderizador representa la variable seleccionada, **no altitud topográfica**.
3. La interpolación bilineal es visual, no un modelo físico que incremente resolución.
4. Para uso profesional, almacenar la caché del proveedor entre réplicas del servidor y respetar el intervalo de actualización y límites API.
5. Agregar datasets independientes de estaciones, DEM y perímetros cuando exista licencia; medir incertidumbre y habilidad predictiva fuera de muestra.
6. La PWA offline conserva la aplicación y el pronóstico descargado, pero los mosaicos del mapa base todavía no son un paquete geográfico offline.