# SENDA GeoRelay · Geometría de radio sobre terreno real

Fecha: 9 noviembre 2026. PR #29 sobre PR #28 (y PR #25–#27). Laboratorio de ingeniería, no producción.

## Diferenciación implementada

Sobre la malla geográfica DEM de Mapzen/AWS ya disponible, SENDA ahora puede mostrar una sección entre dos emplazamientos hipotéticos, simular la altura de las antenas, examinar la curvatura terrestre y la primera zona de Fresnel, y proponer un corredor geométrico de rebotes alternativos. El motor se ejecuta en el navegador sin Internet cuando el DEM está descargado.

Se contemplan 433, 868, 2400 y 5800 MHz, antenas de 2–120 m, gráficas 2D de perfiles y siete emplazamientos abstractos de posibles repetidores. **Ningún emplazamiento representa un nodo realmente instalado ni autorizado.**

## Fundamentos físicos

Sea D la longitud total del enlace, d1 y d2 los tramos desde cada extremo hasta un punto, f la frecuencia en Hz y c la velocidad de la luz:

Radio de la primera zona Fresnel: F1 = sqrt((c / f) * d1 * d2 / D).

Elevación relativa de la Tierra esférica: b = d1 * d2 / (2 * k * R), con R = 6371008.8 m y factor k = 4/3 (supuesto).

Despeje de cribado: C = altura del rayo interpolada - b - elevación del DEM - 0.6 * F1.

Referencia ideal de pérdida de espacio libre (dB): 32.44 + 20 log10(distancia_km) + 20 log10(frecuencia_MHz).

El margen ±10 m sirve SOLO como separador heurístico entre tres estados (aparente despeje, aparente bloqueo e incertidumbre). **No está calibrado experimentalmente y NO representa intervalo de confianza.** El resultado no incorpora difracción completa, clutter, árboles, edificios, patrón de antenas, potencia, interferencia, polarización, multipath, humedad o medición SNR/RSSI.

Referencias institucionales:
- UIT-R P.526-16 (2025), propagación por difracción: https://www.itu.int/rec/R-REC-P.526-16-202511-I/en
- UIT-R P.530, enlaces terrestres con visión directa: https://www.itu.int/rec/R-REC-P.530/en

El prototipo incorpora solo cálculos geométricos básicos; no afirma conformidad con la implementación completa de UIT-R.

## Evidencia y reproducibilidad

- Unidad matemática: apps/senda-live/tests/relay-geometry.test.mjs, con distancia geográfica, Fresnel, curvatura k, bloqueo por montaña, sensibilidad al cambio de banda y optimización de mástil.
- UI real: apps/senda-live/web/src/components/GeoRelayPlanner.tsx, integrada en Atmosphere4DStudio.
- Ejecución de prueba offline: apps/senda-live/scripts/qa-geospatial-map.mjs en Chromium, desktop 1440x900 y móvil 390x844.
- Experimento científico con datos geográficos externos: apps/senda-live/scripts/capture-relay-geometry-research.mjs. Consulta puntualmente raster Mapzen/AWS, conserva los SHA-256 por tile y DEM derivado, y calcula cuatro frecuencias por dos alturas más posibles saltos.
- Almacén local: SOLO el DEM público ya disponible en IndexedDB, nunca GPS o movimientos personales.

La prueba con raster real valida la conexión fuente altimétrica → matemáticas RF, pero NO demuestra propagación real porque aún no existen mediciones físicas. La resolución 33x33 del DEM y datum vertical mixto limitan precisión.

## Programa de calibración física (PENDIENTE)

1. Definir corredores de campo autorizados con relieve llano y de montaña, repetidores con permiso legal y registros de antenas y potencia; recopilar coordenadas solo con consentimiento y finalidad clara.
2. Pilotar 30–50 pares de enlaces independientes como objetivo experimental (NO datos obtenidos), con intensidad RSSI/SNR, tasa de entrega, frecuencia, orientación y alturas.
3. Separar TRAIN y HOLDOUT por corredores y equipos, no por paquetes de la misma ruta; evitar leakage espacial.
4. Contrastar relieve contra segunda fuente (IGN MDT / AHN / Copernicus DEM) y medir errores MAE, RMSE, altimetría y pendientes.
5. Publicar tasas de falsos despejes, bloqueos incorrectos y casos inciertos por banda y tipo de relieve.
6. Si se modela probabilidad de enlace, cuantificar Brier/ECE frente a held-out con intervalos de incertidumbre. No transformar la heurística 10m en confianza probabilística sin etiquetas reales.
7. Mantener un inventario criptográfico de fichas de radio autorizadas, sin mezclar emplazamientos hipotéticos con nodos físicos.

## Faltantes antes de prometer utilidad operativa

- Ningún enlace de radio real se ha testado todavía.
- No hay calibraje de difracción ni disponibilidad temporal de un enlace bajo cambios de refractividad.
- No se ha demostrado ruta de datos real, hardware Mesh o cumplimiento de bandas regulatorias.
- La caché offline conserva perfiles DEM locales, pero no todo el mapa OSM vectorial ni cobertura de calles.
- Las siete posiciones A–G son únicamente escenarios geométricos elegidos sobre el raster, no activos de operadoras ni servicios públicos.

## Comprobaciones

    node --test apps/senda-live/tests/relay-geometry.test.mjs
    corepack pnpm --filter @senda/live test
    corepack pnpm --filter @senda/live type-check
    corepack pnpm --filter @senda/live build
    node apps/senda-live/scripts/capture-relay-geometry-research.mjs

El último comando solicita terrain PNG real; ejecutarlo deliberadamente una vez por experimento. Los demás tests son deterministas/offline.

La redistribución de DEM requiere revisión de las fuentes cartográficas originales. https://registry.opendata.aws/terrain-tiles/ y https://github.com/tilezen/joerd/blob/master/docs/attribution.md
