# Frontera en física, telecomunicaciones, V2X y fuentes abiertas (OSINT / EO / GEO) para SENDA (2026-11-24)

Documento de investigación aplicada con fuentes primarias verificadas a 24 de noviembre de 2026 (`CLAUDE.md` §1: cero cifras sin fuente, licencias comprobadas, separación explícita entre lo que funciona hoy en un móvil comercial y lo que exige hardware o convenios futuros).

---

## 1. Avances verificados en telecomunicaciones, sensado RF y física vehicular (2024–2026)

### 1.1 Bluetooth 6.0 Channel Sounding (sept. 2024) + corrección IMU (sept. 2026)
- **Fuente primaria**: Bluetooth SIG, *Bluetooth® Channel Sounding Technical Overview* (`https://www.bluetooth.com/channel-sounding-tech-overview/`, Core Spec 6.0, sept. 2024) y estudio en hardware comercial con IMU, *IMU-Aided Correction of Orientation-Induced Ranging Error* (`https://arxiv.org/html/2609.00650v1`, sept. 2026).
- **Física implementada en [`drive-physics-v2.mjs`](../../packages/senda/src/drive-physics-v2.mjs)**:
  - **PBR (Phase-Based Ranging)**: $\hat{d}_{\text{PBR}} = \frac{c}{4\pi}\frac{\Delta\phi}{\Delta f}$, con distancia de ambigüedad $d_{\text{amb}} = \frac{c}{2\Delta f} \approx 149{,}9\text{ m}$ a $\Delta f = 1\text{ MHz}$.
  - **PBR + RTT**: el tiempo de ida y vuelta elimina la ambigüedad de fase más allá de ~150 m y protege frente a ataques de relé.
  - **Avance 2026 (`arXiv:2609.00650v1`)**: la orientación del dispositivo degrada el alcance BLE CS; corregir con la IMU de 6 ejes redujo el MAE un **74,6 %** en validación *Leave-One-Orientation-Out* sobre EFR32xG24.
- **Límite real hoy**: los móviles Android/WebView actuales sin chip/API BT 6.0 CS no exponen PBR crudo al navegador. Hoy SENDA opera con anuncios/buzón GATT BLE (`BleMailbox`, `hazard-share.mjs`); la fórmula queda lista en el núcleo para hardware BT 6.0+.

### 1.2 IEEE 802.11bf-2025 (WLAN Sensing / ISAC)
- **Fuente primaria**: IEEE SA, *IEEE 802.11bf-2025* (aprobado mayo 2025, publicado 26 sept. 2025, `https://standards.ieee.org/ieee/802.11bf/11574/` y `https://www.ieee802.org/11/`).
- **Qué aporta**: estandariza el sensado Wi-Fi basado en CSI (sub-7 GHz y 60 GHz) para detección de movimiento, presencia y distancia (ISAC: *Integrated Sensing and Communications*).
- **Límite real hoy**: ningún navegador ni Android comercial sin firmware modificado expone tramas CSI 802.11bf a aplicaciones de usuario; **no** permite convertir un móvil de serie en un radar de carretera de 77 GHz para medir rebotes sobre coches ajenos.

### 1.3 3GPP Release 18 (5G-Advanced) y Release 19 (NTN + Sidelink V2X)
- **Fuente primaria**: 3GPP Rel-18 congelada funcionalmente en junio 2024 (ASN.1 dic. 2024), primeros chipsets comerciales 2025–2026 (`https://www.5g6gacademy.com/learn/5g-advanced-rel18`, *3GPP Release-18 Physical Layer Enhancements for IoT-NTN*, ResearchGate `383803100`).
- **Qué aporta a SENDA**:
  - **IoT-NTN Rel-18**: desactivación opcional de HARQ para evitar bloqueos por latencia orbital y mantenimiento de sincronización de subida aunque el GNSS pierda señal temporalmente.
  - **L2 UE-to-Network Sidelink Relay (multi-path direct+indirect)**: un móvil fuera de cobertura puede usar otro móvil como relé de capa 2 (el mismo principio que SENDA implementa hoy en capa de aplicación sin esperar al operador).

### 1.4 Propagación V2V de dos rayos sobre suelo y ventana real de contacto en autopista
- **Fuente primaria**: modelo *Two-Ray Ground Reflection* ($d_c = 4\pi h_t h_r / \lambda$, transición de $1/d^2$ a $1/d^4 = 40\text{ dB/década}$) y tiempo de coherencia Doppler $T_c \approx 0{,}423 / f_D$, $f_D = v_{\text{rel}}/\lambda$ (implementado en [`drive-physics-v2.mjs`](../../packages/senda/src/drive-physics-v2.mjs)).
- **Resultado físico directo para SENDA Drive**: a 2,44 GHz (BLE) con móviles a 1,2 m de altura, $d_c \approx 147\text{ m}$. Si dos coches se cruzan a 120 + 120 km/h ($v_{\text{rel}} = 66{,}7\text{ m/s}$), el desplazamiento Doppler es **534 Hz** ($T_c \approx 0{,}79\text{ ms}$) y para un alcance efectivo BLE de 40 m la ventana total de contacto es de apenas **1,20 s**. Esto demuestra matemáticamente por qué los avisos de carretera de SENDA deben viajar en tramas ultracortas de **24 bytes** (`road-guard.mjs` / `hazard-share.mjs`) y por qué la caja negra necesita medir el alcance real en carretera.

### 1.5 Seguridad formal vehicular: RSS (Shalev-Shwartz 2017 / IEEE Std 2846-2022)
- **Fuente primaria**: S. Shalev-Shwartz, S. Shammah, A. Shashua, *On a Formal Model of Safe and Scalable Self-driving Cars*, `https://arxiv.org/abs/1708.06374`; estándar IEEE 2846-2022 y extensiones 2026 (MDPI `2032-6653/17/1/24`).
- **Implementación en [`drive-physics-v2.mjs`](../../packages/senda/src/drive-physics-v2.mjs)**: distancia longitudinal segura en el mismo sentido (Def. 1 / Lema 2) y en sentido contrario (Def. 2, clave en vías convencionales españolas donde ocurre el 72 % de la mortalidad, DGT 2024). En cumplimiento estricto de `CLAUDE.md`, **no** fija valores por defecto ocultos: exige declarar $\rho, a_{\max,\text{accel}}, a_{\min,\text{brake}}, a_{\max,\text{brake}}$.

---

## 2. Catálogo verificado de fuentes abiertas (GEO / EO / OSINT / Mapas / Malla)

| Plataforma / Repo | Qué aporta a SENDA | Frecuencia / Resolución | Licencia / Restricción comprobada | Integración recomendada |
|---|---|---|---|---|
| **EUMETSAT MTG-I1 / MTG-I2 / MTG-S1** (`data.eumetsat.int`, `lsa-saf.eumetsat.int`) | Satélite geoestacionario europeo (0°): **FCI** 1–2 km cada **10 min** (bandas fuego 3,8 / 10,5 µm), **Lightning Imager (LI)** a 1 000 Hz (>70 % FDE), sondeo 3D atmosférico MTG-S1 (comisionado oct. 2026) | Disco completo cada 10 min; rayos en tiempo casi real | Datos abiertos EUMETSAT / Copernicus (registro gratuito en Data Store) | Incendios + tormentas severas/DANA en `/senda/fuego` y `/senda/agua` |
| **Protomaps / PMTiles v3** (`github.com/protomaps/pmtiles`) | Mapa vectorial OpenStreetMap completo en **un solo archivo** leído por rangos HTTP o local, compatible nativamente con **MapLibre GL JS** (ya en `/senda/conducir`) | Extracto regional offline (España/provincia) | Código **BSD-3-Clause**, especificación **CC0 / dominio público**, datos **ODbL** (OSM) | **Prioridad 1** para dar mapa vectorial real 100 % sin red al APK `base` |
| **DGT NAP (`nap.dgt.es`) y `Radares Anunciados` (`datos.gob.es`, nov. 2026)** | Incidencias DATEX II v3.7, cámaras, paneles, conos conectados, tramos de riesgo motoristas y **radares fijos y de tramo oficialmente anunciados** (DGT 47 tramos + SCT + Euskadi + Navarra + ayuntamientos) | Feed DGT continuo; GeoJSON `Radares Anunciados` cada 6 h | Reutilización pública Ley 37/2007; `Radares Anunciados` código **GPL-3.0**, datos **ODbL 1.0** | Solo posiciones **oficiales publicadas** (aviso legal de velocidad). Detectar radares / controles policiales móviles = **NUNCA** (`dgt-infra.mjs`) |
| **Reticulum Network Stack** (`reticulum.network`, `github.com/markqvist/Reticulum`) | Pila completa de red cifrada sobre LoRa (RNode), Wi-Fi, radio paquete y QR en papel | Enlaces de baja tasa / largo alcance | Licencia abierta (revisar estado de mantenimiento comunitario) | Interoperabilidad futura con pasarelas LoRa de SENDA |
| **Meshtastic / MeshCore / MeshSat** (`github.com/meshtastic`, `github.com/meshsat/meshsat-android`) | Malla LoRa comunitaria + pasarela Android **MeshSat** (Meshtastic + Iridium + APRS + SMS) | Sub-GHz LoRa sin licencia | Open source (GPL/MIT según repo) | Referencia directa para puente Android ↔ radio LoRa externa |
| **BitChat** (`github.com/permissionlesstech/bitchat`) | Mensajería P2P dual BLE mesh + Internet sin servidores | BLE cercano | Open source en GitHub | Referencia para multi-salto BLE sin servidor |
| **ReliefWeb API (OCHA) & GDACS RSS** (`reliefweb.int/help/api`, `gdacs.org`) | Alertas globales de terremotos, tsunamis, ciclones, inundaciones, volcanes y partes humanitarios | Tiempo casi real | Abierto con atribución ONU/OCHA/GDACS | Capa civil global en `/senda/ojo` y `/senda/radar` |
| **ACLED** (`data.humdata.org/organization/acled`) | Eventos geolocalizados de conflicto y protestas (contexto geopolítico/crisis) | Actualización periódica | Uso sujeto a términos/registro ACLED (no redistribuir sin permiso) | Solo análisis contextual con licencia válida, separado de tráfico civil |
| **OpenSky Network** (`opensky-network.org`) | Vectores ADS-B / Mode-S de tráfico aéreo (p. ej. medios aéreos de extinción) | Tiempo real con límite de tasa | **Solo investigación / no comercial** (`opensky-network.org/about/terms-of-use`): uso operativo en producto requiere licencia específica | **NO** conectar en producción comercial sin licencia |

---

## 3. Límites técnicos y legales innegociables (veracidad estricta)

| Petición / Idea | Estado real y verificado | Qué hace SENDA hoy (0 €, legal y real) |
|---|---|---|
| **Comunicación continua bidireccional con Waze y Google Maps** | **Imposible sin convenio / prohibido por ToS**: Waze no tiene API pública bidireccional (solo *Waze for Cities* para organismos); Google Maps prohíbe extraer/cachear sus avisos | Entrega de ruta en 1 toque a Waze y Google Maps (`wazeUrl`, `googleMapsUrl`) + avisos propios SENDA/DGT en `/senda/conducir` |
| **Avisos de radares** | **Fijos/tramo oficiales publicados por DGT/SCT/Euskadi**: **SÍ, 100 % legales** (DGT publica sus coordenadas para navegadores, nota 27-02-2026). **Detectores RF / controles policiales móviles**: **NUNCA** (ilegalidad y regla `dgt-infra.mjs`) | Soporte arquitectónico solo para posiciones oficiales publicadas con atribución y fecha; nunca detección ni controles móviles |
| **«Mandar señal desde el móvil a coches ajenos para medir rebote»** | Un móvil comercial **no** es un radar RF (no expone IQ/CSI crudo en Android/WebView; sondear MACs ajenas falla por aleatorización y vulnera privacidad/RGPD; el sonar acústico cae a <5 m y falla con ruido de carretera) | **Intercambio cooperativo consentido SENDA ↔ SENDA** vía BLE GATT (`hazard-share.mjs`, contadores TX/RX/rechazados) + **mapa pasivo de zonas sin cobertura** + ecuaciones BT 6.0 CS listas para hardware futuro |
| **Caja negra de vuelo para el viaje a casa sin destrozar la batería** | **100 % REAL E IMPLEMENTADA HOY** en [`drive-blackbox.mjs`](../../packages/senda/src/drive-blackbox.mjs) y `/senda/conducir` | Grabación circular 1 Hz (< 2 MB RAM), cadena **SHA-256**, cinemática planar ($a_x, a_y, g$, radio de curva), SSD AASHTO, resumen ADAS (sin vídeo ni caras), zonas sin red, medición real de drenaje de batería (%/h) y recorte automático de IA 4 Hz → 2 Hz si batería < 25 % |
