# SENDA — Terrain Lab: relieve geográfico real + meteorología 4D

## Línea base y dependencia

PR #28 `feat/senda-terrain-mesh-georef-20261109` sobre PR #27 Atmosphere 4D (a su vez depende de PR #26 y PR #25). No se han fusionado ni desplegado estos cambios en el dominio público. El trabajo se mantiene en una rama independiente.

## Problema resuelto en código

Antes, SENDA mostraba una superficie 3D extruida según la temperatura/viento/lluvia: el eje vertical **no representaba terreno**. Ahora hay un modo `TERRAIN` que utiliza muestras georreferenciadas de un raster DEM de terreno: coordenadas WGS84, altitude en metros, escala geográfica longitudinal corregida por cos(latitud) y exageración vertical explícita entre ×1 y ×6.

### Origen del relieve

- Dataset: [Mapzen Terrain Tiles, AWS Open Data](https://registry.opendata.aws/terrain-tiles/). Imágenes PNG Terrarium por mosaico XYZ zoom 10.
- Código: `apps/senda-live/server/domain/terrain-grid.mjs`. Restricción a cuatro regiones nominales (`valencia`, `madrid`, `arnhem`, `veenendaal`), sin coordenadas personales ni URLs aportadas por el usuario.
- Geoextent regional: ±0,12° latitud, ±0,18° longitud, malla 33×33 de 1.089 cotas aproximadamente cada 700–1.000 m según latitud. El zoom 10 del raster de entrada puede aportar muestras adicionales, pero la salida sigue siendo una cuadrícula de 33×33.
- Altitudes derivadas mediante `R * 256 + G + B / 256 − 32768`, unidad metro, con validación de geometría, PNG 256×256, descompresión acotada, CRC-32 por chunk, rechazo de nodata y máximos de descarga.
- Límite de 16 tiles/fuente, 1 MB comprimido por tile, 13 segundos de adquisición, 3 solicitudes concurrentes por lote y bloqueo de errores; almacén de resultados del servidor en RAM por región, TTL de 24 h.
- Dataset compuesto de fuentes de elevación de distintas procedencias y referencias verticales. `verticalDatum=MIXED_SOURCE_NOT_VALIDATED`: sin certificado de alturas topográficas absolutas para obras, inundaciones o rescate.
- **Créditos y licencias:** [Atribuciones obligatorias Mapzen/Tilezen](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Las condiciones son dependientes de las fuentes originales, NO una licencia única universal. No distribuir paquetes completos de mosaicos a terceros sin auditoría de condiciones.

### Integración visual

- `apps/senda-live/web/src/components/Terrain4DRenderer.ts`: superficie topográfica con geometría procedente del DEM, color por altitud o por la variable NWP seleccionada, 9 nodos fuente de meteorología y vectores del viento orientados según dirección **desde** norte.
- `Atmosphere4DStudio.tsx`: selector relieve/topología de variable, órbita táctil y teclado, exageración vertical ×1–×6, timeline de 24 horas conservada, leyenda de fuentes y créditos.
- La altura de la malla se presenta relativa al mínimo regional; se preservan las diferencias métricas de altura, no se afirma datum vertical calibrado. El modo NWP sigue siendo una representación distinta.
- El color meteorológico utiliza interpolación bilineal entre nueve muestras del modelo. No añade resolución científica ni transforma ese pronóstico en una medición física.

### Offline

- `terrain-snapshot.ts`: IndexedDB almacena una derivación 33×33 por zona, con hash por mosaico, CRS, fecha y atribución. No almacena GPS, identidad, usuarios ni recorrido de personas.
- La aplicación web y los dos snapshots locales (pronóstico y DEM) pueden reabrirse sin conexión tras descarga previa. Las teselas cartográficas OSM NO están disponibles offline ni se cachean automáticamente. No equivale a navegación offline mundial.
- El almacenamiento local de una derivación del terreno debe distinguirse de redistribución pública de tiles completos; revisar condiciones de las fuentes antes de ofrecer descargas compartidas.

## Pruebas y evidencia

```bash
node --test apps/senda-live/tests/terrain-grid.test.mjs
corepack pnpm --filter @senda/live test
corepack pnpm --filter @senda/live type-check
corepack pnpm --filter @senda/live build
```

El pipeline de GitHub Actions también ejecuta Chromium en escritorio y móvil: mapa original, cambio al modo TERRAIN, contraste de snapshots, exageración vertical y recuperación offline. Los tests de navegador usan **fixtures sintéticos**, no certifican elevación real. Un paso único `[terrain-live-check]` ejecuta descarga AWS real y conserva un recibo SHA-256, separadamente del browser QA.

## Próximas tareas para elevar valor científico

1. Evaluar alturas frente a una fuente independiente (IGN MDT, AHN Países Bajos o Copernicus DEM, según licencia y resolución) en puntos fuera de muestra. Medir MAE / RMSE y error por pendiente, fuentes de agua y ciudad.
2. Añadir paquete geográfico offline real con mapa vectorial PMTiles y DEM según derechos claros; manifiesto, firma, límites de almacenamiento y actualización incremental.
3. Integrar observaciones de estaciones KNMI/AEMET con coordenadas y UTC para calibrar pronósticos de modelo; registrar skill vs baseline y rango de incertidumbre.
4. Datos de incendios: incorporar polígonos/perímetros históricos y evaluar propagación a distintos horizontes, evitando tratar los puntos EONET como frente de fuego.
5. RF y gateways: utilizar los contratos del Corridor Fabric existente, adjuntando estado de verificación del equipo y operador; separar propagación estimada de cobertura medida.
6. QA visual WebGL/GPU y optimización: perf móvil, mallas LOD, perfiles de pantalla y reducción de consumo de batería.

## Declaración de alcance comercial

La malla DEM de 1.089 puntos es un **prototipo operativo georreferenciado**, no todavía un motor 4D meteorológico completo con volúmenes multicapa o precisión de ingeniería civil. Es una base mensurable para construir un sistema geoespacial profesional y defendible ante revisión técnica.