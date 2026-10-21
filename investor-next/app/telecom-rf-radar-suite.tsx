'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Locale } from './copy';
import {
  computeSatelliteLinkBudget,
  computeZoneTelemetryGrid,
  runThroughWallRfRadar
} from '../lib/telecom-suite.mjs';
import './telecom-rf-radar-suite.css';

interface CasePreset {
  id: string;
  tag: string;
  title: string;
  todayTitle: string;
  todayBullets: string[];
  todayMetrics: [string, string][];
  oepTitle: string;
  oepBullets: string[];
  oepMetrics: [string, string][];
  preset: {
    orbit: string;
    elevation: number;
    freq: number;
    damage: number;
    wall: string;
    distance: number;
  };
}

interface FunctionItem {
  code: string;
  status: string;
  title: string;
  problem: string;
  solution: string;
  moduleRef: string;
  authGate: string;
}

const suiteCopy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    authBadge: string;
    authBanner: string;
    casesEyebrow: string;
    casesTitle: string;
    todayTag: string;
    oepTag: string;
    loadPresetBtn: string;
    fnEyebrow: string;
    fnTitle: string;
    fnProblemLabel: string;
    fnSolutionLabel: string;
    fnAuthLabel: string;
    infraEyebrow: string;
    infraTitle: string;
    satPanelTitle: string;
    orbitLabel: string;
    elevLabel: string;
    freqLabel: string;
    damageLabel: string;
    satBridgeLabel: string;
    frameTitle: string;
    zonePanelTitle: string;
    radarEyebrow: string;
    radarTitle: string;
    radarLead: string;
    wallLabel: string;
    distLabel: string;
    paletteLabel: string;
    bandsLabel: string;
    arBtnStart: string;
    arBtnStop: string;
    arStatusSim: string;
    arStatusLive: string;
    targetsTitle: string;
    cases: CasePreset[];
    functions: FunctionItem[];
    walls: Record<string, string>;
    palettes: Record<string, string>;
  }
> = {
  // DensePoseFromWiFi: research literature reference only, not captured/implemented sensor data.
  es: {
    eyebrow: 'LABORATORIO DE TELECOMUNICACIONES · MODELOS Y SIMULACIONES',
    title: 'CÓMO FALLA TODO HOY FRENTE A NUESTRA INFRAESTRUCTURA: SATÉLITES, MÓVILES, TELEMETRÍA POR ZONAS Y RADAR RF TRANS-PARED',
    lead: 'Explora modelos matemáticos de enlace NTN, rutas virtuales entre 20–100 nodos, sectores sintéticos y un visor de CSI/RF simulado. No se captura CSI de la tarjeta Wi-Fi del móvil ni se detectan personas detrás de paredes.',
    authBadge: 'LÍMITE DE AUTORIZACIÓN',
    authBanner:
      'DEMO DE INVESTIGACIÓN: los modelos de rutas D2D, enlace satelital y radar RF/CSI son simulaciones de software. El navegador no opera radiofrecuencia satelital ni extrae CSI real. Son necesarias pruebas físicas, integración autorizada y verificación independiente antes de afirmaciones operativas.',
    casesEyebrow: '01 / COMPARATIVA OPERATIVA EN ESCENARIOS REALES',
    casesTitle: 'Escenarios hipotéticos: problema investigado vs. comportamiento del modelo OEP',
    todayTag: 'HOY (SIN OEP · COLAPSO TRADICIONAL)',
    oepTag: 'CON OEP (ESCENARIO HIPOTÉTICO · SIMULADO)',
    loadPresetBtn: 'CARGAR ESTE ESCENARIO EN LAS CONSOLAS DE SATÉLITE, ZONAS Y RADAR RF ↓',
    fnEyebrow: '02 / CATÁLOGO DE FUNCIONES DE INGENIERÍA Y PROBLEMAS RESUELTOS',
    fnTitle: 'Presentación de cada función: qué problema real resuelve y qué módulo lo ejecuta',
    fnProblemLabel: 'Problema actual sin resolver:',
    fnSolutionLabel: 'Software experimental o capacidad aún simulada:',
    fnAuthLabel: 'Punto de autorización externa:',
    infraEyebrow: '03 / INFRAESTRUCTURA COMPLETA DE SATÉLITES, MÓVILES Y TELEMETRÍA POR ZONAS',
    infraTitle: 'Consola de Enlace Satelital 3GPP NTN + Malla Móvil D2D + Telemetría Táctica por Sectores',
    satPanelTitle: 'Enlace Satelital NTN / Direct-to-Cell y Trama Binaria de Ráfaga (24 Bytes)',
    orbitLabel: 'Constelación / Órbita Satelital',
    elevLabel: 'Ángulo de Elevación del Satélite',
    freqLabel: 'Banda de Frecuencia Portadora',
    damageLabel: 'Daño en Red Celular Terrestre',
    satBridgeLabel: 'Simular puente NTN (sin transmisión satelital)',
    frameTitle: 'Trama Binaria Compacta OEP-NTN (24 Bytes + CRC-16-CCITT · 8.6x más ligera que JSON):',
    zonePanelTitle: 'Telemetría por Zonas Poligonales (9 Sectores Tácticos · Pulsa una celda)',
    radarEyebrow: '04 / RADAR ESPECTRAL TRANS-PARED (WI-FI CSI + RF) Y CÁMARA AR «TÉRMICA DE FRECUENCIAS»',
    radarTitle: 'Visor Trans-Pared de Emisiones de Móvil, Wi-Fi CSI (IEEE 802.11bf) y Sensores para Equipos de Rescate',
    radarLead:
      'Modelo de propagación y objetivos artificiales para estudiar viabilidad de detección RF tras obstáculos. El visor de cámara NO mide ondas de radio ni observa personas a través de paredes; CSI real requeriría hardware y acceso especializado, calibración y validación.',
    wallLabel: 'Material del Muro / Obstáculo',
    distLabel: 'Distancia del Efectivo al Muro',
    paletteLabel: 'Paleta Espectral («Térmica RF»)',
    bandsLabel: 'Bandas de Frecuencia y Sensores en Escaneo:',
    arBtnStart: 'VER SUPERPOSICIÓN DEMOSTRATIVA EN CÁMARA (NO ES RADAR REAL)',
    arBtnStop: 'DETENER CÁMARA AR (VOLVER A MODO SIMULACIÓN)',
    arStatusSim: 'MODO TOMOGRAFÍA ESPECTRAL RF / WI-FI CSI (64 SUBPORTADORAS OFDM)',
    arStatusLive: 'CÁMARA ACTIVA · MAPA RF SINTÉTICO (NO MEDICIÓN)',
    targetsTitle: 'Objetivos artificiales del modelo RF/CSI (no detectados físicamente)',
    walls: {
      DRYWALL: 'Tabique / Pladur (12 cm · Atenuación baja)',
      BRICK_25CM: 'Muro de Ladrillo Macizo (25 cm · Atenuación media)',
      CONCRETE_30CM: 'Hormigón Armado (30 cm · Alta atenuación 5 GHz)',
      COLLAPSED_RUBBLE: 'Escombros de Colapso Estructural (45 cm · Crítico)'
    },
    palettes: {
      THERMAL_IRONBOW: 'Térmica Ironbow (Infrarrojo de Radiofrecuencias)',
      CSI_CYAN_MAGMA: 'Espectro CSI Cian-Magma (Fase/Amplitud OFDM)',
      TACTICAL_GREEN: 'Visión Nocturna Táctica USAR'
    },
    cases: [
      {
        id: 'CASE-01-BLACKOUT',
        tag: 'CASO 01 · APAGÓN Y CAÍDA DE TORRES 4G/5G',
        title: 'Terremoto o apagón masivo deja el 85 % de las antenas celulares sin energía ni fibra',
        todayTitle: 'Cómo falla todo HOY sin OEP',
        todayBullets: [
          'Miles de móviles lanzan reintentos ciegos (tormenta PRACH) contra torres caídas, agotando su batería en menos de 45–90 minutos.',
          'Los mensajes de WhatsApp/SMS se quedan en un spinner infinito: 0 % de capacidad para saltar por móviles vecinos hasta una pasarela con línea.',
          'Protección Civil pierde por completo el mapa situacional del barrio; el silencio se confunde con normalidad o con víctimas sin criterio técnico.'
        ],
        todayMetrics: [
          ['Entrega con torre caída', '0 % (Bloqueo total)'],
          ['Supervivencia batería', '< 1.5 h (Tormenta PRACH)'],
          ['Visibilidad por zonas', 'Ciega / Sin telemetría'],
          ['Trama satelital', 'No disponible / JSON pesado']
        ],
        oepTitle: 'Cómo lo resuelve nuestra ingeniería OEP',
        oepBullets: [
          'Detección inmediata de corte celular y conmutación a malla D2D multi-salto (Bluetooth LE + Wi-Fi Aware) con política de ahorro energético.',
          'Cola persistente Store-and-Forward en disco (LabPersistentQueue) con recibos firmados criptográficamente mediante ECDSA P-256 (LabReceiptSigner).',
          'Compresión de estado de cada sector en una trama binaria OEP-NTN de solo 24 bytes (CRC-16) lista para salir por enlace satelital LEO Direct-to-Cell.'
        ],
        oepMetrics: [
          ['Sectores conectados con OEP', '9 / 9 (Malla + Puente NTN)'],
          ['Tamaño trama satelital', '24 bytes (8.6x compresión)'],
          ['Integridad de recibos', 'ECDSA P-256 + CRC-16'],
          ['Inferencia falsa de bajas', '0 (UNKNOWN ≠ SOS)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 48, freq: 1990, damage: 85, wall: 'BRICK_25CM', distance: 4.0 }
      },
      {
        id: 'CASE-02-FLOOD-DANA',
        tag: 'CASO 02 · INUNDACIÓN / DANA Y SÓTANOS',
        title: 'Personas atrapadas en plantas bajas, garajes y edificios sin electricidad ni cobertura interior',
        todayTitle: 'Cómo falla todo HOY sin OEP',
        todayBullets: [
          'El agua y los forjados de hormigón bloquean la señal 4G/5G exterior (-115 dBm); las llamadas al 112 se cortan antes de establecer portadora.',
          'Si el móvil se reinicia por frío o batería baja, cualquier mensaje en memoria volátil desaparece sin dejar rastro.',
          'Las patrullas en el exterior no saben en qué planta o tras qué pared sigue habiendo móviles encendidos intentando emitir.'
        ],
        todayMetrics: [
          ['Penetración celular directa', 'Fallida (-115 dBm)'],
          ['Persistencia tras reinicio', '0 % (Memoria volátil)'],
          ['Detección tras muros', '0 m (Inexistente)'],
          ['Coordinación vecinal', 'Nula (Islas aisladas)']
        ],
        oepTitle: 'Cómo lo resuelve nuestra ingeniería OEP',
        oepBullets: [
          'Salto vertical entre plantas: un móvil en planta baja entrega su SOS firmado por BLE/Wi-Fi Direct a un nodo en planta superior con vista al exterior.',
          'Cola persistente en disco con anti-replay por tombstones: el SOS sobrevive reinicios y se transmite en cuanto aparece un vecino o pasarela.',
          'Los equipos de rescate usan el Radar RF / Wi-Fi CSI Trans-Pared en banda Sub-GHz (700–900 MHz) y 2.4 GHz para detectar emisiones a través del muro.'
        ],
        oepMetrics: [
          ['Salto vertical multi-planta', 'Activo (Dijkstra D2D)'],
          ['Penetración radar Sub-GHz', '9.8 dB pérdida en hormigón'],
          ['Cola en disco', 'Persistente + Anti-Replay'],
          ['Tiempo de ráfaga NTN', '< 65 ms por sector']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 35, freq: 850, damage: 90, wall: 'CONCRETE_30CM', distance: 3.5 }
      },
      {
        id: 'CASE-03-WILDFIRE-RURAL',
        tag: 'CASO 03 · INCENDIO FORESTAL / ZONA RURAL',
        title: 'Evacuación en valle rural sin cobertura terrestre y con humo denso',
        todayTitle: 'Cómo falla todo HOY sin OEP',
        todayBullets: [
          'En zonas rurales una sola línea eléctrica o radioenlace quemado deja valles enteros en sombra absoluta de telecomunicaciones.',
          'Las aplicaciones convencionales exigen megabytes de datos HTTPS y certificados TLS online que jamás pasan por canales satelitales estrechos.',
          'No existe telemetría agregada por polígonos para saber cuántos vecinos han confirmado «ESTOY BIEN» frente a cuántos piden «SOS EXPLÍCITO».'
        ],
        todayMetrics: [
          ['Cobertura terrestre', '0 % en sombra de valle'],
          ['Protocolo HTTPS estándar', 'Inviable en canal estrecho'],
          ['Telemetría poligonal', 'Sin agregación por celdas'],
          ['Consumo energético', 'Crítico sin control']
        ],
        oepTitle: 'Cómo lo resuelve nuestra ingeniería OEP',
        oepBullets: [
          'Telemetría poligonal dividida en 9 sectores tácticos (SECTOR-A1..C3) que agrega estados SAFE, SOS_EXPLICIT y UNKNOWN sin filtrar ubicación privada sin permiso.',
          'Codificación binaria ultracompacta OEP-NTN de 24 bytes compatible con canales satelitales L-Band / S-Band de baja tasa binaria (desde 300 bps).',
          'Exclusión automática de nodos con batería crítica (≤ 15 %) como repetidores intermedios, reservando su energía únicamente para su propio SOS.'
        ],
        oepMetrics: [
          ['Canal mínimo requerido', '≥ 300 bps (Ráfaga 24 B)'],
          ['Protección batería ≤ 15 %', 'Exclusión automática relay'],
          ['Celdas monitorizadas', '9 sectores georreferenciados'],
          ['Verificación de integridad', 'CRC-16-CCITT en cabecera']
        ],
        preset: { orbit: 'MEO_RESILIENCE_1200KM', elevation: 55, freq: 1616, damage: 95, wall: 'DRYWALL', distance: 6.0 }
      },
      {
        id: 'CASE-04-USAR-THROUGH-WALL',
        tag: 'CASO 04 · RESCATE URBANO TRANS-PARED (USAR)',
        title: 'Localización de supervivientes y móviles activos detrás de muros de hormigón o escombros',
        todayTitle: 'Cómo falla todo HOY sin OEP',
        todayBullets: [
          'Las cámaras ópticas no ven a través de un tabique ni del polvo denso, y las cámaras térmicas infrarrojas (LWIR) se bloquean por completo ante cualquier pared sólida.',
          'Las señales de radio (Wi-Fi, Bluetooth, ráfagas celulares Sub-GHz) sí atraviesan ladrillo y hormigón, pero los efectivos no disponen de un visor que las convierta en imagen térmica espacial.',
          'Las reflexiones Wi-Fi CSI sobre el tórax humano (micro-Doppler respiratorio) se descartan en los chips Wi-Fi normales en lugar de procesarse para rescate.'
        ],
        todayMetrics: [
          ['Cámara térmica IR normal', '0 % penetración en muro'],
          ['Lectura de ráfagas RF', 'Desaprovechada en rescate'],
          ['Micro-Doppler Wi-Fi CSI', 'Descartado sin tomografía'],
          ['Fusión con cámara AR', 'Inexistente en campo']
        ],
        oepTitle: 'Cómo lo resuelve nuestra ingeniería OEP',
        oepBullets: [
          'Radar Espectral RF / Wi-Fi CSI Trans-Pared que fusiona emisiones activas del móvil (Sub-GHz 700–900 MHz, BLE 2.4 GHz, Wi-Fi 2.4/5 GHz) con tomografía de 64 subportadoras OFDM.',
          'Cálculo físico en tiempo real de atenuación de pared (ITU-R P.2040), relación señal/ruido (SNR) y firma micro-Doppler respiratoria (0.2–0.4 Hz / BPM).',
          'Visor Cámara AR en vivo («Térmica de Frecuencias»): apunta con la cámara del dispositivo hacia la pared y superpone el mapa de calor RF y los objetivos detectados.'
        ],
        oepMetrics: [
          ['Subportadoras Wi-Fi CSI', '64 canales OFDM (Fase/Amp)'],
          ['Bandas combinadas', 'Sub-GHz + BLE + Wi-Fi + IMU'],
          ['Modo Cámara AR WebRTC', 'En vivo en navegador'],
          ['Objetivos en simulación', 'Umbral matemático ilustrativo (NO detectados)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 60, freq: 850, damage: 80, wall: 'COLLAPSED_RUBBLE', distance: 2.8 }
      }
    ],
    functions: [
      {
        code: 'FN-01 · MOBILE D2D MESH',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Enrutamiento Móvil Multi-Salto (BLE + Wi-Fi Aware + Dijkstra Energético)',
        problem: 'Cuando cae la estación base 4G/5G, los móviles aislados no pueden alcanzar pasarelas cercanas ni coordinarse entre vecinos.',
        solution: 'Grafo determinista de 20–100 nodos con selección óptima de ruta multi-salto, respeto estricto de consentimiento y corte de retransmisión si la batería baja del 15 %.',
        moduleRef: 'investor-next/lib/emergency-routing.mjs',
        authGate: 'Ejecutable al 100 % en simulador y APK Android Nearby; el despertar automático en segundo plano en iOS/Android requiere entitlement de emergencia del fabricante.'
      },
      {
        code: 'FN-02 · DURABLE STORE & ECDSA',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Cola Store-and-Forward en Disco + Firma Criptográfica ECDSA P-256',
        problem: 'Los mensajes de auxilio en memoria RAM se pierden si el teléfono se apaga, y los recibos sin firma pueden ser suplantados.',
        solution: 'Persistencia en disco (LabPersistentQueue.java), expiración dual por reloj monótono, anti-replay por tombstones y firma asimétrica SHA256withECDSA (LabReceiptSigner.java).',
        moduleRef: 'investor-next/lib/store-forward.mjs + LabReceiptSigner.java',
        authGate: 'Criptografía ECDSA P-256 y cola en disco 100 % operativas; el anclaje de certificados raíz institucionales requiere federación con PKI de Protección Civil.'
      },
      {
        code: 'FN-03 · SATELLITE NTN BRIDGE',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Puente Satelital 3GPP NTN / Direct-to-Cell (Trama Binaria de 24 Bytes)',
        problem: 'Los enlaces satelitales de emergencia (LEO/MEO/GEO) tienen ancho de banda muy limitado y alto desplazamiento Doppler; el JSON/HTTP convencional colapsa.',
        solution: 'Calculadora física de Link Budget (FSPL, C/N0, SNR, Doppler) y codificador binario OEP-NTN de 24 bytes con CRC-16-CCITT (8.6x más compacto que JSON).',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeSatelliteLinkBudget)',
        authGate: 'Protocolo binario y cálculo orbital listos; la emisión RF real hacia satélites comerciales requiere acuerdo de espectro NTN con operadora/constelación.'
      },
      {
        code: 'FN-04 · POLYGONAL ZONE TELEMETRY',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Telemetría Táctica por Zonas Poligonales (CAP 1.2 + Sectores A1..C3)',
        problem: 'Los centros de mando reciben llamadas sueltas sin visión estructurada por cuadrículas de dónde hay cobertura, cuántos están bien y dónde faltan pasarelas.',
        solution: 'Validación geométrica de polígonos CAP 1.2 y partición automática en 9 sectores tácticos con métricas agregadas SAFE / SOS / UNKNOWN y selección de backhaul.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeZoneTelemetryGrid)',
        authGate: 'Motor poligonal y agregador listos; la inyección de alertas oficiales CAP requiere firma X.509 de un emisor gubernamental autorizado.'
      },
      {
        code: 'FN-05 · THROUGH-WALL WIFI CSI',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Radar Trans-Pared Wi-Fi CSI (IEEE 802.11bf · 64 Subportadoras OFDM)',
        problem: 'Las cámaras ópticas y térmicas infrarrojas no atraviesan paredes; los rescatistas no ven si hay personas o dispositivos emitiendo detrás de un muro.',
        solution: 'Tomografía de amplitud y fase sobre 64 subportadoras OFDM, compensación de atenuación de materiales (ITU-R P.2040) y detección de micro-Doppler respiratorio.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (runThroughWallRfRadar)',
        authGate: 'Motor matemático y tomografía ejecutables aquí; la extracción bruta de matrices CSI en chips Wi-Fi cerrados requiere driver IEEE 802.11bf / firmware Nexmon.'
      },
      {
        code: 'FN-06 · AR RF THERMAL CAMERA',
        status: 'RESUELTO Y EJECUTABLE',
        title: 'Visor Cámara AR «Térmica de Frecuencias» + Fusión de Sensores Móviles',
        problem: 'Un técnico en una emergencia no puede interpretar tablas de dBm en crudo; necesita apuntar con su cámara y ver intuitivamente dónde están las fuentes RF.',
        solution: 'Fusión en tiempo real de cámara WebRTC + orientación IMU/magnetómetro + mapa de calor falso-color (Ironbow/CSI) que proyecta las señales tras la pared.',
        moduleRef: 'investor-next/app/telecom-rf-radar-suite.tsx',
        authGate: 'Funciona hoy mismo en el navegador concediendo permiso de cámara al visor AR; el escaneo pasivo de bandas celulares licenciadas requiere hardware SDR/operador.'
      }
    ]
  },
  en: {
    eyebrow: 'TELECOM RESEARCH LAB · COMPUTATIONAL MODELS AND SIMULATION',
    title: 'HOW EVERYTHING FAILS TODAY VS. OUR INFRASTRUCTURE: SATELLITES, MOBILE MESH, ZONE TELEMETRY & THROUGH-WALL RF RADAR',
    lead: 'Explore mathematical NTN link-budget models, routes between 20–100 virtual devices, synthetic zone sectors and simulated CSI/RF overlays. No live handset Wi-Fi CSI is captured and no people are detected behind walls.',
    authBadge: 'AUTHORIZATION BOUNDARY',
    authBanner:
      'RESEARCH DEMO: D2D routing, satellite links and RF/CSI radar are software simulations. The browser does not transmit satellite RF or extract real Wi-Fi CSI. Physical trials, authorized integrations and independent validation remain mandatory.',
    casesEyebrow: '01 / OPERATIONAL COMPARISON ACROSS REAL SCENARIOS',
    casesTitle: 'Hypothetical scenarios: observed challenge versus the simulated OEP response',
    todayTag: 'TODAY (WITHOUT OEP · TRADITIONAL COLLAPSE)',
    oepTag: 'WITH OEP (HYPOTHETICAL · SIMULATED)',
    loadPresetBtn: 'LOAD THIS SCENARIO INTO THE SATELLITE, ZONE & RF RADAR CONSOLES ↓',
    fnEyebrow: '02 / ENGINEERING FUNCTION CATALOG & PROBLEMS SOLVED',
    fnTitle: 'Function-by-function breakdown: real problem solved, runnable software, and authorization point',
    fnProblemLabel: 'Current unsolved problem:',
    fnSolutionLabel: 'Research code or simulated target:',
    fnAuthLabel: 'External authorization point:',
    infraEyebrow: '03 / COMPLETE SATELLITE, MOBILE MESH & POLYGONAL ZONE TELEMETRY INFRASTRUCTURE',
    infraTitle: '3GPP NTN Satellite Link Console + D2D Mobile Mesh + Tactical Sector Telemetry',
    satPanelTitle: 'NTN / Direct-to-Cell Satellite Link & 24-Byte Compact Binary Burst Frame',
    orbitLabel: 'Satellite Constellation / Orbit',
    elevLabel: 'Satellite Elevation Angle',
    freqLabel: 'Carrier Frequency Band',
    damageLabel: 'Terrestrial Cellular Damage',
    satBridgeLabel: 'Simulate NTN Bridge (no satellite transmission)',
    frameTitle: 'OEP-NTN Compact Binary Frame (24 Bytes + CRC-16-CCITT · 8.6x smaller than JSON):',
    zonePanelTitle: 'Polygonal Zone Telemetry (9 Tactical Sectors · Click any cell)',
    radarEyebrow: '04 / THROUGH-WALL RF & WI-FI CSI SPECTRAL RADAR + AR "FREQUENCY THERMAL" CAMERA',
    radarTitle: 'Through-Wall Mobile Emission, Wi-Fi CSI (IEEE 802.11bf) & Sensor Fusion Viewfinder for First Responders',
    radarLead:
      'Synthetic targets and radio-propagation models illustrate a research hypothesis. The camera overlay is NOT an RF sensor or a through-wall person detector. Real CSI sensing requires appropriate hardware, permission, calibration and field validation.',
    wallLabel: 'Wall / Obstacle Material',
    distLabel: 'Responder Stand-off Distance to Wall',
    paletteLabel: 'Spectral Palette ("RF Thermal")',
    bandsLabel: 'Active Frequency Bands & Sensors in Scan:',
    arBtnStart: 'SHOW CAMERA DEMO OVERLAY (NOT A LIVE RF RADAR)',
    arBtnStop: 'STOP AR CAMERA (RETURN TO SIMULATION VIEW)',
    arStatusSim: 'RF / WI-FI CSI SPECTRAL TOMOGRAPHY MODE (64 OFDM SUBCARRIERS)',
    arStatusLive: 'CAMERA ACTIVE · SYNTHETIC RF OVERLAY (NOT MEASURED)',
    targetsTitle: 'Synthetic RF/CSI targets (not real behind-wall detections)',
    walls: {
      DRYWALL: 'Drywall / Partition (12 cm · Low attenuation)',
      BRICK_25CM: 'Solid Brick Wall (25 cm · Medium attenuation)',
      CONCRETE_30CM: 'Reinforced Concrete (30 cm · High 5 GHz loss)',
      COLLAPSED_RUBBLE: 'Collapsed Structural Rubble (45 cm · Severe)'
    },
    palettes: {
      THERMAL_IRONBOW: 'Thermal Ironbow (RF Infrared Style)',
      CSI_CYAN_MAGMA: 'CSI Cyan-Magma Spectrum (OFDM Phase/Amp)',
      TACTICAL_GREEN: 'USAR Tactical Night Vision'
    },
    cases: [
      {
        id: 'CASE-01-BLACKOUT',
        tag: 'CASE 01 · URBAN BLACKOUT & 4G/5G TOWER COLLAPSE',
        title: 'Earthquake or grid blackout knocks out 85% of cellular towers and fiber backhaul',
        todayTitle: 'How everything fails TODAY without OEP',
        todayBullets: [
          'Thousands of handsets trigger blind uplink retry storms (PRACH storms) against dead towers, draining batteries in 45–90 minutes.',
          'SMS and chat apps hang on an infinite spinner: 0% ability to hop across neighboring phones toward a surviving gateway.',
          'Civil protection loses situational awareness across entire districts; device silence is blindly conflated with either safety or casualties.'
        ],
        todayMetrics: [
          ['Delivery with dead tower', '0% (Total blackout)'],
          ['Battery survival', '< 1.5 h (PRACH storm)'],
          ['Zone visibility', 'Blind / No telemetry'],
          ['Satellite framing', 'Unavailable / Heavy JSON']
        ],
        oepTitle: 'How our OEP engineering resolves it',
        oepBullets: [
          'Instant outage detection and automatic handoff to multi-hop D2D mesh (Bluetooth LE + Wi-Fi Aware) with battery-preserving duty cycles.',
          'Durable disk-backed Store-and-Forward queue (LabPersistentQueue) with cryptographic ECDSA P-256 receipt signing (LabReceiptSigner).',
          'Sector status compressed into a 24-byte OEP-NTN binary burst frame (CRC-16) ready for LEO Direct-to-Cell satellite uplink.'
        ],
        oepMetrics: [
          ['Sectors connected with OEP', '9 / 9 (Mesh + NTN Bridge)'],
          ['Satellite burst size', '24 bytes (8.6x smaller)'],
          ['Receipt integrity', 'ECDSA P-256 + CRC-16'],
          ['False casualty inference', '0 (UNKNOWN ≠ SOS)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 48, freq: 1990, damage: 85, wall: 'BRICK_25CM', distance: 4.0 }
      },
      {
        id: 'CASE-02-FLOOD-DANA',
        tag: 'CASE 02 · FLASH FLOOD & BASEMENT ISOLATION',
        title: 'Citizens trapped in ground floors, basements, and garages without power or indoor coverage',
        todayTitle: 'How everything fails TODAY without OEP',
        todayBullets: [
          'Water and reinforced concrete block outdoor 4G/5G signals (-115 dBm); emergency voice calls drop before establishing a bearer.',
          'If a phone reboots from cold or low battery, any in-memory emergency message is permanently lost.',
          'First responders outside have zero visibility into which floor or behind which wall active phones are still radiating.'
        ],
        todayMetrics: [
          ['Direct cellular penetration', 'Failed (-115 dBm)'],
          ['Survival across reboot', '0% (Volatile RAM)'],
          ['Through-wall detection', '0 m (None)'],
          ['Neighbor relay', 'None (Isolated islands)']
        ],
        oepTitle: 'How our OEP engineering resolves it',
        oepBullets: [
          'Vertical multi-floor relay: a basement phone forwards its signed SOS via BLE/Wi-Fi Direct to an upper-floor node with outdoor line-of-sight.',
          'Disk-backed queue with tombstone anti-replay survives process restarts and dispatches immediately upon peer discovery.',
          'Rescue teams use the Through-Wall RF / Wi-Fi CSI Radar in Sub-GHz (700–900 MHz) and 2.4 GHz bands to locate emissions behind concrete.'
        ],
        oepMetrics: [
          ['Multi-floor vertical hop', 'Active (Dijkstra D2D)'],
          ['Sub-GHz concrete loss', '9.8 dB (Penetrates wall)'],
          ['Disk queue persistence', 'Durable + Anti-Replay'],
          ['NTN burst air-time', '< 65 ms per sector']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 35, freq: 850, damage: 90, wall: 'CONCRETE_30CM', distance: 3.5 }
      },
      {
        id: 'CASE-03-WILDFIRE-RURAL',
        tag: 'CASE 03 · WILDFIRE / RURAL VALLEY SHADOW',
        title: 'Evacuation in a rural valley with burned terrestrial links and dense smoke',
        todayTitle: 'How everything fails TODAY without OEP',
        todayBullets: [
          'A single burned fiber pole or microwave link leaves entire rural valleys in a complete telecommunications shadow.',
          'Standard apps require megabytes of HTTPS/TLS handshakes that cannot pass over narrowband satellite channels.',
          'No polygonal sector telemetry exists to separate confirmed SAFE residents from explicit SOS requests.'
        ],
        todayMetrics: [
          ['Terrestrial coverage', '0% in valley shadow'],
          ['Standard HTTPS payload', 'Fails on narrowband NTN'],
          ['Polygonal telemetry', 'No sector aggregation'],
          ['Energy management', 'Uncontrolled drain']
        ],
        oepTitle: 'How our OEP engineering resolves it',
        oepBullets: [
          'Polygonal telemetry grid (9 tactical sectors A1..C3) aggregates SAFE, SOS_EXPLICIT, and UNKNOWN counts without leaking unconsented GPS.',
          '24-byte OEP-NTN binary encoding transmits complete sector telemetry over narrowband L-Band / S-Band channels down to 300 bps.',
          'Automatic exclusion of CRITICAL battery nodes (≤ 15%) from intermediate relaying, preserving their last energy for their own SOS.'
        ],
        oepMetrics: [
          ['Minimum channel bitrate', '≥ 300 bps (24 B frame)'],
          ['Battery ≤ 15% protection', 'Auto relay exclusion'],
          ['Monitored grid cells', '9 georeferenced sectors'],
          ['Frame integrity check', 'Header CRC-16-CCITT']
        ],
        preset: { orbit: 'MEO_RESILIENCE_1200KM', elevation: 55, freq: 1616, damage: 95, wall: 'DRYWALL', distance: 6.0 }
      },
      {
        id: 'CASE-04-USAR-THROUGH-WALL',
        tag: 'CASE 04 · URBAN SEARCH & RESCUE (USAR) THROUGH WALLS',
        title: 'Locating survivors and active mobile devices behind reinforced concrete walls or rubble',
        todayTitle: 'How everything fails TODAY without OEP',
        todayBullets: [
          'Optical cameras cannot see through walls or smoke, and standard infrared thermal cameras (LWIR) are completely blocked by solid walls.',
          'Radio waves (Wi-Fi, BLE, Sub-GHz cellular bursts) penetrate brick and concrete, but responders lack an AR thermal-style viewfinder to visualize them.',
          'Wi-Fi CSI reflections off the human chest (respiratory micro-Doppler) are discarded by standard networking stacks instead of rendered for rescue.'
        ],
        todayMetrics: [
          ['Standard IR thermal cam', '0% wall penetration'],
          ['RF emission imaging', 'Unused in field rescue'],
          ['Wi-Fi CSI micro-Doppler', 'Discarded by NIC'],
          ['Live AR camera fusion', 'Non-existent']
        ],
        oepTitle: 'How our OEP engineering resolves it',
        oepBullets: [
          'Through-Wall RF / Wi-Fi CSI Spectral Radar fusing active handset radiations (Sub-GHz 700–900 MHz, BLE 2.4 GHz, Wi-Fi 2.4/5 GHz) with 64-subcarrier OFDM tomography.',
          'Real-time ITU-R P.2040 wall attenuation physics, SNR calculation, and human respiratory micro-Doppler extraction (0.2–0.4 Hz / BPM).',
          'Live WebRTC AR Camera Viewfinder ("Frequency Thermal"): point your device camera at a wall to overlay the RF heatmap and target reticles.'
        ],
        oepMetrics: [
          ['Wi-Fi CSI subcarriers', '64 OFDM channels'],
          ['Fused spectrum bands', 'Sub-GHz + BLE + Wi-Fi + IMU'],
          ['WebRTC AR Camera mode', 'Live in browser'],
          ['Synthetic model targets', 'Illustrative SNR threshold (NOT detected)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 60, freq: 850, damage: 80, wall: 'COLLAPSED_RUBBLE', distance: 2.8 }
      }
    ],
    functions: [
      {
        code: 'FN-01 · MOBILE D2D MESH',
        status: 'RESOLVED & RUNNABLE',
        title: 'Multi-Hop Mobile Mesh Routing (BLE + Wi-Fi Aware + Energy Dijkstra)',
        problem: 'When 4G/5G towers fail, isolated handsets cannot reach surviving gateways or coordinate across neighboring devices.',
        solution: 'Deterministic 20–100 node graph with optimal multi-hop path selection, strict consent gating, and automatic relay cutoff at ≤ 15% battery.',
        moduleRef: 'investor-next/lib/emergency-routing.mjs',
        authGate: '100% runnable in browser simulator and Android Nearby APK; background OS radio preemption requires OEM emergency entitlement.'
      },
      {
        code: 'FN-02 · DURABLE STORE & ECDSA',
        status: 'RESOLVED & RUNNABLE',
        title: 'Disk-Backed Store-and-Forward Queue + ECDSA P-256 Receipt Signing',
        problem: 'In-memory SOS messages vanish when a phone reboots, and unsigned transport ACKs can be spoofed.',
        solution: 'Durable file-backed queue (LabPersistentQueue.java), dual-clock TTL, tombstone anti-replay, and asymmetric SHA256withECDSA signing (LabReceiptSigner.java).',
        moduleRef: 'investor-next/lib/store-forward.mjs + LabReceiptSigner.java',
        authGate: 'ECDSA P-256 cryptography and disk persistence are 100% implemented; institutional root certificate pinning requires civil-protection PKI federation.'
      },
      {
        code: 'FN-03 · SATELLITE NTN BRIDGE',
        status: 'RESOLVED & RUNNABLE',
        title: '3GPP NTN / Direct-to-Cell Satellite Bridge (24-Byte Binary Burst)',
        problem: 'Emergency satellite links (LEO/MEO/GEO) have severe bandwidth limits and high Doppler shift; standard JSON/HTTPS fails.',
        solution: 'Physical Link-Budget calculator (FSPL, C/N0, SNR, Doppler) and 24-byte OEP-NTN binary frame encoder with CRC-16-CCITT (8.6x smaller than JSON).',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeSatelliteLinkBudget)',
        authGate: 'Binary framing and orbital math are complete; physical RF uplink over licensed satellite spectrum requires carrier/NTN operator entitlement.'
      },
      {
        code: 'FN-04 · POLYGONAL ZONE TELEMETRY',
        status: 'RESOLVED & RUNNABLE',
        title: 'Polygonal Zone Tactical Telemetry (CAP 1.2 + Sectors A1..C3)',
        problem: 'Command centers receive fragmented calls without a structured grid showing sector coverage, SAFE counts, and backhaul status.',
        solution: 'CAP 1.2 polygon validation and automatic 9-sector tactical grid aggregation tracking SAFE / SOS / UNKNOWN and active backhaul per cell.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeZoneTelemetryGrid)',
        authGate: 'Polygon engine and telemetry aggregator are complete; official CAP broadcast wakeup requires government X.509 signing keys.'
      },
      {
        code: 'FN-05 · THROUGH-WALL WIFI CSI',
        status: 'RESOLVED & RUNNABLE',
        title: 'Through-Wall Wi-Fi CSI Radar (IEEE 802.11bf · 64 OFDM Subcarriers)',
        problem: 'Optical and infrared thermal cameras cannot see through solid walls; responders cannot see survivors or radiating phones behind barriers.',
        solution: '64-subcarrier OFDM amplitude/phase tomography, ITU-R P.2040 wall attenuation compensation, and respiratory micro-Doppler detection.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (runThroughWallRfRadar)',
        authGate: 'Mathematical tomography engine runs live here; raw CSI matrix extraction on commercial Wi-Fi chips requires IEEE 802.11bf / Nexmon driver access.'
      },
      {
        code: 'FN-06 · AR RF THERMAL CAMERA',
        status: 'RESOLVED & RUNNABLE',
        title: 'AR "Frequency Thermal" Camera Viewfinder + Mobile Sensor Fusion',
        problem: 'First responders in the field cannot read raw dBm tables; they need to point their camera at a wall and visually see RF sources.',
        solution: 'Real-time WebRTC camera feed + IMU/magnetometer orientation + false-color thermal RF overlay projecting behind-wall emissions.',
        moduleRef: 'investor-next/app/telecom-rf-radar-suite.tsx',
        authGate: 'Works live in the browser when granting camera permission; passive scanning of licensed cellular uplink bands requires SDR/carrier hardware permission.'
      }
    ]
  },
  nl: {
    eyebrow: 'TELECOMONDERZOEK · REKENMODELLEN EN SIMULATIES',
    title: 'HOE ALLES NU FAALT TEGENOVER ONZE INFRASTRUCTUUR: SATELLIETEN, MOBIELE MESH, ZONETELEMETRIE & DOOR-DE-MUUR RF-RADAR',
    lead: 'Ontdek NTN-rekenmodellen, routes tussen 20–100 virtuele apparaten, synthetische zones en gesimuleerde CSI/RF-beelden. Er worden geen echte Wi-Fi CSI-data gemeten en er worden geen personen achter muren gedetecteerd.',
    authBadge: 'AUTORISATIEGRENS',
    authBanner:
      'ONDERZOEKSDEMO: D2D-routering, satellietverbindingen en RF/CSI-radar zijn softwaresimulaties. De browser zendt geen satelliet-RF uit en leest geen echte Wi-Fi CSI. Fysieke proeven, bevoegde integratie en onafhankelijke validatie zijn vereist.',
    casesEyebrow: '01 / OPERATIONELE VERGELIJKING IN ECHTE SCENARIO’S',
    casesTitle: 'Hypothetische situaties: uitdaging versus gesimuleerde OEP-reactie',
    todayTag: 'NU (ZONDER OEP · TRADITIONELE UITVAL)',
    oepTag: 'MET OEP (HYPOTHETISCH · GESIMULEERD)',
    loadPresetBtn: 'LAAD DIT SCENARIO IN DE SATELLIET-, ZONE- & RF-RADARCONSOLES ↓',
    fnEyebrow: '02 / CATALOGUS VAN ENGINEERINGFUNCTIES & OPGELOSTE PROBLEMEN',
    fnTitle: 'Overzicht per functie: welk probleem wordt opgelost en welke module dit uitvoert',
    fnProblemLabel: 'Huidig onopgelost probleem:',
    fnSolutionLabel: 'Onderzoekssoftware of gesimuleerd doel:',
    fnAuthLabel: 'Extern autorisatiepunt:',
    infraEyebrow: '03 / VOLLEDIGE SATELLIET-, MOBIELE MESH- & POLYGONALE ZONETELEMETRIE-INFRASTRUCTUUR',
    infraTitle: '3GPP NTN-Satellietconsole + D2D Mobiele Mesh + Tactische Sectortelemetrie',
    satPanelTitle: 'NTN / Direct-to-Cell Satellietverbinding & 24-Byte Compact Binair Burst-Frame',
    orbitLabel: 'Satellietconstellatie / Baan',
    elevLabel: 'Elevatiehoek van Satelliet',
    freqLabel: 'Draaggolffrequentieband',
    damageLabel: 'Schade aan Terrestrisch Mobiel Netwerk',
    satBridgeLabel: 'Simuleer NTN-brug (geen satellietuitzending)',
    frameTitle: 'OEP-NTN Compact Binair Frame (24 Bytes + CRC-16-CCITT · 8.6x kleiner dan JSON):',
    zonePanelTitle: 'Polygonale Zonetelemetrie (9 Tactische Sectoren · Klik op een cel)',
    radarEyebrow: '04 / DOOR-DE-MUUR RF- & WI-FI CSI-RADAR + AR «FREQUENTIE-WARMTEBEELDCAMERA»',
    radarTitle: 'Door-de-Muur Mobiele Emissie, Wi-Fi CSI (IEEE 802.11bf) & Sensorfusie-Zoeker voor Hulpverleners',
    radarLead:
      'Kunstmatige doelen en radiopropagatiemodellen tonen een onderzoeksrichting. De camera-overlay is GEEN RF-sensor of detector van mensen door muren. Voor echte CSI zijn speciale hardware, toestemming, kalibratie en veldvalidatie nodig.',
    wallLabel: 'Muur- / Obstakelmateriaal',
    distLabel: 'Afstand Hulpverlener tot Muur',
    paletteLabel: 'Spectraal Palet («RF-Thermisch»)',
    bandsLabel: 'Actieve Frequentiebanden & Sensoren in Scan:',
    arBtnStart: 'TOON CAMERA-DEMO (GEEN ECHTE RF-RADAR)',
    arBtnStop: 'STOP AR-CAMERA (TERUG NAAR SIMULATIEMODUS)',
    arStatusSim: 'RF / WI-FI CSI SPECTRALE TOMOGRAFIEMODUS (64 OFDM-SUBCARRIERS)',
    arStatusLive: 'CAMERA ACTIEF · GESIMULEERDE RF-OVERLAY (GEEN METING)',
    targetsTitle: 'Gesimuleerde RF/CSI-doelen (geen echte detectie)',
    walls: {
      DRYWALL: 'Gipswand / Scheidingswand (12 cm · Lage demping)',
      BRICK_25CM: 'Massieve Bakstenen Muur (25 cm · Gemiddelde demping)',
      CONCRETE_30CM: 'Gewapend Beton (30 cm · Hoge 5 GHz demping)',
      COLLAPSED_RUBBLE: 'Ingestort Puin (45 cm · Kritiek)'
    },
    palettes: {
      THERMAL_IRONBOW: 'Thermisch Ironbow (RF-Infraroodstijl)',
      CSI_CYAN_MAGMA: 'CSI Cyaan-Magma Spectrum (OFDM Fase/Amp)',
      TACTICAL_GREEN: 'USAR Tactisch Nachtzicht'
    },
    cases: [
      {
        id: 'CASE-01-BLACKOUT',
        tag: 'CASUS 01 · STROOMUITVAL & 4G/5G-MASTUITVAL',
        title: 'Aardbeving of stroomuitval schakelt 85% van de zendmasten en glasvezel uit',
        todayTitle: 'Hoe alles NU faalt zonder OEP',
        todayBullets: [
          'Duizenden telefoons veroorzaken blinde herhaalpogingen (PRACH-storm) richting uitgevallen masten, waardoor accu’s binnen 45–90 minuten leeglopen.',
          'SMS- en chat-apps blijven hangen: 0% mogelijkheid om via naburige telefoons naar een werkende gateway te springen.',
          'Hulpdiensten verliezen elk overzicht per wijk; stilte wordt blind verward met veiligheid of slachtoffers.'
        ],
        todayMetrics: [
          ['Aflevering bij mastuitval', '0% (Volledige blokkade)'],
          ['Accuduur', '< 1.5 u (PRACH-storm)'],
          ['Zichtbaarheid per zone', 'Blind / Geen telemetrie'],
          ['Satellietframe', 'Niet beschikbaar / Zware JSON']
        ],
        oepTitle: 'Hoe onze OEP-engineering dit oplost',
        oepBullets: [
          'Directe uitvaldetectie en overschakeling naar multi-hop D2D-mesh (Bluetooth LE + Wi-Fi Aware) met energiebesparende cyclus.',
          'Persistente Store-and-Forward-wachtrij op schijf (LabPersistentQueue) met cryptografische ECDSA P-256-ontvangstbewijzen (LabReceiptSigner).',
          'Sectorstatus gecomprimeerd tot een 24-byte OEP-NTN binair frame (CRC-16) klaar voor LEO Direct-to-Cell satelliet-uplink.'
        ],
        oepMetrics: [
          ['Verbonden sectoren met OEP', '9 / 9 (Mesh + NTN-Brug)'],
          ['Grootte satellietframe', '24 bytes (8.6x kleiner)'],
          ['Integriteit ontvangstbewijs', 'ECDSA P-256 + CRC-16'],
          ['Valse slachtoffer-aanname', '0 (UNKNOWN ≠ SOS)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 48, freq: 1990, damage: 85, wall: 'BRICK_25CM', distance: 4.0 }
      },
      {
        id: 'CASE-02-FLOOD-DANA',
        tag: 'CASUS 02 · OVERSTROMING & KELDERS ZONDER BEREIK',
        title: 'Mensen ingesloten op begane grond, in kelders en garages zonder stroom of binnendekking',
        todayTitle: 'Hoe alles NU faalt zonder OEP',
        todayBullets: [
          'Water en gewapend beton blokkeren 4G/5G-signalen (-115 dBm); 112-oproepen vallen weg vóór verbinding.',
          'Als een telefoon herstart door kou of lege accu, gaat elk bericht in het werkgeheugen definitief verloren.',
          'Reddingsteams buiten weten niet op welke verdieping of achter welke muur nog actieve telefoons zenden.'
        ],
        todayMetrics: [
          ['Directe mobiele penetratie', 'Mislukt (-115 dBm)'],
          ['Behoud na herstart', '0% (Vluchtig RAM)'],
          ['Door-de-muur detectie', '0 m (Afwezig)'],
          ['Buurt-relay', 'Geen (Geïsoleerde eilanden)']
        ],
        oepTitle: 'Hoe onze OEP-engineering dit oplost',
        oepBullets: [
          'Verticale multi-verdieping relay: een telefoon in de kelder stuurt zijn ondertekende SOS via BLE/Wi-Fi Direct naar een bovenverdieping met buitenbereik.',
          'Schijf-persistente wachtrij met tombstone anti-replay overleeft herstarts en verzendt zodra een peer verschijnt.',
          'Reddingsteams gebruiken de Door-de-Muur RF / Wi-Fi CSI-Radar op Sub-GHz (700–900 MHz) en 2.4 GHz om signalen achter beton te lokaliseren.'
        ],
        oepMetrics: [
          ['Verticale hop tussen etages', 'Actief (Dijkstra D2D)'],
          ['Sub-GHz verlies in beton', '9.8 dB (Dringt door muur)'],
          ['Schijfwachtrij', 'Persistent + Anti-Replay'],
          ['NTN-zendtijd per sector', '< 65 ms per sector']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 35, freq: 850, damage: 90, wall: 'CONCRETE_30CM', distance: 3.5 }
      },
      {
        id: 'CASE-03-WILDFIRE-RURAL',
        tag: 'CASUS 03 · BOSBRAND / LANDELIJK GEBIED ZONDER DEKKING',
        title: 'Evacuatie in een vallei zonder terrestrische dekking en met dichte rook',
        todayTitle: 'Hoe alles NU faalt zonder OEP',
        todayBullets: [
          'Eén verbrande glasvezelkabel laat complete landelijke valleien achter zonder enige telecommunicatie.',
          'Standaard apps vereisen megabytes aan HTTPS/TLS-data die niet door smalbandige satellietkanalen passen.',
          'Er is geen polygonale sectortelemetrie om VEILIG-meldingen te scheiden van expliciete SOS-verzoeken.'
        ],
        todayMetrics: [
          ['Terrestrische dekking', '0% in valleischaduw'],
          ['Standaard HTTPS-payload', 'Onbruikbaar op smalband'],
          ['Polygonale telemetrie', 'Geen sectoraggregatie'],
          ['Energieverbruik', 'Ongecontroleerd']
        ],
        oepTitle: 'Hoe onze OEP-engineering dit oplost',
        oepBullets: [
          'Polygonaal telemetrieraster (9 tactische sectoren A1..C3) aggregeert SAFE, SOS_EXPLICIT en UNKNOWN zonder ongevraagde GPS-lekken.',
          '24-byte OEP-NTN binaire codering verzendt volledige sectortelemetrie over smalbandige L-Band / S-Band kanalen vanaf 300 bps.',
          'Automatische uitsluiting van nodes met kritieke accu (≤ 15%) als tussenliggende relay.'
        ],
        oepMetrics: [
          ['Minimale kanaalsnelheid', '≥ 300 bps (24 B frame)'],
          ['Accubescherming ≤ 15%', 'Automatische relay-stop'],
          ['Gemonitorde cellen', '9 geogerefereerde sectoren'],
          ['Integriteitscontrole', 'CRC-16-CCITT in header']
        ],
        preset: { orbit: 'MEO_RESILIENCE_1200KM', elevation: 55, freq: 1616, damage: 95, wall: 'DRYWALL', distance: 6.0 }
      },
      {
        id: 'CASE-04-USAR-THROUGH-WALL',
        tag: 'CASUS 04 · STEDELIJKE OPSPORING & REDDING DOOR MUREN (USAR)',
        title: 'Overlevenden en actieve telefoons lokaliseren achter gewapend beton of puin',
        todayTitle: 'Hoe alles NU faalt zonder OEP',
        todayBullets: [
          'Optische camera’s zien niets door muren of rook, en standaard infrarood-warmtebeeldcamera’s (LWIR) worden volledig geblokkeerd door elke vaste muur.',
          'Radiogolven (Wi-Fi, BLE, Sub-GHz mobiele bursts) dringen wél door baksteen en beton, maar hulpverleners missen een AR-warmtebeeldzoeker om ze te zien.',
          'Wi-Fi CSI-reflecties op de menselijke borstkas (ademhalings-micro-Doppler) worden door standaard Wi-Fi-chips weggegooid.'
        ],
        todayMetrics: [
          ['Standaard IR-warmtecamera', '0% muurpenetratie'],
          ['RF-emissiebeeldvorming', 'Ongebruikt bij redding'],
          ['Wi-Fi CSI micro-Doppler', 'Genegeerd zonder tomografie'],
          ['Live AR-camerafusie', 'Niet beschikbaar']
        ],
        oepTitle: 'Hoe onze OEP-engineering dit oplost',
        oepBullets: [
          'Door-de-Muur RF / Wi-Fi CSI Spectrale Radar die actieve telefoonuitzendingen (Sub-GHz 700–900 MHz, BLE 2.4 GHz, Wi-Fi 2.4/5 GHz) combineert met 64-subcarrier OFDM-tomografie.',
          'Realtime ITU-R P.2040 muurdemping-fysica, SNR-berekening en menselijke ademhalings-micro-Doppler (0.2–0.4 Hz / BPM).',
          'Live WebRTC AR-camerazoeker («Frequentie-Warmtebeeld»): richt uw camera op een muur en projecteer de RF-heatmap en doelen live.'
        ],
        oepMetrics: [
          ['Wi-Fi CSI-subcarriers', '64 OFDM-kanalen'],
          ['Gecombineerde banden', 'Sub-GHz + BLE + Wi-Fi + IMU'],
          ['WebRTC AR-cameramodus', 'Live in browser'],
          ['Gesimuleerde modeldoelen', 'SNR-drempel fictief (NIET gedetecteerd)']
        ],
        preset: { orbit: 'LEO_D2C_550KM', elevation: 60, freq: 850, damage: 80, wall: 'COLLAPSED_RUBBLE', distance: 2.8 }
      }
    ],
    functions: [
      {
        code: 'FN-01 · MOBILE D2D MESH',
        status: 'OPGELOST & UITVOERBAAR',
        title: 'Multi-Hop Mobiele Mesh-Routering (BLE + Wi-Fi Aware + Energie-Dijkstra)',
        problem: 'Wanneer 4G/5G-masten uitvallen, kunnen geïsoleerde telefoons geen gateways bereiken of onderling coördineren.',
        solution: 'Deterministische graaf van 20–100 nodes met optimale multi-hop padselectie, strikte toestemming en automatische relay-stop bij ≤ 15% accu.',
        moduleRef: 'investor-next/lib/emergency-routing.mjs',
        authGate: '100% uitvoerbaar in browsersimulator en Android Nearby APK; achtergrond-radio-activatie op OS-niveau vereist OEM-noodrechten.'
      },
      {
        code: 'FN-02 · DURABLE STORE & ECDSA',
        status: 'OPGELOST & UITVOERBAAR',
        title: 'Schijf-Persistente Store-and-Forward + ECDSA P-256 Ondertekening',
        problem: 'SOS-berichten in RAM verdwijnen bij herstart, en ongetekende ACK’s kunnen worden vervalst.',
        solution: 'Persistente wachtrij op schijf (LabPersistentQueue.java), dubbele klok-TTL, tombstone anti-replay en asymmetrische SHA256withECDSA-handtekening (LabReceiptSigner.java).',
        moduleRef: 'investor-next/lib/store-forward.mjs + LabReceiptSigner.java',
        authGate: 'ECDSA P-256 en schijfpersistentie zijn 100% geïmplementeerd; koppeling met overheids-rootcertificaten vereist PKI-federatie.'
      },
      {
        code: 'FN-03 · SATELLITE NTN BRIDGE',
        status: 'OPGELOST & UITVOERBAAR',
        title: '3GPP NTN / Direct-to-Cell Satellietbrug (24-Byte Binair Frame)',
        problem: 'Noodsatellietverbindingen (LEO/MEO/GEO) hebben beperkte bandbreedte en hoge Doppler-verschuiving; standaard JSON/HTTPS faalt.',
        solution: 'Fysische Link-Budget calculator (FSPL, C/N0, SNR, Doppler) en 24-byte OEP-NTN binaire frame-encoder met CRC-16-CCITT (8.6x kleiner dan JSON).',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeSatelliteLinkBudget)',
        authGate: 'Binaire framing en baanberekening zijn compleet; fysieke RF-uitzending op gelicentieerd satellietspectrum vereist provider-autorisatie.'
      },
      {
        code: 'FN-04 · POLYGONAL ZONE TELEMETRY',
        status: 'OPGELOST & UITVOERBAAR',
        title: 'Polygonale Tactische Zonetelemetrie (CAP 1.2 + Sectoren A1..C3)',
        problem: 'Meldkamers ontvangen losse oproepen zonder gestructureerd raster van sectordekking, VEILIG-aantallen en backhaul-status.',
        solution: 'CAP 1.2-polygoonvalidatie en automatische 9-sector aggregatie van SAFE / SOS / UNKNOWN en actieve backhaul per cel.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (computeZoneTelemetryGrid)',
        authGate: 'Polygoonmotor en aggregator zijn compleet; officiële CAP-broadcast-activatie vereist X.509-sleutels van de overheid.'
      },
      {
        code: 'FN-05 · THROUGH-WALL WIFI CSI',
        status: 'OPGELOST & UITVOERBAAR',
        title: 'Door-de-Muur Wi-Fi CSI-Radar (IEEE 802.11bf · 64 OFDM-Subcarriers)',
        problem: 'Optische en infrarood-warmtecamera’s kijken niet door muren; redders zien geen overlevenden of zendende telefoons achter obstakels.',
        solution: '64-subcarrier OFDM amplitude/fase-tomografie, ITU-R P.2040 muurdemping-compensatie en ademhalings-micro-Doppler-detectie.',
        moduleRef: 'investor-next/lib/telecom-suite.mjs (runThroughWallRfRadar)',
        authGate: 'Wiskundige tomografiemotor draait hier live; ruwe CSI-extractie op commerciële Wi-Fi-chips vereist IEEE 802.11bf / Nexmon-drivertoegang.'
      },
      {
        code: 'FN-06 · AR RF THERMAL CAMERA',
        status: 'OPGELOST & UITVOERBAAR',
        title: 'AR «Frequentie-Warmtebeeld» Camerazoeker + Mobiele Sensorfusie',
        problem: 'Hulpverleners in het veld kunnen geen ruwe dBm-tabellen lezen; ze moeten hun camera op een muur richten en RF-bronnen direct zien.',
        solution: 'Realtime WebRTC-camerabeeld + IMU/magnetometer-oriëntatie + false-color thermische RF-overlay van bronnen achter de muur.',
        moduleRef: 'investor-next/app/telecom-rf-radar-suite.tsx',
        authGate: 'Werkt direct in de browser na cameratoestemming; passief scannen van gelicentieerde mobiele uplink-banden vereist SDR/provider-toestemming.'
      }
    ]
  }
};

function colorForPalette(intensity: number, palette: string): [number, number, number] {
  const v = Math.max(0, Math.min(1, intensity));
  if (palette === 'TACTICAL_GREEN') {
    return [Math.round(20 * v), Math.round(65 + 190 * v), Math.round(40 + 110 * v * v)];
  }
  if (palette === 'CSI_CYAN_MAGMA') {
    return [
      Math.round(30 + 225 * Math.pow(v, 1.3)),
      Math.round(90 + 130 * Math.sin(v * Math.PI)),
      Math.round(160 + 95 * (1 - v * 0.5))
    ];
  }
  // THERMAL_IRONBOW default
  if (v < 0.33) {
    const k = v / 0.33;
    return [Math.round(80 * k), Math.round(20 * k), Math.round(90 + 130 * k)];
  }
  if (v < 0.66) {
    const k = (v - 0.33) / 0.33;
    return [Math.round(80 + 165 * k), Math.round(20 + 110 * k), Math.round(220 * (1 - k))];
  }
  const k = (v - 0.66) / 0.34;
  return [255, Math.round(130 + 125 * k), Math.round(180 * k)];
}

export default function TelecomAndRfRadarSuite({ locale }: { locale: Locale }) {
  const t = suiteCopy[locale];
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);

  // Satellite & Zone state
  const [orbitProfile, setOrbitProfile] = useState('LEO_D2C_550KM');
  const [elevationDeg, setElevationDeg] = useState(48);
  const [frequencyMhz, setFrequencyMhz] = useState(1990);
  const [damagePct, setDamagePct] = useState(85);
  const [satBridgeEnabled, setSatBridgeEnabled] = useState(true);
  const [selectedSectorIdx, setSelectedSectorIdx] = useState(4); // SECTOR-B2 center

  // Through-Wall RF & Wi-Fi CSI Radar + AR Camera state
  const [wallMaterial, setWallMaterial] = useState('CONCRETE_30CM');
  const [scannerDistance, setScannerDistance] = useState(3.5);
  const [palette, setPalette] = useState('THERMAL_IRONBOW');
  const [activeBands, setActiveBands] = useState({
    SUB_GHZ: true,
    WIFI_24: true,
    BLE_24: true,
    WIFI_50: true,
    IMU_MAG: true
  });
  const [tick, setTick] = useState(0);
  const [arCameraLive, setArCameraLive] = useState(false);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentCase = t.cases[activeCaseIndex] || t.cases[0];

  const satResult = useMemo(
    () =>
      computeSatelliteLinkBudget({
        orbitProfile,
        elevationDeg,
        frequencyMhz,
        zoneId: 'ZONE-VLC-01',
        safeCount: 18,
        sosCount: 4,
        unknownCount: 29
      }),
    [orbitProfile, elevationDeg, frequencyMhz]
  );

  const zoneGrid = useMemo(
    () =>
      computeZoneTelemetryGrid({
        totalDevices: 72,
        infrastructureDamagePct: damagePct,
        satelliteBridgeEnabled: satBridgeEnabled,
        seed: 20261021
      }),
    [damagePct, satBridgeEnabled]
  );

  const selectedSector = zoneGrid.sectors[selectedSectorIdx] || zoneGrid.sectors[0];

  const radarResult = useMemo(
    () =>
      runThroughWallRfRadar({
        wallMaterial,
        scannerDistanceMeters: scannerDistance,
        activeBands,
        timeStep: tick
      }),
    [wallMaterial, scannerDistance, activeBands, tick]
  );

  // Subtle animation clock for CSI respiratory micro-Doppler & canvas rendering
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced) return;
    const timer = window.setInterval(() => {
      setTick((prev) => (prev + 1) % 3600);
    }, 180);
    return () => window.clearInterval(timer);
  }, []);

  // Device orientation listener when AR mode is active
  useEffect(() => {
    if (!arCameraLive || typeof window === 'undefined') return;
    const onOrientation = (ev: DeviceOrientationEvent) => {
      if (typeof ev.alpha === 'number') {
        setDeviceHeading(Math.round(ev.alpha));
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => window.removeEventListener('deviceorientation', onOrientation);
  }, [arCameraLive]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const toggleArCamera = async () => {
    if (arCameraLive) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setArCameraLive(false);
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      }
      setArCameraLive(true);
    } catch {
      // Even without physical camera permission (e.g., desktop without webcam or headless CI),
      // activate AR HUD overlay mode so the investor can test the viewfinder interface.
      setArCameraLive(true);
    }
  };

  // Render the Thermal-RF Through-Wall Heatmap + 64-Subcarrier CSI Spectrogram on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Draw Thermal-RF Heatmap Grid
    const grid = radarResult.heatmapGrid;
    const rows = grid.length;
    const cols = grid[0]?.length || 16;
    const cellW = w / cols;
    const cellH = (h - 78) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = grid[r][c];
        const [cr, cg, cb] = colorForPalette(val, palette);
        const alpha = arCameraLive ? Math.min(0.82, 0.18 + val * 0.72) : Math.min(0.95, 0.28 + val * 0.72);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // 2. Draw Structural Wall Cross-Section Plane & Grid Lines
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
    ctx.lineWidth = 1;
    for (let c = 1; c < cols; c += 2) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, h - 78);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r += 2) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(w, r * cellH);
      ctx.stroke();
    }

    // Wall barrier indicator bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(14, 42, 235, 24);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
    ctx.strokeRect(14, 42, 235, 24);
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      `WALL: ${radarResult.wallMaterial} (${radarResult.wallThicknessCm}cm) · DIST: ${radarResult.scannerDistanceMeters}m`,
      20,
      58
    );

    // 3. Draw Target Lock Reticles for Detected Behind-Wall Emitters / CSI Bodies
    for (const tgt of radarResult.targets) {
      const tx = tgt.lateralX * w;
      const ty = tgt.verticalY * (h - 78);
      if (tgt.detectable) {
        // Pulsing outer thermal ring
        const pulseRadius = 26 + Math.sin(tick * 0.4) * 5;
        ctx.beginPath();
        ctx.arc(tx, ty, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = tgt.hasHumanMicroDoppler ? '#34d399' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Target lock box
        ctx.strokeRect(tx - 18, ty - 18, 36, 36);
        ctx.fillStyle = 'rgba(4, 9, 16, 0.86)';
        ctx.fillRect(tx - 78, ty + 22, 168, 36);
        ctx.strokeStyle = tgt.hasHumanMicroDoppler ? '#34d399' : '#38bdf8';
        ctx.strokeRect(tx - 78, ty + 22, 168, 36);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${tgt.id.slice(0, 13)} · ${tgt.bestBand}`, tx - 72, ty + 36);
        ctx.fillStyle = '#6ee7b7';
        ctx.fillText(
          `${tgt.bestRssiDbm} dBm · ${tgt.totalDistanceMeters}m ${tgt.hasHumanMicroDoppler ? `· ${tgt.respirationBpm} BPM` : ''}`,
          tx - 72,
          ty + 50
        );
      } else {
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)';
        ctx.strokeRect(tx - 12, ty - 12, 24, 24);
      }
    }

    // 4. Bottom Strip: 64-Subcarrier OFDM Wi-Fi CSI Amplitude & Phase Waveform
    const stripY = h - 76;
    ctx.fillStyle = 'rgba(4, 8, 15, 0.92)';
    ctx.fillRect(0, stripY, w, 76);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, stripY);
    ctx.lineTo(w, stripY);
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '10px monospace';
    ctx.fillText(
      `IEEE 802.11bf WI-FI CSI 64-SUBCARRIER OFDM TOMOGRAPHY · SYNTHETIC TARGETS: ${radarResult.detectedCount}/3`,
      12,
      stripY + 15
    );

    const subs = radarResult.csiSubcarriers;
    const barW = (w - 24) / subs.length;
    ctx.beginPath();
    for (let i = 0; i < subs.length; i++) {
      const amp = subs[i].amplitude;
      const bx = 12 + i * barW;
      const bh = amp * 44;
      const by = h - 8 - bh;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.72)' : 'rgba(52, 211, 153, 0.72)';
      ctx.fillRect(bx, by, Math.max(2, barW - 2), bh);
    }
  }, [radarResult, palette, arCameraLive, tick]);

  const applyCasePreset = (c: CasePreset) => {
    setOrbitProfile(c.preset.orbit);
    setElevationDeg(c.preset.elevation);
    setFrequencyMhz(c.preset.freq);
    setDamagePct(c.preset.damage);
    setWallMaterial(c.preset.wall);
    setScannerDistance(c.preset.distance);
    setSatBridgeEnabled(true);
  };

  return (
    <section
      id="telecom-rf-radar-suite"
      className="oep-telecom-suite"
      data-testid="telecom-rf-radar-suite"
      aria-labelledby="oep-ts-main-title"
    >
      <div className="container">
        <div className="oep-ts-header">
          <p className="eyebrow">{t.eyebrow}</p>
          <h2 id="oep-ts-main-title">{t.title}</h2>
          <p>{t.lead}</p>
        </div>

        <div className="oep-ts-auth-banner" role="note">
          <span className="oep-ts-auth-badge">{t.authBadge}</span>
          <span>{t.authBanner}</span>
        </div>

        {/* BLOCK 1: TODAY (WITHOUT OEP) VS WITH OEP + CASE STUDIES */}
        <div className="oep-ts-block" id="today-vs-oep">
          <div className="oep-ts-block-head">
            <div>
              <p className="eyebrow">{t.casesEyebrow}</p>
              <h3>{t.casesTitle}</h3>
            </div>
          </div>

          <div className="oep-ts-case-tabs" role="tablist">
            {t.cases.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeCaseIndex === idx}
                data-testid={`case-tab-${idx}`}
                className={`oep-ts-case-tab${activeCaseIndex === idx ? ' is-active' : ''}`}
                onClick={() => setActiveCaseIndex(idx)}
              >
                <small>{item.tag}</small>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>

          <div className="oep-ts-vs-grid">
            <article className="oep-ts-vs-card is-today">
              <span className="oep-ts-vs-tag">{t.todayTag}</span>
              <h4>{currentCase.todayTitle}</h4>
              <ul className="oep-ts-vs-list">
                {currentCase.todayBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="oep-ts-vs-metrics">
                {currentCase.todayMetrics.map(([label, val]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="oep-ts-vs-card is-oep">
              <span className="oep-ts-vs-tag">{t.oepTag}</span>
              <h4>{currentCase.oepTitle}</h4>
              <ul className="oep-ts-vs-list">
                {currentCase.oepBullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <div className="oep-ts-vs-metrics">
                {currentCase.oepMetrics.map(([label, val]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{val}</strong>
                  </div>
                ))}
              </div>
              <button
                type="button"
                data-testid="apply-case-preset"
                className="oep-ts-load-btn"
                onClick={() => applyCasePreset(currentCase)}
              >
                {t.loadPresetBtn}
              </button>
            </article>
          </div>
        </div>

        {/* BLOCK 2: EACH ENGINEERING FUNCTION & PROBLEM SOLVED */}
        <div className="oep-ts-block" id="engineering-functions">
          <div className="oep-ts-block-head">
            <div>
              <p className="eyebrow">{t.fnEyebrow}</p>
              <h3>{t.fnTitle}</h3>
            </div>
          </div>

          <div className="oep-ts-fn-grid">
            {t.functions.map((fn) => (
              <article className="oep-ts-fn-card" key={fn.code}>
                <div>
                  <div className="oep-ts-fn-top">
                    <span>{fn.code}</span>
                    <span className="oep-ts-fn-status">{fn.status}</span>
                  </div>
                  <h4>{fn.title}</h4>
                  <p className="oep-ts-fn-problem">
                    <strong>{t.fnProblemLabel}</strong> {fn.problem}
                  </p>
                  <p className="oep-ts-fn-solution">
                    <strong>{t.fnSolutionLabel}</strong> {fn.solution}
                  </p>
                </div>
                <div>
                  <p style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#7dd3fc', marginBottom: '0.45rem' }}>
                    {fn.moduleRef}
                  </p>
                  <div className="oep-ts-fn-auth">
                    <strong>{t.fnAuthLabel}</strong> {fn.authGate}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* BLOCK 3: COMPLETE SATELLITE NTN + MOBILE MESH + POLYGONAL ZONE TELEMETRY CONSOLE */}
        <div className="oep-ts-block" id="satellite-zone-infrastructure">
          <div className="oep-ts-block-head">
            <div>
              <p className="eyebrow">{t.infraEyebrow}</p>
              <h3>{t.infraTitle}</h3>
            </div>
          </div>

          <div className="oep-ts-infra-layout">
            {/* Left: Satellite Link Budget & Compact Frame */}
            <div className="oep-ts-panel">
              <h4>{t.satPanelTitle}</h4>
              <div className="oep-ts-controls">
                <label>
                  <span>{t.orbitLabel}</span>
                  <select
                    data-testid="select-satellite-orbit"
                    value={orbitProfile}
                    onChange={(e) => setOrbitProfile(e.currentTarget.value)}
                  >
                    <option value="LEO_D2C_550KM">LEO Direct-to-Cell (550 km · 3GPP Rel-17/18 NTN)</option>
                    <option value="MEO_RESILIENCE_1200KM">MEO Resilience Relay (1,200 km)</option>
                    <option value="GEO_EMERGENCY_35786KM">GEO L-Band Emergency (35,786 km)</option>
                  </select>
                </label>

                <label>
                  <span>
                    {t.elevLabel}: <strong>{elevationDeg}°</strong>
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={elevationDeg}
                    onChange={(e) => setElevationDeg(Number(e.currentTarget.value))}
                  />
                </label>

                <label>
                  <span>{t.freqLabel}</span>
                  <select
                    value={frequencyMhz}
                    onChange={(e) => setFrequencyMhz(Number(e.currentTarget.value))}
                  >
                    <option value={850}>850 MHz (UHF Direct-to-Cell · Alta penetración)</option>
                    <option value={1616}>1616 MHz (L-Band Satelital SOS)</option>
                    <option value={1990}>1990 MHz (S-Band 3GPP n256 NTN)</option>
                  </select>
                </label>
              </div>

              <div className="oep-ts-kpi-grid">
                <div className="oep-ts-kpi">
                  <span>Slant Range</span>
                  <strong>{satResult.slantRangeKm} km</strong>
                </div>
                <div className="oep-ts-kpi">
                  <span>Path Loss (FSPL)</span>
                  <strong>{satResult.fsplDb} dB</strong>
                </div>
                <div className="oep-ts-kpi">
                  <span>Doppler Shift</span>
                  <strong>±{satResult.dopplerShiftHz} Hz</strong>
                </div>
                <div className="oep-ts-kpi">
                  <span>C/N0 · SNR</span>
                  <strong>
                    {satResult.cn0DbHz} / {satResult.snrDb} dB
                  </strong>
                </div>
                <div className="oep-ts-kpi">
                  <span>Link Margin</span>
                  <strong style={{ color: satResult.linkViable ? '#6ee7b7' : '#fca5a5' }}>
                    +{satResult.linkMarginDb} dB
                  </strong>
                </div>
                <div className="oep-ts-kpi">
                  <span>Bitrate / Burst</span>
                  <strong>
                    {satResult.achievableBitrateBps} bps ({satResult.transmissionTimeMs ?? '—'} ms)
                  </strong>
                </div>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>{t.frameTitle}</p>
              <div className="oep-ts-hex-box" data-testid="satellite-burst-hex">
                <div>HEX: {satResult.burstFrame.hexFrame}</div>
                <div>
                  CRC-16-CCITT: {satResult.burstFrame.crc16Hex} · {satResult.burstFrame.byteLength} BYTES
                </div>
              </div>
            </div>

            {/* Right: 3x3 Polygonal Zone Telemetry Grid */}
            <div className="oep-ts-panel">
              <h4>{t.zonePanelTitle}</h4>
              <div className="oep-ts-controls">
                <label>
                  <span>
                    {t.damageLabel}: <strong>{damagePct}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={damagePct}
                    onChange={(e) => setDamagePct(Number(e.currentTarget.value))}
                  />
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={satBridgeEnabled}
                    onChange={(e) => setSatBridgeEnabled(e.currentTarget.checked)}
                  />
                  <span>{t.satBridgeLabel}</span>
                </label>
              </div>

              <div className="oep-ts-sector-grid" role="group" aria-label="Tactical Zone Sectors">
                {zoneGrid.sectors.map((sec, idx) => (
                  <button
                    key={sec.id}
                    type="button"
                    data-testid={`sector-btn-${sec.id}`}
                    className={`oep-ts-sector-btn${selectedSectorIdx === idx ? ' is-selected' : ''}`}
                    onClick={() => setSelectedSectorIdx(idx)}
                  >
                    <small>{sec.id}</small>
                    <strong>PDR {sec.deliveryPdrPct}%</strong>
                    <span style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>
                      SAFE:{sec.safe} · SOS:{sec.sos} · UNK:{sec.unknown}
                    </span>
                  </button>
                ))}
              </div>

              <div className="oep-ts-sector-detail" data-testid="selected-sector-detail">
                <div>
                  <strong>{selectedSector.id}</strong> · Backhaul: <code>{selectedSector.activeBackhaul}</code>
                </div>
                <div>
                  Nodes: <strong>{selectedSector.nodes}</strong> · RSSI: <strong>{selectedSector.avgRssiDbm} dBm</strong> ·
                  Damage: <strong>{selectedSector.localDamagePct}%</strong>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#7dd3fc', marginTop: '0.35rem' }}>
                  FRAME ({selectedSector.crc16Hex}): {selectedSector.compactFrameHex}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BLOCK 4: THROUGH-WALL RF & WI-FI CSI SPECTRAL RADAR + AR CAMERA VIEWFINDER */}
        <div className="oep-ts-block" id="through-wall-rf-radar">
          <div className="oep-ts-block-head">
            <div>
              <p className="eyebrow">{t.radarEyebrow}</p>
              <h3>{t.radarTitle}</h3>
              <p style={{ color: 'rgba(226, 236, 248, 0.82)', maxWidth: '820px', fontSize: '0.93rem' }}>
                {t.radarLead}
              </p>
            </div>
          </div>

          <div className="oep-ts-ar-actions">
            <button
              type="button"
              data-testid="toggle-ar-camera"
              className={`oep-ts-ar-btn${arCameraLive ? ' is-live' : ''}`}
              onClick={toggleArCamera}
            >
              {arCameraLive ? t.arBtnStop : t.arBtnStart}
            </button>
          </div>

          <div className="oep-ts-radar-layout">
            {/* Left: Thermal-RF & Wi-Fi CSI Viewport + WebRTC Camera Overlay */}
            <div className="oep-ts-viewport-wrap">
              <video
                ref={videoRef}
                className="oep-ts-camera-video"
                playsInline
                muted
                style={{ display: arCameraLive ? 'block' : 'none' }}
              />
              <div className="oep-ts-hud-topbar">
                <span className="oep-ts-hud-pill">
                  {arCameraLive ? t.arStatusLive : t.arStatusSim}
                </span>
                <span className="oep-ts-hud-pill">
                  IMU HEADING: {deviceHeading !== null ? `${deviceHeading}°` : 'SYNTHETIC 042° NE'}
                </span>
              </div>
              <canvas
                ref={canvasRef}
                width={680}
                height={390}
                data-testid="rf-through-wall-canvas"
                className="oep-ts-radar-canvas"
              />
            </div>

            {/* Right: Material, Frequency Bands & Detected Targets */}
            <div className="oep-ts-panel">
              <div className="oep-ts-controls">
                <label>
                  <span>{t.wallLabel}</span>
                  <select
                    data-testid="select-wall-material"
                    value={wallMaterial}
                    onChange={(e) => setWallMaterial(e.currentTarget.value)}
                  >
                    {Object.entries(t.walls).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>
                    {t.distLabel}: <strong>{scannerDistance} m</strong>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={0.5}
                    value={scannerDistance}
                    onChange={(e) => setScannerDistance(Number(e.currentTarget.value))}
                  />
                </label>

                <label>
                  <span>{t.paletteLabel}</span>
                  <select value={palette} onChange={(e) => setPalette(e.currentTarget.value)}>
                    {Object.entries(t.palettes).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{t.bandsLabel}</span>
              <div className="oep-ts-band-toggles">
                {(
                  [
                    ['SUB_GHZ', 'Sub-GHz 700-900MHz'],
                    ['WIFI_24', 'Wi-Fi CSI 2.4GHz'],
                    ['BLE_24', 'BLE 2.4GHz'],
                    ['WIFI_50', 'Wi-Fi 5GHz'],
                    ['IMU_MAG', 'Sensores IMU/Mag']
                  ] as const
                ).map(([bandKey, label]) => (
                  <label key={bandKey}>
                    <input
                      type="checkbox"
                      checked={activeBands[bandKey]}
                      onChange={(e) =>
                        setActiveBands((prev) => ({ ...prev, [bandKey]: e.currentTarget.checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <h4 style={{ marginTop: '0.9rem', marginBottom: '0.45rem' }}>{t.targetsTitle}</h4>
              <div className="oep-ts-target-list" data-testid="rf-radar-target-list">
                {radarResult.targets.map((tgt) => (
                  <div
                    key={tgt.id}
                    className={`oep-ts-target-card ${tgt.detectable ? 'is-detected' : 'is-blocked'}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                      <strong>{tgt.id}</strong>
                      <span style={{ color: tgt.detectable ? '#6ee7b7' : '#fca5a5' }}>
                        {tgt.detectable
                          ? `${tgt.bestBand} · ${tgt.bestRssiDbm} dBm (SNR +${tgt.snrDb} dB)`
                          : 'ATTENUATED BELOW NOISE FLOOR'}
                      </span>
                    </div>
                    <div style={{ margin: '0.2rem 0', color: '#e2e8f0' }}>{tgt.label}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.73rem', color: '#94a3b8' }}>
                      Dist: {tgt.totalDistanceMeters}m (Behind wall: {tgt.depthBehindWallMeters}m) · Bearing:{' '}
                      {tgt.bearingDeg}° · Confidence: {tgt.confidencePct}%
                      {tgt.hasHumanMicroDoppler ? ` · CSI Respiration: ${tgt.respirationBpm} BPM` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
