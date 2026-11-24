# SENDA Drive · Arquitectura Países Bajos (datos oficiales abiertos) y Hoja de Ruta I+D para Renderizado AR-HUD 3D + BEV (2026-11)

> Documento técnico de investigación y desarrollo con fuentes primarias verificadas (`CLAUDE.md` §1 · 0 € gasto nuevo).

---

## 1. Matriz honesta: qué alerta Waze frente a qué cubre SENDA hoy (0 €, ES + NL)

| Tipo de alerta en carretera | Waze | SENDA hoy (`antigravity/conducir-calibracion-20261124`) | Fuente verificada (0 €) |
|---|---|---|---|
| **Radares fijos (*flitspalen*)** | Sí | **Sí (ES: 1 126 + NL: 288)** con filtro de calzada contraria por rumbo | ES: DGT CC BY 4.0 / SCT / Euskadi · NL: MapAtlas CC BY 4.0 |
| **Radares de tramo (*trajectcontroles*)** | Sí | **Sí (ES: 60 tramos + NL: 55 puntos)** con cálculo exacto `v_media = Δs / Δt` y regla oficial OM `meetcorrectie` | DGT / OM (`om.nl`) / MapAtlas CC BY 4.0 |
| **Cámaras de semáforo (*roodlicht*)** | Sí | **Sí (NL: 501 cámaras con rumbo)** + detector cromático de semáforo en cámara | MapAtlas NL CC BY 4.0 + `drive-ar-hud.mjs` |
| **Accidentes, vehículos parados, obstáculos** | Sí | **Sí (ES: 838 DGT + NL: 319 SRTI en vivo con rumbo `<loc:bearing>` y WGS84 ~11 cm)** | DGT DATEX II v3.7 + NDW `veiligheidsgerelateerde_informatie_srti.xml.gz` (CC0) |
| **Puentes levadizos abiertos (*brugopeningen*)** | Parcial | **Sí (NL: 1 614 horarios oficiales, 200 activos/inminentes precargados)** | NDW `planningsfeed_brugopeningen.xml.gz` (CC0) |
| **Cortes de vía/carril (*afsluitingen*) y obras** | Sí | **Sí (ES: DGT + NL: 250 cortes activos con polilínea WGS84)** | DGT + NDW `tijdelijke_verkeersmaatregelen_afsluitingen.xml.gz` (CC0) |
| **Avisos entre conductores (sin cobertura)** | Solo con Internet | **Sí, sin Internet (BLE 24 B + sonda RTT 16 B CRC-8)** | `hazard-share.mjs` + `ble-link-probe.mjs` |
| **Controles policiales móviles ocultos** | Crowdsourcing | **NO por política legal y cívica (`dgt-infra.mjs` + `drive-radars.mjs`)** | Restricción legal/cívica irrenunciable |

---

## 2. Ecosistema de datos abiertos de Países Bajos (coordenadas de 6 decimales ≈ 11 cm de RESOLUCIÓN del dato; la precisión real del GPS de un móvil es de metros · CC0 / 0 €)

Todos los endpoints siguientes fueron comprobados en directo el 24-11-2026 sin clave de API:

1. **NDW (`https://opendata.ndw.nu/`, CC0 — 19 administraciones neerlandesas)**:
   - `veiligheidsgerelateerde_informatie_srti.xml.gz` (37 KB gz → 319 incidentes SRTI: 256 vehículos parados, 38 accidentes, 25 obstáculos; WGS84 6 decimales ~11 cm + `<loc:bearing>`).
   - `planningsfeed_brugopeningen.xml.gz` (119 KB gz → 1 614 registros de puentes levadizos con ventanas UTC).
   - `tijdelijke_verkeersmaatregelen_afsluitingen.xml.gz` (169 KB gz → 623 cortes temporales con `<loc:posList>`).
   - `Matrixsignaalinformatie.xml.gz` (pórticos luminosos de autopista: *rood kruis* y límites dinámicos 50/70/90/100) y `emissiezones.xml.gz` (zonas de bajas/cero emisiones NL).
   - *Nota de ciclo de vida*: NDW anunció la retirada de DATEX II v2.3 el **9 de febrero de 2027**; nuestro analizador `packages/senda/src/ndw-nl.mjs` ya implementa **DATEX II v3** directamente.
2. **PDOK (`https://api.pdok.nl/`, CC0 — Kadaster / Rijkswaterstaat)**:
   - **BGT OGC API Vector Tiles** (`https://api.pdok.nl/kadaster/bgt/ogc/v1/`, verificado HTTP 200): topografía a escala 1:500–1:5 000 con **precisión de 20 cm** (carriles, bordillos, carriles bici *fietspaden*, canales y edificios de toda Holanda).
   - **NWB (*Nationaal Wegenbestand*)**: todos los hitos hectométricos (*hectometerpalen*) para ubicación exacta de emergencias.
   - **AHN4 (*Actueel Hoogtebestand Nederland*)**: LiDAR aéreo de **0,5 m** (~10 puntos/m²) para pendiente real de la calzada (mejora la proyección monocular 3D en rampas/diques).
3. **Openbaar Ministerie (`om.nl`, reglas oficiales de velocidad)**:
   - `meetcorrectie`: −3 km/h para velocidades ≤ 100 km/h y −3 % por encima de 100 km/h; umbral sancionador desde +4 km/h tras corrección (ej.: límite 80 → multa desde 87 km/h; límite 100 → multa desde 108 km/h).
   - Regla horaria de autopistas NL: 100 km/h de 06:00 a 19:00; 120/130 km/h de 19:00 a 06:00 donde esté señalizado.
   - Expansión anunciada por OM (mayo 2026): de 650 a 1 450 ubicaciones incluyendo *flexflitsers* y *focusflitsers*.

---

## 3. Frontera I+D 2026 para Visión Computacional y Renderizado AR-HUD 3D en el móvil (GitHub + Academia)

### 3.1 Ya integrado y verificado hoy en `drive-ar-hud.mjs` (0 €, sin red, 60 FPS dibujo / 4 Hz IA)
- **Identificación semántica ampliada** (`includeInfra: true`, `maxResults: 12`, `scoreThreshold: 0.35`): vehículos (`car`, `truck`, `bus`), usuarios vulnerables (`person`, `bicycle`, `motorcycle`), ferrocarril (`train`), animales (`dog`, `horse`, `cow`, `sheep`) e infraestructura (`traffic light`, `stop sign`) sin falsas alarmas TTC sobre señales estáticas.
- **Proyección monocular 3D plano-suelo** (`projectToGround3D` / `project3DToScreen`): calcula `Z` (m), `X` (m) y **Time Headway `THW = Z / v` (s)** (métrica Euro NCAP / Mobileye) y proyecta sobre el asfalto una **alfombra 3D perspectiva curvada por guiñada (`κ = a_y / v²`)** coloreada por margen RSS.
- **Clasificadores cromáticos reales sobre `ImageData`**: estado de semáforo (`ROJO / ÁMBAR / VERDE / UNKNOWN`) y detección de luces de freno simétricas (`FRENO`) en vehículos de `TU_CARRIL`.
- **Panel táctico cenital Bird's-Eye View (BEV) en tiempo real** + horizonte artificial IMU.

### 3.2 Siguientes 5 vías de I+D de máximo impacto (arquitectura lista para acoplar sobre la Caja Negra v2)
1. **Profundidad monocular densa en WebGPU (`Depth Anything V2 Small` ONNX)**:
   - Repos verificados: [`fabio-sim/Depth-Anything-ONNX`](https://github.com/fabio-sim/Depth-Anything-ONNX), [`akbartus/DepthAnything-on-Browser`](https://github.com/akbartus/DepthAnything-on-Browser) y [`proxgrewal/vision-studio`](https://github.com/proxgrewal/vision-studio) (ONNX Runtime Web + WebGPU).
   - Valor: elimina la suposición de suelo plano en cuestas, túneles y puentes holandeses; permite generar una **nube de puntos 2,5D / malla de obstáculos libres** en el BEV.
2. **Detector + Segmentación de carril en un pase WebGPU (`YOLO11n-seg` / `RT-DETRv2` / `SegFormer`)**:
   - Repos verificados: [`proxgrewal/vision-studio`](https://github.com/proxgrewal/vision-studio), [`nomi30701/yolo-multi-task-onnxruntime-web`](https://github.com/nomi30701/yolo-multi-task-onnxruntime-web).
   - Valor: sustituye `egoLane: [0.35, 0.65]` por segmentación real de marcas viales (*rijstrookmarkering*) y carriles bici rojos neerlandeses (*fietspaden*), crucial en ciudades como Ámsterdam/Utrecht/Arnhem.
3. **Auto-calibración online de cabeceo/guiñada tipo `openpilot` (`liveCalibration`)**:
   - Referencia verificada: [`commaai/openpilot`](https://github.com/commaai/openpilot) (v0.11, 2026) y [`hypery11/awesome-openpilot`](https://github.com/hypery11/awesome-openpilot) (incluye evaluación offline `alpamayo-op` de NVIDIA Alpamayo 2 Edge sobre trazas reales).
   - Valor: estima automáticamente el punto de fuga `(u_vp, v_vp)` con flujo óptico de los primeros 30 s en recta para calibrar `horizonY` y `pitchDeg` de cada soporte de parabrisas sin intervención manual.
4. **Propuesta I+D (NO hecha, NO medida): posicionamiento decimétrico en Países Bajos con Raw GNSS + PDOK BGT 20 cm**:
   - Android expone `GnssMeasurement` (pseudorangos y fase portadora dual-frecuencia L1/L5 en Pixel 7+). Combinando correcciones RTCM/SSR (Galileo HAS gratuito vía satélite en el espacio o NETPOS) con **map-matching sobre carriles PDOK BGT (20 cm)** se resuelve incluso **en qué carril concreto** circula el coche.
5. **Renderizado híbrido WebGL2 / WebGPU con terreno AHN4 + BGT 3D en el HUD**:
   - Proyectar edificios 3D BAG + puentes NDW + pórticos `Matrixsignaalinformatie` en perspectiva AR directamente sobre el horizonte de la cámara (navegación estilo avión / visión sintética SVS cuando hay niebla densa en Holanda).
