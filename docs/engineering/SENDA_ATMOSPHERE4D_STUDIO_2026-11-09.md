# SENDA Atmosphere 4D — Arquitectura verificable y continuidad

Estado: prototipo ejecutable en PR #27; base PR #26 (que depende de PR #25). Sin despliegue público ni elevación de TRL.

## 1. Entrega implementada

- Backend `apps/senda-live/server/domain/weather-grid.mjs` (Open-Meteo) y `metno-weather-grid.mjs` (MET Norway, predeterminado): predicción de modelo (NO estación) en una cuadrícula fija 3×3 por región. Se consultan 24 pasos horarios y cinco campos: temperatura a 2 m, humedad, precipitación, velocidad y dirección del viento a 10 m. Entradas fijas y validadas, bytes limitados, SHA-256 de la respuesta, TTL de 30 minutos y estado stale/unavailable. API GET `/api/sources/weather-grid?region=valencia|arnhem|veenendaal|madrid`.
- Cliente `Atmosphere4DStudio.tsx`: navegación orbital con ratón/táctil/teclado, zoom, malla 3D de interpolación bilineal, 9 muestras fuente visibles, flechas de viento, escala explícita, selección de variables y recorrido temporal.
- El eje vertical **representa la magnitud de la variable visualizada**; NO terreno, altitud atmosférica, profundidad de agua ni propagación física. Es una superficie *2D+height+time*, no una solución CFD 3D.
- Cliente `weather-snapshot.ts`: guarda únicamente pronósticos públicos en IndexedDB por región; reproducción local tras pérdida del feed. Ningún GPS personal, historial de viaje, cookies de perfil ni datos de identidad se escriben en esta caché.
- PWA `sw.js`: shell y assets propios cacheables, navegación con recuperación offline; los mosaicos OSM no se almacenan en caché sin licencia.
- Ruta Waze de navegación abierta voluntariamente mediante enlace profundo (`https://waze.com/ul?ll=...&navigate=yes`). No se afirma acceso a los reportes de tráfico Waze.

## 2. Procedencia y control científico

| Familia | Estado | Qué significa | Qué no demuestra |
|---|---|---|---|
| Open-Meteo | `MODEL_FORECAST` | Predicción horaria para 9 celdas cercanas | Medición de estación, validación independiente, pronóstico de fuego |
| NASA EONET | `CURATED_EVENT_METADATA` | Incendios catalogados, posición representativa | Perímetro activo y velocidad de avance |
| USGS | `HISTORICAL_OBSERVATION` | Registro sísmico con origen identificado | Alerta temprana sísmica de SENDA |
| Command Surface | `SYNTHETIC_SCENARIO` | Demostración de topologías y enlaces RF | Gateways autorizados físicamente |
| Waze | `DEEPLINK_ONLY` | Apertura explícita de navegación | Feed de congestión, eventos de terceros, ETA interna |

Restricción de validez: la interpolación entre 9 muestras no crea datos de resolución más fina. Es únicamente un proceso gráfico; las muestras deben conservar su origen y coordenadas. La hora de descarga no equivale a la hora de inicialización del modelo. Un snapshot viejo puede ser inspeccionado como historia, no publicarse como predicción vigente.

## 3. Fuentes meteorológicas y derechos reales

**Proveedor predeterminado:** MET Norway Locationforecast 2.0/compact — https://api.met.no/weatherapi/locationforecast/2.0/documentation . La agencia noruega publica datos bajo CC BY 4.0, incluyendo usos comerciales; https://api.met.no/doc/FAQ . Requiere atribución y `User-Agent` identificable. Adaptador: `apps/senda-live/server/domain/metno-weather-grid.mjs`.

- Cada nueva región necesita 9 consultas, tres lotes de tres, con caché en memoria de 3 horas conservadora para pronósticos globales. El proveedor aplica restricciones de uso justo; no repetir capturas entre CI sucesivas. En sistemas multinodo, externalizar la caché a almacenamiento compartido.
- MET Norway publica lluvia en `next_1_hours` y viento en m/s. El adaptador transforma unidades y alinea 24 puntos horarios comunes sin inventar datos cuando faltan campos. Las predicciones son `MODEL_FORECAST` y nunca observaciones de estación.
- Puede modificarse el User-Agent de contacto con `SENDA_METNO_USER_AGENT` si el servidor requiere un dato administrativo adicional. Mantener un contacto real y accesible del proyecto.
- La licencia de MET Norway no garantiza adecuación a decisiones de rescate ni disponibilidad ininterrumpida.

**Proveedor alternativo:** Open-Meteo, cuya API gratuita es exclusivamente no comercial (https://open-meteo.com/en/terms). Para utilizarlo comercialmente, configurar `SENDA_WEATHER_PROVIDER=openmeteo` y `SENDA_OPEN_METEO_COMMERCIAL_KEY`; el servidor usa el endpoint de cliente. Solo en laboratorios estrictamente no comerciales puede activarse `SENDA_WEATHER_RESEARCH_ONLY=1` con `NODE_ENV != production`.

Si ambas fuentes fallan o no hay snapshot válido, el visor muestra indisponibilidad. No se generan campos sintéticos para usuarios. Las pruebas CI sí usan fixtures etiquetados.

## 3.1. Recibo real de proveedor

El script `apps/senda-live/scripts/capture-metno-research.mjs` guarda un resumen fuente/fecha/hash/9 nodos/24 horas, sin copiar información de usuarios. CI solo lo ejecuta cuando un commit incluye `[metno-live-check]` para evitar repetir peticiones al proveedor. Este recibo prueba *acceso y forma del catálogo*, no calibración física de modelos.

## 4. Offline: alcance implementado frente a meta

**Implementado y testeable:** shell React PWA propio, recursos JavaScript y CSS guardados tras conexión inicial, predicciones guardadas en IndexedDB y visualizador 3D sin solicitar nuevas teselas externas. La navegación por región utiliza un cache por región: una región no descargada previamente no funciona offline.

**Pendiente:** verdaderos mosaicos geográficos offline (PMTiles/MBTiles licenciado), DEM local / 3D Tiles, estaciones observadas, metadatos de gateways, integración geográfica global, mapas interiores BIM/IFC. Los modelos de 24 h siguen caducando y hay que indicarlo claramente.

Plan para mapas base offline: pipeline de OSM compatible con ODbL, proveedor de teselas propio o tercero con derecho de descarga, empaquetado por zona, manifiesto SHA-256, cuota de almacenamiento, actualización incremental y prueba de arranque sin Internet. **No** descargar masivamente `tile.openstreetmap.org`.

## 5. Roadmap de renderizado avanzado sin simulaciones engañosas

**R1 — Base cartográfica y elevación auténtica.** Incorporar DEM georreferenciado (COG/quantized mesh/3D Tiles según despliegue), controles LOD, culling, materiales, CRS reproducible, zoom y exportación de terreno. Validar con puntos de control topográficos.

**R2 — Atmosfera 3D real.** Ingerir campos volumétricos con múltiples niveles de presión/altura y tiempos desde un proveedor licenciado; decodificar GRIB2/NetCDF/Zarr a mallas GPU; render de partículas, isosuperficies, campos vectoriales, incertidumbre y timestamp de modelo. Evaluar tiempo, energía, precisión espacial y latencia de render.

**R3 — Incendios.** Importar perímetros históricos (EFFIS/MTBS/NIFC según cobertura y derechos) y series meteorológicas contemporáneas; ejecutar la propagación de SENDA con congelación de tiempo de inferencia y separación TRAIN/TEST por incendio, medir IoU/error frente/skill vs persistencia. Un punto EONET no se usa como perímetro.

**R4 — Sensor & RF overlay.** Crear catálogo de estaciones verificadas con operador, calibración, UTC, lat/lon, permiso de uso, unidad, calidad y transmisión; reflejar conectores `Corridor Fabric` (PR #24) distinguiendo DISCOVERED / OBSERVED / AUTHORIZED / ESTIMATED. Los mapas de cobertura RF deben llevar error y versión del modelo; no equivalen a cobertura medida.

**R5 — Tráfico y rutas.** Integrar DATEX II/NDW y Fintraffic ya evaluados cuando estén disponibles en el producto. Waze for Cities requiere acuerdo de socio para feed de tráfico; el antiguo Transport SDK terminó soporte el 1/11/2026. Usar Deep Links como integración disponible sin partner.

## 6. Telemetría de usuarios: contrato mínimo de privacidad antes de código

- Valor por defecto: **desactivado**. Ninguna lectura de GPS, orientación, sensores, BLE/Wi-Fi, dashcam o histórico en esta entrega.
- Consentimientos separados por categoría, propósito, precisión, retención y destinatario (local, grupo, operador); revocables sin bloquear mensajería básica.
- Ubicación personal precisa bajo permiso del sistema operativo y opt-in adicional en la app; prohibir activación al abrir el mapa por primera vez. Minimizar precisión y plazo de conservación según finalidad.
- La caché pública de predicción nunca debe mezclarse con un almacén de ubicaciones privadas; bases de datos y claves separados.
- Para exportación/sincronización privada: cifrado autenticado AES-256-GCM con nonces únicos, claves no exportables o derivadas de un secreto del usuario, identidad de destinatarios y control de revocación. `HTTPS` por sí solo no equivale a cifrado extremo a extremo.
- El mapa colaborativo deberá agregar información geográfica solo bajo umbrales de privacidad comprobados; no exponer trayectorias individuales por defecto a otros usuarios.
- En modo emergencia, conservar registro auditado de consentimiento, accesos, control de organizaciones, TTL, borrado y evaluación RGPD; no inferir permiso de otros servicios.
- Antes de implementar un sistema real de telemetría: threat model de geolocalización, DPIA, política de retención, pruebas con participantes, flujo de exportación/borrado y revisión especializada.

## 7. Verificación reproducible

```bash
node --test apps/senda-live/tests/weather-grid.test.mjs
corepack pnpm --filter @senda/live test
corepack pnpm --filter @senda/live type-check
corepack pnpm --filter @senda/live build
# GitHub Actions ejecuta QA con Chromium real de escritorio y móvil
```

Pruebas de navegador emplean fixtures de origen CONTROLADOS y validan la interacción, render de canvas y recuperación de caché. No constituyen un ensayo del motor meteorológico en tiempo real, ni miden la precisión física del pronóstico ni la seguridad del dispositivo.

## 8. Dependencias e integración con Antigravity

Para continuar, leer primero `docs/research/SENDA_EONET_USGS_GEOMAP_2026-11-09.md` y este documento. Mantener los PR #25→#26→#27 encadenados hasta resolver sus gates, evitando fusionar sobre master un ensamblaje sin validación global. Comparar cada nuevo motor con los paquetes existentes de SENDA y no introducir un segundo modelo conceptual para los mismos datos.