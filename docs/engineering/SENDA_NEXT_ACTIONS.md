# SENDA — Plan de Acción Inmediato y Hoja de Ruta Ejecutiva

**Fecha de Actualización:** 2026-11-09T03:40:00Z  
**Estado:** Bloques 1 al 10 COMPLETADOS, CONSOLIDADOS Y POTENCIADOS con Física Matemática Avanzada, Ciencia Táctica UAV, Reconocimiento COTS RF (<25€) con Radar Biestático Pasivo (PBR) y Geolocalización de Piloto ASTM F3411, Harness de Defensa Gubernamental y Movilidad DATEX II en [PR #30](https://github.com/abrahamhl/civic-relay/pull/30).

---

## 1. Estado de Tareas por Bloque

- [x] **Bloque 1 (Auditoría e Integración Controlada):**
  - Fusión de PRs #18, #24, #25, #26, #27, #28, #29 y rama GDACS en `feat/senda-master-integration-20261109`.
  - Resolución de conflictos, verificación de paridad web y suites de tests al 100%.
  - Apertura de [PR #30](https://github.com/abrahamhl/civic-relay/pull/30) contra `master`.
- [x] **Bloque 2 (OSINT e Inteligencia Multirriesgo):**
  - Conectores para **Copernicus EMS / EFFIS** y **AEMET / Meteoalarm CAP**.
  - Conector para **DATEX II (CEN/TS 16157)** para NDW (A12 Arnhem-Ede) y DGT 3.0 (España).
  - Motor de Reconciliación Espacio-Temporal con grafo de dependencias upstream y recibos Merkle (`generateReconciliationReceipt`).
- [x] **Bloque 3 (Visualizadores GIS 3D/4D Profesionales):**
  - `Globe4DStudio` con Three.js: Globo WGS84 interactivo, malla 3D Mapzen DEM con relieve $\times 1$ a $\times 6$, viento GPU, trayectorias UAV 3D, drones COTS 3D con línea discontinua a la baliza de su piloto en tierra, elipsoide Fresnel 3D y panel integrado de Física Telecom y Calificación Gubernamental.
- [x] **Bloque 4 (Física Matemática Telecom & Motores Científicos):**
  - Módulo `telecom-mathematical-physics.mjs`:
    - Percolación continua ($\lambda_c = 4.512 / (\pi R^2)$) y detección de transición de fase en mallas fragmentadas.
    - Dinámica epidémica DTN markoviana ($R_0$, percentiles P50/P90/P99 de entrega y probabilidad de extinción).
    - Difracción multi-obstáculo Deygout según ITU-R P.526-15.
    - Atenuación por lluvia según ITU-R P.838-3.
    - Desvanecimiento Nakagami-m y capacidad de canal de Shannon.
    - Cinemática orbital Doppler para satélites LEO y ancho de banda PLL SDR.
- [x] **Bloque 5 (Drones Tácticos, Swarm y Mapeo en Zonas de Conflicto / Sin GPS):**
  - Módulos `uav-tactical-science.mjs` y `uav-tactical-planner.mjs`:
    - Modelo de canal 3D Air-to-Ground (A2G) sigmoide Al-Hourani & ITU-R P.1410 con atenuación clutter por entorno (Suburbano, Urbano, Cañón Urbano / Escombros).
    - Cálculo de ángulo óptimo de elevación $\theta_{\text{opt}}$ y altitud óptima de vuelo $h_{\text{opt}}$ maximizando radio de cobertura terrestre.
    - Conectividad algebraica de enjambre (autovalor de Fiedler $\lambda_2$ de la matriz Laplaciana) con garantía matemática de no-partición de red.
    - Parámetros de fotogrametría aérea: Ground Sampling Distance (GSD), solape longitudinal ($p_f \ge 75\%$) y transversal ($p_s \ge 65\%$) para reconstrucción 3D Structure-from-Motion (SfM).
    - Margen de protección y ganancia de procesamiento DSSS/FHSS frente a guerra electrónica / jamming táctico ($J/S$).
    - Planificador de misiones boustrophedon con exportación en estándares **QGroundControl / PX4 `.plan`** y **GeoJSON**.
    - Endpoints de API REST `/api/uav/tactical-plan`, `/api/uav/camera-presets` y `/api/uav/swarm-evaluation`.
- [x] **Bloque 6 (Reconocimiento COTS RF, Detección de Drones Hostiles y Radar Biestático Pasivo):**
  - Módulos `cots-rf-tactical.mjs` y `cots-drone-recon.mjs`:
    - Decodificador ASTM F3411-22a / ASD-STAN prEN 4709-002 OpenDroneID para hardware de bajo coste (ESP32 sniffer en modo promiscuo y BLE nRF52840).
    - Extracción y correlación de identificadores (ANSI/CTA-2063), telemetría de vuelo (altitud, velocidad, rumbo) y posición exacta de la estación del piloto/GCS (`SYSTEM_OPERATOR_LOCATION`).
    - Cross-Ambiguity Function (CAF) para Radar Biestático Pasivo (PBR) con iluminadores de oportunidad comerciales (FM / DVB-T), cálculo de retardo biestático y velocidad radial Doppler.
    - Radiogoniometría (DoA) interferométrica por diferencia de fase con detección de ambigüedad espacial (lóbulos de difracción de rejilla para $d > 0.55\lambda$).
    - Síntesis de ingeniería y guías de corte milimétrico de antenas caseras de coste mínimo (<5€ en hilo de cobre y conectores): Yagi-Uda 5 elementos (+10.5 dBi a 868 MHz), Doble Bi-Quad (+11.5 dBi a 2.4 GHz), QFH polarizada circular a derechas (RHCP para satélites meteorológicos NOAA 137.5 MHz) y Monopolo 1/4 plano de tierra (433/1090 MHz).
    - Endpoints de API `/api/cots/antennas`, `/api/cots/remote-id/decode` y `/api/cots/drone-detections`.
    - Modal interactivo COTS en el estudio 3D con laboratorio de decodificación hex ASTM y lista de componentes AliExpress.
- [x] **Bloque 7 (Harness de Resiliencia Gubernamental y Defensa):**
  - Módulo `government-resilience-harness.mjs`:
    - Evaluación de los 5 pilares estratégicos (Black-Sky, Capacidad de Evacuación, Agilidad de Espectro, Criptografía Forense y Calibración Empírica).
    - Categorización de cumplimiento (Tier 1 Soberano Defensa/UME, Tier 2 Protección Civil, Tier 3 Municipal).
    - Emisión de certificado criptográfico con sello SHA-256 inmutable.
- [x] **Bloque 8 (Offline, Telemetría y Privacidad):**
  - IndexedDB v2 `cached_sources` con degradación transparente offline (`offlineCached: true`) en el cliente API.
  - Telemetría estrictamente opt-in para sensores del dispositivo.
- [x] **Bloque 9 (SENDA LIVE e Interfaz Premium):**
  - Visualizador `Globe4DStudio` en `MapView.tsx`, protecciones XSS DOM-safe y controles multirriesgo.
- [x] **Bloque 10 (Vídeos, Branding y Materiales para Inversores):**
  - Verificación de 53 archivos audiovisuales M95 con peticiones por rangos HTTP 206 y pistas de subtítulos en ES, EN y NL (`evidence/video/m95/release.json`).

---

## 2. Próximas Acciones Inmediatas

1. **Commit y Push de Capacidades COTS RF y Drone Recon:**
   - Confirmar y subir `cots-rf-tactical.mjs`, `cots-drone-recon.mjs`, tests y componentes 3D a la rama `feat/senda-master-integration-20261109` en PR #30.
2. **Supervisión de CI en GitHub Actions:**
   - Verificar la aprobación de la suite completa de workflows ejecutándose en PR #30.
3. **Presentación Táctica para Cuerpos de Seguridad y Defensa:**
   - Demostración de estación de rastreo de drones de <35€ detectando operadores clandestinos y mapas topográficos en zonas denegadas de GNSS.
