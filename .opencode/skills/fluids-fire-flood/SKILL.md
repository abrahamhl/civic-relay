---
name: fluids-fire-flood
description: "CFD LES, Rothermel, hidrología, advección, conservación, meteo"
license: MIT
compatibility: OpenCode project skill
---

# CFD LES, Rothermel, hidrología, advección, conservación, meteo

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Verificar malla, CFL, condiciones frontera, convergencia, masa/energía y escenarios; NIST FDS baseline interior no equivale a incendios forestales.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Prohibido confundir partículas de viento o humo visual con predicción física calibrada.

## Referencias primarias para comprobar versiones

- https://pages.nist.gov/fds-smv/
- https://www.openfoam.com/
- https://www.ecmwf.int/en/forecasts/datasets

### Ciencia de fluidos
- Clasificar modelos: Rothermel para propagación empírica de fuego superficial, NIST FDS para LES de calor/humo en entornos apropiados, OpenFOAM para CFD configurable; no tratarlos como intercambiables.
- Para flujo: conservar masa, cantidad de movimiento y energía; especificar condiciones iniciales y frontera, tamaño de malla, dt/CFL, convergencia, precisión y estabilidad.
- Para aguas: contraste 1D/2D hidráulico con topografía DEM y lluvia; probabilidades de inundación sólo si se calibran con observaciones.
- Para meteorología: distinguir estación, reanálisis y modelo NWP; manejar datum y tiempos; evitar inferir viento 3D local a partir de nueve muestras sin incertidumbre espacial.
- Tests de conservación, inversión de viento, sensibilidad a pendiente, combustible nulo y holdout de incendios/inundaciones completos.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
