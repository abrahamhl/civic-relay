---
name: rf-propagation
description: "ITU-R P.526-16, P.838-3 y Fresnel sobre DEM real"
license: MIT
compatibility: OpenCode project skill
---

# ITU-R P.526-16, P.838-3 y Fresnel sobre DEM real

## Uso y objetivo

Invocar solamente cuando el módulo necesita esta especialidad. No cargar todas las skills en cada turno; minimizar tokens y reutilizar evidencia previa.

## Protocolo de ingeniería

Documentar bandas, unidades, polarización, k-factor, difracción, clutter, NLOS; tablas y vectores oficiales; medir RSSI/SNR.

1. Inspeccionar solo el subárbol relevante, tests y documentación más reciente.
2. Consultar estándares y fuentes oficiales; anotar versión, fecha, licencia, restricciones y el permiso efectivo del proyecto.
3. Separar matemáticas conocidas, hipótesis, parámetros ajustados, simulaciones y observaciones instrumentales.
4. Diseñar al menos un test positivo, dos negativos y un caso frontera; identificar unidades e incertidumbre.
5. En integraciones externas, comprobar la fuente sin acceder a sistemas privados, credenciales de terceros o endpoints no autorizados.
6. Entregar código pequeño, prueba ejecutada, coste y evidencia. Un informe sin test no cierra una incidencia P0.

## Gate de aceptación

Afirmación de cobertura prohibida sin ensayos físicos y receptor/antena concretos.

## Referencias primarias para comprobar versiones

- https://www.itu.int/rec/R-REC-P.526
- https://www.itu.int/rec/R-REC-P.838
- https://www.itu.int/rec/R-REC-P.530

### Comprobaciones físicas
- Mantener unidades SI internas: metros, Hz, W/dBm, dBi y ángulos, CRS/datum para DEM y altura del suelo.
- Contrastar zona F1 = sqrt(lambda*d1*d2/(d1+d2)), curvatura efectiva k*R, FSPL y pérdidas por difracción frente a P.526-16. No reutilizar una misma unidad de distancia para km y m.
- P.838-3: utilizar coeficientes k y alfa de las fórmulas oficiales dependientes de frecuencia/polarización; una tabla aproximada por rangos no es conformidad.
- Comparar con fuentes empíricas y multipath/NLOS de P.530; incluir clutter y edificios cuando la precisión lo requiera. La ausencia de datos del entorno implica UNKNOWN, no despeje.
- Piloto de 30–50 enlaces es objetivo de adquisición, no evidencia ya existente; medir pares con distancia, SNR, PER y hardware conocido en zonas permitidas.

## Contrato de salida

`{issue, hypothesis, module, source, licence, truth_level, tests, measurements, baseline, limitations, result, sha, followups}`.

Nunca anunciar integración real, certificación, cumplimiento normativo o capacidad operacional mediante un test sintético.
