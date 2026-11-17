# ADR-GIS-ENGINE: Evaluación y Selección del Motor GIS 4D para Terminales Móviles de Emergencia

- **Estado:** ACEPTADO
- **Fecha:** 10 de noviembre de 2026
- **Autor:** SENDA Engineering Corps (CTO / Especialista GIS 4D & Móvil)
- **Alcance:** Visualización geoespacial, gemelo digital 4D, mapas tácticos de protección civil y soporte 100 % offline.

---

## 1. Contexto y Requisitos Operativos

SENDA requiere una superficie de visualización cartográfica y táctica capaz de operar en teléfonos inteligentes de dotación estándar y terminales de voluntarios/ciudadanos (Android de gama de entrada y media, 3–4 GB RAM, GPUs Mali-G52/G57 o Adreno 610) bajo apagón total de telecomunicaciones.

### Requisitos Innegociables
1. **Operación 100 % Fuera de Línea:** Capacidad de almacenar y renderizar cartografía base y capas dinámicas (inundaciones, incendios, tracks GPS, balizas OEP) desde un único archivo contenedor (.pmtiles o .mbtiles) sin conexión a internet ni llamadas a servidores remotos de teselas.
2. **Presupuesto Estricto de Memoria:** El motor cartográfico no debe exceder 120 MB de heap JavaScript en WebView; terminales con 3 GB de RAM sufren Low-Memory Killer (OOM) si el navegador consume > 250 MB.
3. **Fluidez Táctil:** Mantenimiento de ≥ 30 FPS estables (preferible 60 FPS) durante paneo, zoom y rotación oblicua con elevación de terreno (DEM).
4. **Licencia Libre y Autonomía Soberana:** Prohibición de dependencias obligatorias hacia servicios en la nube (SaaS como Cesium ion o Mapbox token); código bajo licencias permisivas (BSD / MIT / Apache 2.0).
5. **Fallback 2D Determinista:** Si el dispositivo carece de WebGL 2.0 o experimenta pérdida de contexto GPU (`webglcontextlost`), el sistema debe degradar automáticamente a un renderizador plano 2D sin colapsar.

---

## 2. Opciones Evaluadas

### Candidato A: MapLibre GL JS (v4.7.1) + deck.gl (v9.0)
- **Arquitectura:** Renderizador WebGL 2.0 vectorial nativo para teselas MVT/PMTiles, complementado con capas de instanciado GPU de deck.gl para visualización masiva de puntos y perímetros.
- **Licencia:** MapLibre (BSD 3-Clause), deck.gl (MIT). 100 % libre y soberano.

### Candidato B: CesiumJS (v1.122)
- **Arquitectura:** Globo virtual 3D geocéntrico completo (WGS84 ECEF) especializado en fotogrametría 3D Tiles y mecánica orbital espacial.
- **Licencia:** Apache 2.0 (núcleo), pero fuertemente acoplado en documentación y flujos estándar al ecosistema comercial Cesium ion.

---

## 3. Matriz Comparativa y Mediciones de Rendimiento

Pruebas ejecutadas en entorno controlado:
- **Dispositivo de Referencia:** Xiaomi Redmi Note 11 (Qualcomm Snapdragon 680, GPU Adreno 610, 4 GB LPDDR4X RAM, Android 13, Chromium WebView 128).
- **Carga de Prueba:** Malla de elevación DEM (resolución 30 m), teselas vectoriales de la Comunidad Valenciana (zoom 8–14, 185 MB PMTiles), 2.500 balizas OEP dinámicas y 3 polígonos de alerta Copernicus EMS.

| Criterio | MapLibre GL JS + deck.gl | CesiumJS | Impacto en Emergencias |
|---|:---:|:---:|---|
| **Tamaño del Bundle JS (gzip)** | **248 KB** (MapLibre) + **115 KB** (deck.gl subconjunto) = **363 KB** | **3.850 KB** (3,85 MB minificado/gzip) | **CesiumJS es ×10.6 más pesado**. En redes 2G o carga inicial offline satura el almacenamiento y tarda 4,2 s en parsear JS. |
| **Tiempo de Inicialización (Cold Boot)** | **310 ms** | **2.450 ms** | MapLibre arranca en menos de un tercio de segundo. |
| **Consumo de Memoria Heap (Reposo)** | **42 MB** | **185 MB** | CesiumJS triplica el consumo base debido a su matriz geocéntrica y estructura de grafo de escena. |
| **Consumo Heap (Con DEM + 2.5k balizas)** | **88 MB** | **265 MB** (Riesgo crítico de OOM) | CesiumJS roza el límite de corte del WebView en teléfonos de 3/4 GB. |
| **Tasa de Refresco (FPS en Paneo 3D)** | **48 – 58 FPS** | **18 – 27 FPS** (Caídas perceptibles de frames) | MapLibre optimiza el culling y tessellation vectorial en GPU móvil de gama media. |
| **Almacenamiento Offline** | **Excelente (PMTiles v3)**: archivo único, rangos HTTP 206 locales / IndexedDB. | **Complejo**: requiere servidor local de teselas 3D Tiles o empaquetado custom de glTF/quantized-mesh. | PMTiles permite cargar un mapa regional completo de 200 MB en una tarjeta MicroSD o almacenamiento interno. |
| **Terreno y Elevación (3D DEM)** | Formatos estándar Terrain-RGB / Terrarium (PNG codificado). Exageración vertical configurable. | Quantized-mesh nativo de alta precisión, pero pesado de transformar y almacenar offline. | MapLibre es compatible con mallas DEM abiertas del IGN/Copernicus sin conversión propietaria. |
| **Independencia de Proveedor** | **100 % Soberano**: sin tokens, sin telemetría, sin dependencia de Cesium ion. | Requiere desacoplar tokens de Cesium ion manualmente para evitar avisos y caídas en consola. | Requisito clave para convocatorias europeas y soberanía institucional. |
| **Fallback 2D sin WebGL** | Soportado mediante degradación a capas Canvas / SVG de baja resolución. | No soportado nativamente sin WebGL (el motor requiere contexto 3D). | Resiliencia ante GPU crash. |

---

## 4. Decisión Técnica

Se **SELECCIONA MapLibre GL JS + deck.gl** como el motor GIS estándar para la plataforma SENDA (Web, PWA e interfaz embebida de Android).

### Justificación
1. **Viabilidad en Dispositivos Reales:** El bundle de 363 KB y un consumo de 88 MB de RAM garantizan que la aplicación no sufra cierres inesperados por falta de memoria en situaciones de estrés operativo.
2. **Formato PMTiles:** La compatibilidad nativa de MapLibre con PMTiles (vía protocolo `pmtiles://`) permite distribuir paquetes territoriales cerrados sin necesidad de montar un servidor de teselas en el teléfono.
3. **Desacoplamiento Espacial:** Para el seguimiento de órbitas de satélites GNSS o LEO D2C (que CesiumJS resuelve en esfera geocéntrica), SENDA utiliza su propio propagador analítico SGP4/Kepler en WebWorker (`packages/senda/src/orbital.mjs`), proyectando las trazas de suelo directamente en la proyección EPSG:3857/WGS84 de MapLibre con una precisión geométrica < 0.05 km, eliminando la necesidad de cargar la pesada librería CesiumJS.

---

## 5. Arquitectura de Implementación

```
┌────────────────────────────────────────────────────────┐
│             SENDA GIS 4D Architecture                  │
└────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
 [Dispositivo con WebGL 2.0]        [GPU sin soporte / Crash]
       │                                       │
       ▼                                       ▼
┌──────────────────────────────┐     ┌────────────────────────┐
│  MapLibre GL JS (v4.x)       │     │  2D Canvas / Leaflet   │
│  + deck.gl (GeoJson / Grid)  │     │  Fallback Determinado  │
│                              │     │                        │
│  - Terrain: RGB PNG (IGN)    │     │  - Teselas ráster 2D   │
│  - Basemap: PMTiles local    │     │  - Iconografía estática│
│  - Capas: GDACS / CEMS / OEP │     │  - Modo ahorro energía │
└──────────────────────────────┘     └────────────────────────┘
```

### Reglas de Visualización Epistémica (Truth Gate):
- **Terreno:** Exageración vertical fijada en ×1.0 por defecto; solo ampliable a ×1.5 en llanuras con indicación explícita `[ELEVACIÓN EXAGERADA]`.
- **Edificios:** Prohibido inventar volúmenes tridimensionales sintéticos en zonas rurales o de catástrofe salvo que provengan de modelos LiDAR/Catastro oficiales (formato 2.5D de altura documentada).
- **Barra Temporal Única:** Toda capa visualizada debe indicar obligatoriamente en tooltip o metadata su naturaleza temporal:
  - `observation_time` (cuándo el sensor capturó la realidad)
  - `download_time` (cuándo el dispositivo recibió el paquete)
  - `forecast_valid_time` (ventana de validez de modelos meteorológicos/plumas de humo)
