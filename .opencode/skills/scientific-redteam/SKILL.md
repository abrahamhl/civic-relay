---
name: scientific-redteam
description: "Pruebas adversariales independientes de afirmaciones científicas"
license: MIT
compatibility: OpenCode project skill
---

# Pruebas adversariales independientes de afirmaciones científicas

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Buscar contraejemplos, unidades incoherentes, asunciones ocultas, fuentes compartidas, leakage, falta de hardware, falsos positivos.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Informe P0-P3 con líneas exactas, escenarios mínimos y estado de evidencia.

## Referencias primarias para comprobar versiones

- https://www.nist.gov/itl/ai-risk-management-framework
- https://www.iso.org/standard/81230.html

### Estrategia de falsación
- Ejecutar tests de metamorfismo: invertir dirección del viento, suprimir antenas, cambiar timestamp y datum, aumentar pérdidas, reducir canales disponibles. Las salidas deben variar físicamente.
- Probar escenarios adversariales con datos nulos, NaN, infinitos, coordenadas fuera de rango, timestamps futuros, data leakage y fuentes correlacionadas.
- Comparar cada motor contra un baseline ingenuo y contra biblioteca independiente. Reportar efecto, error, intervalos, número de muestras y generalización.
- Revisar el producto: si falla todo `Promise.allSettled`, la interfaz no debe mostrar verde global. Si no hay RF ni dron, no debe mostrar medición activa.
- En cada refutación: `contrato > contraejemplo mínimo > test que falla > corrección propuesta > test de regresión`. No aprobar afirmaciones de marketing sin evidencias.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
