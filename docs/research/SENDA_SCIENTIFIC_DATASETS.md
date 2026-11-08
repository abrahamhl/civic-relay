# SENDA · Inventario y calidad de datos científicos

Fecha: 2026-11-08  
Estado: inventario interno; no equivale a calibración ni a validación independiente.

## 1. Regla de clasificación

Cada dato se etiqueta como:

- `OBSERVED`: observación primaria o producto oficial procesado.
- `CALCULATED`: derivado determinista a partir de observaciones.
- `SIMULATED`: generado por un modelo de SENDA.
- `INFERRED`: supuesto o parámetro no medido.
- `UNVERIFIED`: disponible pero sin control de calidad suficiente.
- `BLOCKED`: necesario y no accesible.

`DOCUMENTED_SOURCE` significa que existe una fuente citada; no significa que el dato esté ingerido. `INGESTED` significa que el fichero está en el repositorio y se usa en el código.

## 2. Incendio SMV 2026 (Sierra de Madrid)

Ubicación: `investor-next/public/senda/data/smv2026/`.

Fuente: datos modificados de Copernicus Sentinel (2026), procesados por SENDA; DEM Copernicus GLO-30 (DLR/Airbus, COPERNICUS/ESA). Atribución obligatoria.

| Fichero | Tipo | Contenido | Estado | SHA-256 |
|---|---|---|---|---|
| `real.json` | CALCULATED | Metadatos, malla, calibración, validación | Verificado | `f7342212…f958cef0` |
| `dem_100m.bin` | CALCULATED | Int16 LE, 380×339, 100 m, 422,55–1952,82 m | Verificado | `f687fa10…d0360938` |
| `fuel_100m.bin` | CALCULATED | Uint8, clases 0..4, 380×339 | Verificado | `789b30e3…b1049a13` |
| `burn_100m.bin` | CALCULATED | Uint8, bits 0=24-07, 1=29-07, 2=08-08; severidad moderada-baja o más | Verificado | `41525f3c…e399ca99` |
| `arrival_roi.bin` | SIMULATED | Uint16, minutos desde ignición calibrada; 65535 = no llega | Verificado | `da198bf5…3698adf` |
| `prob_roi.bin` | SIMULATED | 8 capas Uint8: 4 horizontes sin asimilar + 4 tras asimilar | Verificado | `f261db7c…f5f34253` |
| `gfs_20260723_12z.json` | OBSERVED | Perfiles GFS 0,25°, 1000–500 hPa + superficie, run 2026-07-23 12Z | Verificado | `849cf369…a03a409` |
| `gfs_sinoptico.json` | OBSERVED | Presión a nivel del mar, viento a 10 m, T a 2 m | Verificado | `ef27a664…05dab34` |
| `tci_pre.jpg`, `tci_d0724.jpg`, `tci_d0729.jpg`, `tci_d0808.jpg` | OBSERVED | Composiciones de color verdadero Sentinel-2 | Verificado | ver tabla completa |
| `dnbr_d0808.png` | CALCULATED | dNBR 08-08 | Verificado | `4576d023…ebbd21` |
| `fire3d.json` | CALCULATED | Escenario 3D, validación, pluma, flota, cámaras | Verificado | `fa5fa37b…95fc22` |

Tabla completa de hashes: `docs/research/senda-data-sha256.txt` (generada en esta misión).

### 2.1 Malla

- CRS: EPSG:32630.
- Origen: `x0 = 362000`, `y1 = 4482300`.
- Resolución: 100 m para el modelo; 20 m para los productos Sentinel-2 originales.
- Dimensiones: 380×339 celdas (DEM/combustible); ROI 210×159 para llegada/probabilidad.
- Esquinas lon/lat documentadas en `real.json`.

### 2.2 Combustible

Clases: `0` agua, `1` pasto, `2` matorral, `3` arbolado, `4` sin vegetación o urbano.

Regla: NDVI previo (16-07-2026): `<0,15` sin vegetación; `<0,32` pasto seco; `<0,5` matorral; `≥0,5` arbolado; agua por SCL.

Porcentajes: 0,9 % agua; 24,9 % pasto; 42,1 % matorral; 30,9 % arbolado; 1,3 % sin vegetación/urbano.

Limitación: es una clasificación estática derivada de una sola fecha; no modela carga, humedad, altura ni continuidad vertical.

### 2.3 Quemado observado

`burn_100m.bin` codifica tres fechas en bits. La severidad «moderada-baja o más» se deriva de dNBR. No es un perímetro oficial de incidente ni una verdad terreno independiente: es un producto satelital procesado por el propio equipo.

### 2.4 Validación existente (en muestra)

`fire3d.json` declara:

- Cicatriz observada: 868 ha.
- Rumbo observado: 120°.
- Jaccard frente al círculo nulo: 0,131.
- Mejor experimento sin calibrar: Jaccard 0,04 (20:00 UTC), habilidad vs círculo −0,077.
- Calibración en muestra: mejor Jaccard 0,383 con ignición 15:00, giro de viento 60° y multiplicador de velocidad 0,75; razón de área 4,53.
- Mejor con área coherente: Jaccard 0,352 con multiplicador 0,35; razón de área 1,21.
- Ensemble de 24 miembros: acierto 0,742 y falsa alarma 0,821; tras asimilar, acierto 1,0 y falsa alarma 0,895.
- Cámaras: ruido supuesto de 2 px y 0,15°; error mediano de posición 42 m; error de altura de cima 19 m.

Interpretación correcta:

- La calibración es **en muestra**; no es validación independiente.
- El modelo sin calibrar era peor que un círculo de igual área en el conjunto observado.
- El ensemble tras asimilar está ajustado a la misma cicatriz; sus métricas no son predictivas fuera de muestra.
- No hay validación con partes oficiales ni con incendios independientes.

## 3. Referencias externas

Ubicación: `investor-next/public/senda/data/referencias/`.

| Fichero | Tipo | Uso | Estado |
|---|---|---|---|
| `caltrans_corredores.json` | Referencia | Catálogo de corredores, no aforos | UNVERIFIED para calibración |
| `goes_casos.json` | Referencia | Casos GOES documentados, no series ingeridas | UNVERIFIED |
| `referencias.json` | Referencia | Catálogo bibliográfico | UNVERIFIED |
| `tfl_camaras.json`, `tfl_*.jpg` | Referencia | Imágenes de cámaras de tráfico | UNVERIFIED; revisar términos |

Ninguno de estos ficheros se usa como verdad terreno en los tests actuales.

## 4. Datos que faltan (BLOCKED)

- Perímetros oficiales de incendio con hora de ignición y parte de extinción.
- Series temporales de superficie quemada por satélite con control de calidad independiente.
- Trazas reales de contactos DTN (encuentros, duración, throughput, energía).
- Aforos de tráfico y datos de incidentes para calibrar los modelos de tráfico.
- Datos de cobertura y capacidad de antenas para el módulo de comunicaciones.
- Mediciones de campo de ROS, humedad de combustible y viento local.

Sin estos datos, cualquier afirmación de precisión operativa queda `BLOCKED`.

## 5. Controles de integridad

- Hashes SHA-256 calculados y registrados en `docs/research/senda-data-sha256.txt`.
- El manifiesto de release (`scripts/release-manifest.mjs`) incluye el árbol fuente y el lockfile, pero no hashea automáticamente los binarios de datos; la tabla anterior es el control específico.
- Cualquier actualización de datos debe actualizar la tabla y el fichero de hashes en el mismo commit.
- No se deben mezclar datos observados con salidas simuladas en la misma carpeta sin etiqueta.

## 6. Recomendación

Para pasar de `SIMULATED` a `CALIBRATED` se necesita un protocolo de validación fuera de muestra:

1. Congelar parámetros antes de ver el período de validación.
2. Usar al menos dos incendios independientes.
3. Reportar Jaccard, Sorensen, error de área, error de rumbo y habilidad frente al círculo nulo.
4. Publicar intervalos de confianza y todos los intentos, no solo el mejor.
5. Someter el protocolo a revisión externa antes de afirmar capacidad operativa.
