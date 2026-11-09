# SENDA — Documento de Traspaso de Sesión de Ingeniería (Handoff)

**Fecha y Hora (UTC):** 2026-11-09T03:40:00Z  
**Estado:** Misión COTS Tactical Recon, Radar Biestático Pasivo, Remote ID ASTM F3411, Síntesis de Antenas Caseras (<25€) y Visualización 3D en Estudio GIS 4D completadas con éxito y probadas al 100% en PR #30.

---

## 1. Dónde Retomar la Ejecución

- **Rama Activa:** `feat/senda-master-integration-20261109`
- **Pull Request:** [PR #30](https://github.com/abrahamhl/civic-relay/pull/30) contra `master`
- **Estado de Trabajo:** Árbol limpio, suites de pruebas locales (100% aprobadas: 347 `@senda/core`, 97 `@senda/live`, 16 Python, 10 Investor) y paridad web verificada (74 módulos sincronizados).

---

## 2. Decisiones Clave Tomadas en Esta Sesión

1. **Reconocimiento COTS RF & Radar Biestático Pasivo (`cots-rf-tactical.mjs`):**
   - Se implementó el decodificador de mensajes estándar ASTM F3411-22a / ASD-STAN prEN 4709-002 OpenDroneID para receptores COTS de bajo coste (ESP32-S3 en modo promiscuo Wi-Fi NaN y dongles Bluetooth 5 LE Long Range nRF52840).
   - Se extraen y validan determinísticamente los mensajes `BASIC_ID` (número de serie ANSI/CTA-2063, tipo de UAV), `LOCATION_VECTOR` (coordenadas geodésicas en resolución $10^{-7}$, altitud geodésica y AGL, velocidad horizontal/vertical y rumbo) y `SYSTEM` (geolocalización exacta de la estación de control en tierra / GCS del piloto).
   - Se formuló la evaluación de la función de ambigüedad cruzada (Cross-Ambiguity Function - CAF) para Radar Biestático Pasivo (PBR) utilizando iluminadores comerciales no cooperativos (emisoras FM y multiplex DVB-T).
   - Se implementó la cinemática de velocidad radial Doppler biestática $f_d = \frac{2 v_b}{\lambda} \cos(\beta / 2)$ y resolución de alcance biestático $R_{Tx} + R_{Rx} - L = c \cdot \tau$.
   - Se programó la radiogoniometría (DoA) interferométrica por diferencia de fase con detección matemática de ambigüedad espacial por lóbulos de red ($d > 0.55\lambda$).
   - Se sintetizaron analíticamente las guías de corte milimétrico de antenas caseras de bajo coste (<5€): Yagi-Uda 5 elementos (+10.5 dBi a 868 MHz), Doble Bi-Quad (+11.5 dBi a 2.4 GHz), Monopolo 1/4 plano de tierra (433/1090 MHz) y antena helicoidal cuadrifilar (QFH) polarizada circular a derechas (RHCP a 137.5 MHz para satélites meteorológicos NOAA).

2. **Dominio de Drones COTS y Endpoints de API (`cots-drone-recon.mjs` y `apps/senda-live/server/api.mjs`):**
   - Catálogo de componentes comerciales económicos (AliExpress / Amazon COTS) con coste total de estación táctica $<35€$.
   - Cálculo geodésico exacto (fórmula del semiverseno / Haversine y rumbo azimutal) entre el dron en vuelo y la baliza en tierra de su operador clandestino.
   - Endpoints REST añadidos a SENDA LIVE: `GET /api/cots/antennas`, `POST /api/cots/remote-id/decode` y `GET /api/cots/drone-detections`.
   - Pruebas unitarias de servidor en `apps/senda-live/tests/cots-rf.test.mjs` (2/2 aprobadas).

3. **Visualizador GIS 4D WebGL y Modal Interactivo (`Globe4DStudio.tsx`):**
   - Representación en 3D de drones detectados clasificados por color y geometría (Verde para amigos/autorizados, Rojo para drones no autorizados / hostiles, Ámbar para ecos radar PBR).
   - Renderizado de la baliza en tierra del operador / piloto clandestino en su posición real y trazado de línea discontinua de atadura (tether line) en 3D uniendo al dron con su piloto.
   - Modal interactivo con catálogo BOM de AliExpress, dimensiones milimétricas de corte de antenas y laboratorio de decodificación hex de tramas ASTM F3411 en tiempo real.
   - Sincronización y paridad exacta de los 74 módulos del núcleo hacia `investor-next/public/senda/core`.

---

## 3. Próximo Comando o Tarea a Ejecutar

Hacer commit y push de las capacidades COTS RF a `feat/senda-master-integration-20261109`, verificar el estado de GitHub Actions en PR #30 (`gh pr checks 30`) y confirmar el despliegue automático.
