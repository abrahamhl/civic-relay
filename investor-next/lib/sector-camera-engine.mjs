/**
 * Sector Intelligence, Authorized Public Camera Contracts, Anti-SSRF/RBAC Guardrails,
 * and Causal Decision Explainer for Civic Relay / OEP.
 *
 * SCIENTIFIC & OPERATIONAL BOUNDARIES:
 * - Video or camera metadata is an OBSERVATIONAL layer only; it never triggers automatic
 *   SOS generation, never identifies individuals (zero facial recognition, zero LPR/OCR),
 *   and never dispatches 112 emergency services.
 * - Camera FOV cones are geometric estimates from azimuth/range metadata (`calibrated: false`).
 * - Feeds without live institutional license or CORS-enabled open snapshot streams are
 *   explicitly labeled `SYNTHETIC`, `STALE`, `NO_SIGNAL`, or `PUBLIC_CATALOG_VERIFIED`.
 */
import { runScenario } from './emergency-routing.mjs';
import { createStoreForwardEngine, createInMemoryAdapter } from './store-forward.mjs';

export const EVIDENCE_LABELS = Object.freeze({
  LIVE_THIRD_PARTY: 'LIVE THIRD-PARTY DATA — SOURCE/TIMESTAMP',
  REAL_CODE_LOCAL_LAB: 'REAL CODE / LOCAL LAB',
  SYNTHETIC_SIMULATION: 'SYNTHETIC SIMULATION',
  PHYSICAL_FIELD_PENDING: 'PHYSICAL FIELD TEST PENDING',
  RESEARCH_CONCEPT: 'RESEARCH CONCEPT',
  UNAVAILABLE_NO_PERMISSION: 'UNAVAILABLE / NO PERMISSION'
});

export const ALLOWED_CAMERA_DOMAINS = Object.freeze([
  'infocar.dgt.es',
  'nap.dgt.es',
  'www.dgt.es',
  'rwsverkeersinfo.nl',
  'www.rijkswaterstaat.nl'
]);

export const CELESTIAL_BODIES = Object.freeze({
  EARTH: {
    id: 'EARTH',
    name: { es: 'Tierra (Topología OEP)', en: 'Earth (OEP Topology)', nl: 'Aarde (OEP-topologie)' },
    radiusKm: 6371,
    oepActive: true,
    evidenceLabel: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
    palette: { primary: '#112d42', secondary: '#254f61', atmosphere: '#5ab4d5', wire: '#74d0e1' },
    notice: {
      es: 'Superficie principal de simulación: sectores, nodos voluntarios, colas locales y rutas deterministas.',
      en: 'Primary simulation surface: sectors, opt-in nodes, local queues and deterministic routes.',
      nl: 'Primair simulatieoppervlak: sectoren, opt-in nodes, lokale wachtrijen en deterministische routes.'
    }
  },
  MOON: {
    id: 'MOON',
    name: { es: 'Luna (Exploración 3D educativa)', en: 'Moon (Educational 3D Explore)', nl: 'Maan (Educatieve 3D-verkenning)' },
    radiusKm: 1737.4,
    oepActive: false,
    evidenceLabel: EVIDENCE_LABELS.RESEARCH_CONCEPT,
    palette: { primary: '#2d3138', secondary: '#555b66', atmosphere: '#9ca3af', wire: '#94a3b8' },
    notice: {
      es: 'MODO EDUCATIVO ESPACIAL: Visualización astronómica 3D para inspección libre. Civic Relay / OEP NO opera en la Luna ni tiene nodos lunares.',
      en: 'EDUCATIONAL SPACE MODE: 3D planetary visualization for free inspection. Civic Relay / OEP does NOT operate on the Moon and has no lunar nodes.',
      nl: 'EDUCATIEVE RUIMTEMODUS: 3D-visualisatie voor vrije inspectie. Civic Relay / OEP werkt NIET op de Maan en heeft geen maannodes.'
    }
  },
  MARS: {
    id: 'MARS',
    name: { es: 'Marte (Exploración 3D educativa)', en: 'Mars (Educational 3D Explore)', nl: 'Mars (Educatieve 3D-verkenning)' },
    radiusKm: 3389.5,
    oepActive: false,
    evidenceLabel: EVIDENCE_LABELS.RESEARCH_CONCEPT,
    palette: { primary: '#4a2118', secondary: '#8c3f2b', atmosphere: '#e07a5f', wire: '#f4a261' },
    notice: {
      es: 'MODO EDUCATIVO ESPACIAL: Visualización planetaria 3D de geometría y retícula. Civic Relay / OEP NO opera en Marte ni reclama enlaces interplanetarios.',
      en: 'EDUCATIONAL SPACE MODE: 3D planetary geometry and reticle inspection. Civic Relay / OEP does NOT operate on Mars and claims no interplanetary links.',
      nl: 'EDUCATIEVE RUIMTEMODUS: 3D-planetaire inspectie. Civic Relay / OEP werkt NIET op Mars en claimt geen interplanetaire verbindingen.'
    }
  }
});

/**
 * Pilot & synthetic geographic sectors with GeoJSON polygons and deterministic scenario presets.
 * Includes El Tiemblo (Ávila) explicitly mentioned in the founder's original voice vision (00:01:08-00:01:18).
 */
export const PILOT_SECTORS = Object.freeze([
  {
    id: 'SECTOR-AVILA-TIEMBLO',
    code: 'ES-AV-01',
    name: 'El Tiemblo · Valle del Alberche',
    region: 'Ávila · Castilla y León',
    country: 'ES',
    continent: 'EU',
    center: [40.4167, -4.5000],
    zoomScore: 2.3,
    source: 'IGN/CNIG Cartografía Pública + Escenario Sintético OEP',
    authenticity: 'PUBLIC_CARTOGRAPHY_WITH_SYNTHETIC_INCIDENT',
    evidenceLabel: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
    incidentType: 'WILDFIRE',
    updatedAt: '2026-10-22T06:00:00Z',
    permittedScope: 'PUBLIC_DEMO_AND_OPEN_ROAD_METADATA',
    defaultScenarioParams: {
      seed: 20261022,
      devices: 50,
      participation: 80,
      permissions: 85,
      battery: 60,
      damaged: 85,
      responses: 12,
      helpRequests: 3,
      bluetooth: true,
      wifi: true,
      gateway: true
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-4.565, 40.385],
        [-4.435, 40.385],
        [-4.435, 40.455],
        [-4.565, 40.455],
        [-4.565, 40.385]
      ]]
    },
    subSectors: [
      {
        id: 'AV-N403-NORTE',
        name: 'Corredor N-403 · Embalse del Burguillo',
        polygon: [[-4.54, 40.42], [-4.46, 40.42], [-4.46, 40.45], [-4.54, 40.45], [-4.54, 40.42]],
        towerStatus: 'DAMAGED_SYNTHETIC',
        coveragePct: 15
      },
      {
        id: 'AV-CASCO-CENTRO',
        name: 'El Tiemblo · Casco Urbano y Puesto de Mando',
        polygon: [[-4.52, 40.40], [-4.47, 40.40], [-4.47, 40.42], [-4.52, 40.42], [-4.52, 40.40]],
        towerStatus: 'DEGRADED_GATEWAY_AVAILABLE',
        coveragePct: 45
      },
      {
        id: 'AV-CASTANAR-SUR',
        name: 'Monte El Castañar · Interfaz Urbano-Forestal',
        polygon: [[-4.55, 40.385], [-4.47, 40.385], [-4.47, 40.40], [-4.55, 40.40], [-4.55, 40.385]],
        towerStatus: 'OFFLINE_SYNTHETIC',
        coveragePct: 0
      }
    ],
    description: {
      es: 'Escenario inspirado en la visión original del fundador (01:08): incendio forestal sintético cerca de El Tiemblo (Ávila) con pérdida de una antena rural y consulta de cámaras viales públicas del entorno.',
      en: 'Scenario inspired by the founder’s original voice vision (01:08): synthetic wildfire near El Tiemblo (Ávila) with rural cell-tower loss and inspection of surrounding public road cameras.',
      nl: 'Scenario geïnspireerd op de oorspronkelijke audioboodschap (01:08): gesimuleerde natuurbrand bij El Tiemblo (Ávila) met uitval van een zendmast en inspectie van openbare wegcamera’s.'
    }
  },
  {
    id: 'SECTOR-VLC-TURIA',
    code: 'ES-VLC-02',
    name: 'Valencia Sur · L’Horta Sud',
    region: 'Comunitat Valenciana',
    country: 'ES',
    continent: 'EU',
    center: [39.4200, -0.4100],
    zoomScore: 2.3,
    source: 'Cartografía Abierta + Escenario Sintético OEP',
    authenticity: 'PUBLIC_CARTOGRAPHY_WITH_SYNTHETIC_INCIDENT',
    evidenceLabel: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
    incidentType: 'FLOOD',
    updatedAt: '2026-10-22T06:00:00Z',
    permittedScope: 'PUBLIC_DEMO_AND_OPEN_ROAD_METADATA',
    defaultScenarioParams: {
      seed: 20261020,
      devices: 60,
      participation: 85,
      permissions: 80,
      battery: 45,
      damaged: 90,
      responses: 14,
      helpRequests: 4,
      bluetooth: true,
      wifi: true,
      gateway: true
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-0.465, 39.385],
        [-0.355, 39.385],
        [-0.355, 39.455],
        [-0.465, 39.455],
        [-0.465, 39.385]
      ]]
    },
    subSectors: [
      {
        id: 'VLC-PAI-01',
        name: 'Sector Barranco / Zona Residencial Sur',
        polygon: [[-0.44, 39.40], [-0.39, 39.40], [-0.39, 39.43], [-0.44, 39.43], [-0.44, 39.40]],
        towerStatus: 'OFFLINE_SYNTHETIC',
        coveragePct: 5
      },
      {
        id: 'VLC-V30-02',
        name: 'Corredor V-30 / Pasarela de Enlace',
        polygon: [[-0.43, 39.43], [-0.36, 39.43], [-0.36, 39.455], [-0.43, 39.455], [-0.43, 39.43]],
        towerStatus: 'DEGRADED_GATEWAY_AVAILABLE',
        coveragePct: 55
      }
    ],
    description: {
      es: 'Inundación repentina y apagón eléctrico sintético en zona periurbana. Evalúa cola store-and-forward y salto local hacia un gateway de borde.',
      en: 'Synthetic flash flood and power blackout in a peri-urban basin. Evaluates store-and-forward queuing and local multi-hop relay to an edge gateway.',
      nl: 'Gesimuleerde overstroming en stroomuitval in een voorstedelijk gebied. Test store-and-forward wachtrijen en lokale relay naar een randgateway.'
    }
  },
  {
    id: 'SECTOR-NL-ARNHEM',
    code: 'NL-GE-03',
    name: 'Arnhem · Nederrijn Corridor',
    region: 'Gelderland',
    country: 'NL',
    continent: 'EU',
    center: [51.9808, 5.9114],
    zoomScore: 2.3,
    source: 'PDOK / OpenGeo + Escenario Sintético OEP',
    authenticity: 'PUBLIC_CARTOGRAPHY_WITH_SYNTHETIC_INCIDENT',
    evidenceLabel: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
    incidentType: 'GRID_OUTAGE',
    updatedAt: '2026-10-22T06:00:00Z',
    permittedScope: 'PUBLIC_DEMO_AND_OPEN_ROAD_METADATA',
    defaultScenarioParams: {
      seed: 9001,
      devices: 40,
      participation: 75,
      permissions: 90,
      battery: 70,
      damaged: 100,
      responses: 10,
      helpRequests: 2,
      bluetooth: true,
      wifi: true,
      gateway: false
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [5.855, 51.955],
        [5.965, 51.955],
        [5.965, 52.010],
        [5.855, 52.010],
        [5.855, 51.955]
      ]]
    },
    subSectors: [
      {
        id: 'NL-RIJN-01',
        name: 'John Frostbrug · Nederrijn Sector',
        polygon: [[5.89, 51.97], [5.93, 51.97], [5.93, 51.985], [5.89, 51.985], [5.89, 51.97]],
        towerStatus: 'OFFLINE_SYNTHETIC',
        coveragePct: 0
      },
      {
        id: 'NL-CENTRUM-02',
        name: 'Arnhem Centraal · Knooppunt',
        polygon: [[5.88, 51.985], [5.93, 51.985], [5.93, 52.005], [5.88, 52.005], [5.88, 51.985]],
        towerStatus: 'OFFLINE_SYNTHETIC',
        coveragePct: 0
      }
    ],
    description: {
      es: 'Apagón total de red (0 rutas exteriores inicialmente) en el corredor del Rin (Países Bajos). Demuestra que con 0 rutas todo mensaje explícito queda en QUEUED_LOCAL hasta activar un gateway.',
      en: 'Total network blackout (0 external routes initially) in the Rhine corridor (Netherlands). Demonstrates that with 0 routes every explicit message remains QUEUED_LOCAL until a gateway is enabled.',
      nl: 'Volledige netwerkuitval (initieel 0 externe routes) langs de Nederrijn (Arnhem). Toont dat bij 0 routes elk expliciet bericht in QUEUED_LOCAL blijft totdat een gateway wordt geactiveerd.'
    }
  }
]);

/**
 * Authorized public camera catalog + explicit synthetic/stale/no-signal test sources.
 * Never embeds unauthorized live CCTV streams, never scrapes private cameras, and never claims facial/LPR analytics.
 */
export const CAMERA_SOURCES = Object.freeze([
  {
    id: 'CAM-DGT-N403-PK82',
    sectorId: 'SECTOR-AVILA-TIEMBLO',
    subSectorId: 'AV-N403-NORTE',
    provider: 'Ministerio del Interior / Dirección General de Tráfico (DGT — Catálogo NAP)',
    title: 'N-403 PK 82.4 · Embalse del Burguillo (El Tiemblo)',
    roadOrLandmark: 'N-403 · Acceso Norte El Tiemblo',
    coordinates: [40.4310, -4.5080],
    geoAccuracy: 'VERIFIED_PUBLIC_METRIC',
    fovEstimate: {
      azimuthDeg: 165,
      coneAngleDeg: 55,
      rangeMeters: 420,
      calibrated: false,
      note: 'Cono estimado por orientación vial N-403; sin calibración fotogramétrica intrínseca.'
    },
    streamType: 'PUBLIC_OPEN_DATA_SNAPSHOT',
    upstreamUrl: 'https://infocar.dgt.es/etraffic/',
    officialSourceUrl: 'https://infocar.dgt.es/etraffic/',
    termsUrl: 'https://www.dgt.es/conoce-la-dgt/que-hacemos/datos-abiertos/',
    license: 'RISP — Ley 37/2007 Reutilización de la Información del Sector Público (cita obligatoria de fuente y fecha, prohibido desnaturalizar o sugerir patrocinio DGT)',
    accessPolicy: 'PUBLIC_OPEN_DATA_ATTRIBUTION',
    lastSeen: '2026-10-22T05:55:00Z',
    lastFrameAt: '2026-10-22T05:55:00Z',
    freshness: 'FRESH_METADATA',
    state: 'PUBLIC_CATALOG_VERIFIED',
    attribution: 'Origen de los datos: Ministerio del Interior / Dirección General de Tráfico (DGT). Uso demostrativo sin patrocinio oficial.',
    privacyNotice: 'Plano general de tráfico; prohibido reconocimiento facial, lectura de matrículas (LPR/OCR) o seguimiento de personas.'
  },
  {
    id: 'CAM-AV-TIEMBLO-FOREST-02',
    sectorId: 'SECTOR-AVILA-TIEMBLO',
    subSectorId: 'AV-CASTANAR-SUR',
    provider: 'Maqueta Local OEP · Torre de Vigilancia Forestal Sintética',
    title: 'Mirador El Castañar · Sector Forestal Sur (Maqueta)',
    roadOrLandmark: 'Monte El Castañar · Cota 1.120 m',
    coordinates: [40.3940, -4.5180],
    geoAccuracy: 'SECTOR_APPROXIMATE',
    fovEstimate: {
      azimuthDeg: 35,
      coneAngleDeg: 70,
      rangeMeters: 650,
      calibrated: false,
      note: 'Geometría sintética de demostración para visualizar superposición de humo y cobertura de antena.'
    },
    streamType: 'SYNTHETIC_TELEMETRY_PREVIEW',
    upstreamUrl: 'https://infocar.dgt.es/etraffic/',
    officialSourceUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs',
    termsUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/LICENSE',
    license: 'MIT — Datos sintéticos de laboratorio OEP (No es una cámara física real)',
    accessPolicy: 'SYNTHETIC_DEMO_ONLY',
    lastSeen: '2026-10-22T06:00:00Z',
    lastFrameAt: '2026-10-22T06:00:00Z',
    freshness: 'SYNTHETIC',
    state: 'SYNTHETIC',
    attribution: 'Simulación sintética OEP. No representa vídeo en vivo ni detección automática de incendios.',
    privacyNotice: 'Render vectorial sintético sin captación de imágenes reales.'
  },
  {
    id: 'CAM-AV-TIEMBLO-STALE-03',
    sectorId: 'SECTOR-AVILA-TIEMBLO',
    subSectorId: 'AV-CASCO-CENTRO',
    provider: 'Maqueta Local OEP · Enlace Municipal Degradado',
    title: 'Acceso Sur N-403 · Puente Alberche (Lectura caducada / STALE)',
    roadOrLandmark: 'Puente sobre el río Alberche',
    coordinates: [40.4110, -4.4920],
    geoAccuracy: 'SECTOR_APPROXIMATE',
    fovEstimate: {
      azimuthDeg: 290,
      coneAngleDeg: 50,
      rangeMeters: 350,
      calibrated: false,
      note: 'Cono estimado; último fotograma anterior al corte de energía del sector.'
    },
    streamType: 'SYNTHETIC_TELEMETRY_PREVIEW',
    upstreamUrl: 'https://nap.dgt.es/',
    officialSourceUrl: 'https://nap.dgt.es/',
    termsUrl: 'https://www.dgt.es/conoce-la-dgt/que-hacemos/datos-abiertos/',
    license: 'Simulación de estado STALE (lectura antigua congelada tras caída de red)',
    accessPolicy: 'SYNTHETIC_DEMO_ONLY',
    lastSeen: '2026-10-22T04:12:00Z',
    lastFrameAt: '2026-10-22T04:12:00Z',
    freshness: 'STALE',
    state: 'STALE',
    attribution: 'Estado de prueba STALE (>90 min sin refresco por caída de enlace). Nunca debe mostrarse como LIVE.',
    privacyNotice: 'Sin datos personales.'
  },
  {
    id: 'CAM-AV-TIEMBLO-NOSIGNAL-04',
    sectorId: 'SECTOR-AVILA-TIEMBLO',
    subSectorId: 'AV-CASTANAR-SUR',
    provider: 'Red Operativa Restringida · Requiere Convenio Institucional',
    title: 'Repetidor Alto del Mirlo · Canal Operativo (NO SIGNAL / RBAC)',
    roadOrLandmark: 'Cuerda de la Parada',
    coordinates: [40.3890, -4.4750],
    geoAccuracy: 'SECTOR_APPROXIMATE',
    fovEstimate: {
      azimuthDeg: 10,
      coneAngleDeg: 60,
      rangeMeters: 500,
      calibrated: false,
      note: 'Cono estimado; sin señal por corte eléctrico y restricción de rol público.'
    },
    streamType: 'HLS_CONTRACT_READY',
    upstreamUrl: 'https://infocar.dgt.es/etraffic/',
    officialSourceUrl: 'https://infocar.dgt.es/etraffic/',
    termsUrl: 'https://www.dgt.es/conoce-la-dgt/que-hacemos/datos-abiertos/',
    license: 'Acceso restringido RBAC / Sin señal física en este prototipo',
    accessPolicy: 'INSTITUTIONAL_RBAC_REQUIRED',
    lastSeen: null,
    lastFrameAt: null,
    freshness: 'NO_SIGNAL',
    state: 'NO_SIGNAL',
    attribution: 'Cámara sin señal / bloqueada en vista pública. Requiere autorización institucional verificada.',
    privacyNotice: 'Bloqueado por defecto (Fail-Closed RBAC).'
  },
  {
    id: 'CAM-DGT-V30-PK6',
    sectorId: 'SECTOR-VLC-TURIA',
    subSectorId: 'VLC-V30-02',
    provider: 'Ministerio del Interior / Dirección General de Tráfico (DGT — Catálogo NAP)',
    title: 'V-30 PK 6.2 · Cauce Nuevo del Turia / Xirivella',
    roadOrLandmark: 'Autovía V-30 · Margen Sur',
    coordinates: [39.4420, -0.4050],
    geoAccuracy: 'VERIFIED_PUBLIC_METRIC',
    fovEstimate: {
      azimuthDeg: 120,
      coneAngleDeg: 55,
      rangeMeters: 450,
      calibrated: false,
      note: 'Orientación estimada sobre eje V-30; metadatos abiertos DGT.'
    },
    streamType: 'PUBLIC_OPEN_DATA_SNAPSHOT',
    upstreamUrl: 'https://infocar.dgt.es/etraffic/',
    officialSourceUrl: 'https://infocar.dgt.es/etraffic/',
    termsUrl: 'https://www.dgt.es/conoce-la-dgt/que-hacemos/datos-abiertos/',
    license: 'RISP — Ley 37/2007 Reutilización de la Información del Sector Público (DGT)',
    accessPolicy: 'PUBLIC_OPEN_DATA_ATTRIBUTION',
    lastSeen: '2026-10-22T05:52:00Z',
    lastFrameAt: '2026-10-22T05:52:00Z',
    freshness: 'FRESH_METADATA',
    state: 'PUBLIC_CATALOG_VERIFIED',
    attribution: 'Origen de los datos: Ministerio del Interior / DGT. Sin patrocinio institucional.',
    privacyNotice: 'Plano vial general; sin biometría ni lectura de matrículas.'
  },
  {
    id: 'CAM-VLC-PAI-SYNTH-02',
    sectorId: 'SECTOR-VLC-TURIA',
    subSectorId: 'VLC-PAI-01',
    provider: 'Maqueta Local OEP · Sensor Hidrológico y Visual Sintético',
    title: 'Pasarela Barranco Sur · Vista Sintética de Escenario',
    roadOrLandmark: 'Sector Residencial Sur',
    coordinates: [39.4090, -0.4180],
    geoAccuracy: 'SECTOR_APPROXIMATE',
    fovEstimate: {
      azimuthDeg: 195,
      coneAngleDeg: 65,
      rangeMeters: 380,
      calibrated: false,
      note: 'Cono estimado en escenario sintético de inundación.'
    },
    streamType: 'SYNTHETIC_TELEMETRY_PREVIEW',
    upstreamUrl: 'https://nap.dgt.es/',
    officialSourceUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs',
    termsUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/LICENSE',
    license: 'MIT — Escenario sintético OEP',
    accessPolicy: 'SYNTHETIC_DEMO_ONLY',
    lastSeen: '2026-10-22T06:00:00Z',
    lastFrameAt: '2026-10-22T06:00:00Z',
    freshness: 'SYNTHETIC',
    state: 'SYNTHETIC',
    attribution: 'Simulación sintética OEP para pruebas de interfaz.',
    privacyNotice: 'Sin captación de vídeo real.'
  },
  {
    id: 'CAM-NL-RWS-A325',
    sectorId: 'SECTOR-NL-ARNHEM',
    subSectorId: 'NL-RIJN-01',
    provider: 'Rijkswaterstaat Verkeersinformatie (Public Corridor Metadata)',
    title: 'N325 / Pleijroute · Nederrijn Sector (Arnhem)',
    roadOrLandmark: 'N325 / Nederrijn Corridor',
    coordinates: [51.9745, 5.9210],
    geoAccuracy: 'VERIFIED_PUBLIC_METRIC',
    fovEstimate: {
      azimuthDeg: 310,
      coneAngleDeg: 50,
      rangeMeters: 400,
      calibrated: false,
      note: 'Estimated corridor cone along N325 bridge approach; uncalibrated.'
    },
    streamType: 'PUBLIC_OPEN_DATA_SNAPSHOT',
    upstreamUrl: 'https://www.rwsverkeersinfo.nl/',
    officialSourceUrl: 'https://www.rwsverkeersinfo.nl/',
    termsUrl: 'https://www.rijkswaterstaat.nl/over-ons/open-data',
    license: 'CC0 / Dutch Open Government Data Policy (Rijkswaterstaat metadata reference)',
    accessPolicy: 'PUBLIC_OPEN_DATA_ATTRIBUTION',
    lastSeen: '2026-10-22T05:50:00Z',
    lastFrameAt: '2026-10-22T05:50:00Z',
    freshness: 'FRESH_METADATA',
    state: 'PUBLIC_CATALOG_VERIFIED',
    attribution: 'Source reference: Rijkswaterstaat Verkeersinformatie (NL). No institutional endorsement.',
    privacyNotice: 'Macro traffic corridor metadata only; no personal tracking.'
  },
  {
    id: 'CAM-NL-ARNHEM-NOSIGNAL-02',
    sectorId: 'SECTOR-NL-ARNHEM',
    subSectorId: 'NL-CENTRUM-02',
    provider: 'Maqueta Local OEP · Nodo Urbano Sin Alimentación',
    title: 'Arnhem Centraal Sector · Sin Señal por Apagón Sintético',
    roadOrLandmark: 'Stationsplein (Synthetic Outage)',
    coordinates: [51.9840, 5.9020],
    geoAccuracy: 'SECTOR_APPROXIMATE',
    fovEstimate: {
      azimuthDeg: 90,
      coneAngleDeg: 60,
      rangeMeters: 300,
      calibrated: false,
      note: 'Cono estimado sin señal activa en el escenario.'
    },
    streamType: 'SYNTHETIC_TELEMETRY_PREVIEW',
    upstreamUrl: 'https://www.rwsverkeersinfo.nl/',
    officialSourceUrl: 'https://www.rwsverkeersinfo.nl/',
    termsUrl: 'https://www.rijkswaterstaat.nl/over-ons/open-data',
    license: 'MIT — Simulación de fallo eléctrico total',
    accessPolicy: 'SYNTHETIC_DEMO_ONLY',
    lastSeen: '2026-10-22T03:00:00Z',
    lastFrameAt: null,
    freshness: 'NO_SIGNAL',
    state: 'NO_SIGNAL',
    attribution: 'Estado NO_SIGNAL simulado durante apagón de red.',
    privacyNotice: 'Sin señal ni datos personales.'
  }
]);

/**
 * Validates a camera upstream URL against SSRF, private IP ranges, credentials, and domain allowlists.
 */
export function validateCameraUpstreamUrl(rawUrl, { allowlist = ALLOWED_CAMERA_DOMAINS } = {}) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > 512) {
    return { allowed: false, reason: 'INVALID_URL_FORMAT' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'MALFORMED_URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'NON_HTTPS_PROTOCOL_BLOCKED' };
  }
  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'EMBEDDED_CREDENTIALS_BLOCKED' };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    /^(fc|fd|fe80):/i.test(host) ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return { allowed: false, reason: 'SSRF_PRIVATE_OR_IP_LITERAL_BLOCKED' };
  }
  const isAllowlisted = allowlist.some(d => host === d.toLowerCase());
  if (!isAllowlisted) {
    return { allowed: false, reason: 'FAIL_CLOSED_DOMAIN_NOT_ALLOWLISTED', hostname: host };
  }
  return {
    allowed: true,
    reason: 'ALLOWLISTED_PUBLIC_HTTPS_SOURCE',
    hostname: host,
    normalizedUrl: parsed.toString()
  };
}

/**
 * Enforces RBAC and biometric/surveillance prohibition for any camera source.
 */
export function checkSectorAccessPolicy({
  camera,
  role = 'PUBLIC_VISITOR',
  institutionAuthorized = false
} = {}) {
  if (!camera || typeof camera !== 'object') {
    return { permitted: false, status: 'INVALID_CAMERA_SOURCE', evidenceLabel: EVIDENCE_LABELS.UNAVAILABLE_NO_PERMISSION };
  }
  const privacyGuard = Object.freeze({
    facialRecognitionAllowed: false,
    licensePlateOcrAllowed: false,
    individualTrackingAllowed: false,
    autoDispatchFromVideoAllowed: false
  });
  if (camera.accessPolicy === 'INSTITUTIONAL_RBAC_REQUIRED') {
    if (role !== 'INSTITUTIONAL_OPERATOR' || institutionAuthorized !== true) {
      return {
        permitted: false,
        status: 'RBAC_BLOCKED_PUBLIC_VIEW',
        evidenceLabel: EVIDENCE_LABELS.UNAVAILABLE_NO_PERMISSION,
        privacyGuard
      };
    }
  }
  const urlCheck = validateCameraUpstreamUrl(camera.upstreamUrl);
  if (!urlCheck.allowed) {
    return {
      permitted: false,
      status: urlCheck.reason,
      evidenceLabel: EVIDENCE_LABELS.UNAVAILABLE_NO_PERMISSION,
      privacyGuard
    };
  }
  return {
    permitted: true,
    status: camera.state,
    freshness: camera.freshness,
    evidenceLabel:
      camera.state === 'PUBLIC_CATALOG_VERIFIED'
        ? EVIDENCE_LABELS.LIVE_THIRD_PARTY
        : EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
    privacyGuard
  };
}

/**
 * Computes an estimated 2D GeoJSON FOV cone polygon from camera coordinates and azimuth/angle metadata.
 * Explicitly flags `calibrated: false` so UI never misrepresents estimated geometry as surveyed coverage.
 */
export function computeFovPolygon(coordinates, fovEstimate, steps = 8) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || !fovEstimate) {
    throw new Error('Invalid camera coordinates or fovEstimate');
  }
  const [lat, lon] = coordinates;
  const azimuth = Number(fovEstimate.azimuthDeg) || 0;
  const cone = Math.max(10, Math.min(160, Number(fovEstimate.coneAngleDeg) || 50));
  const rangeMeters = Math.max(50, Math.min(5000, Number(fovEstimate.rangeMeters) || 350));
  const latRad = (lat * Math.PI) / 180;
  const degLatPerMeter = 1 / 111320;
  const degLonPerMeter = 1 / (111320 * Math.max(0.2, Math.cos(latRad)));
  const startAngle = azimuth - cone / 2;
  const endAngle = azimuth + cone / 2;
  const ring = [[lon, lat]];
  for (let i = 0; i <= steps; i++) {
    const bearingDeg = startAngle + ((endAngle - startAngle) * i) / steps;
    const bearingRad = (bearingDeg * Math.PI) / 180;
    const dNorth = Math.cos(bearingRad) * rangeMeters * degLatPerMeter;
    const dEast = Math.sin(bearingRad) * rangeMeters * degLonPerMeter;
    ring.push([
      Math.round((lon + dEast) * 1e5) / 1e5,
      Math.round((lat + dNorth) * 1e5) / 1e5
    ]);
  }
  ring.push([lon, lat]);
  return {
    type: 'Feature',
    properties: {
      calibrated: false,
      estimationType: 'METADATA_AZIMUTH_CONE_ESTIMATE',
      azimuthDeg: azimuth,
      coneAngleDeg: cone,
      rangeMeters
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring]
    }
  };
}

/**
 * Pluggable local adapter that separates `Sector`, `CameraSource`, `Observation`, `RelayNode` and `RouteDecision`.
 */
export function createSectorCameraAdapter({
  role = 'PUBLIC_VISITOR',
  institutionAuthorized = false,
  now = () => Date.parse('2026-10-22T06:00:00Z')
} = {}) {
  return {
    listSectors() {
      return PILOT_SECTORS.map(s => ({ ...s }));
    },
    getSector(sectorId) {
      const sector = PILOT_SECTORS.find(s => s.id === sectorId) || PILOT_SECTORS[0];
      const cameras = CAMERA_SOURCES.filter(c => c.sectorId === sector.id).map(cam => {
        const access = checkSectorAccessPolicy({ camera: cam, role, institutionAuthorized });
        const fovFeature = computeFovPolygon(cam.coordinates, cam.fovEstimate);
        const ageMs = cam.lastFrameAt ? Math.max(0, now() - Date.parse(cam.lastFrameAt)) : null;
        return {
          ...cam,
          access,
          fovFeature,
          ageMinutes: ageMs !== null ? Math.round(ageMs / 60000) : null
        };
      });
      return { sector, cameras };
    },
    /**
     * Generates a complete, auditable decision trace coupling the sector's synthetic incident
     * with `runScenario()` and `createStoreForwardEngine()`.
     * Never infers human casualties or SOS from camera observations.
     */
    explainSectorDecision(sectorId, scenarioOverrides = {}) {
      const { sector, cameras } = this.getSector(sectorId);
      const params = { ...sector.defaultScenarioParams, ...scenarioOverrides };
      const sim = runScenario(params);

      let clockMs = now();
      const sf = createStoreForwardEngine({
        now: () => clockMs,
        retryMs: 2000,
        maxAttempts: 4,
        energyProfile: sim.summary.energyProfile
      });
      const localGateway = createInMemoryAdapter({
        id: 'SECTOR_EDGE_GATEWAY',
        available: params.gateway !== false && (params.bluetooth !== false || params.wifi !== false),
        receipts: true,
        reliability: 0.9,
        latencyMs: 140
      });
      sf.registerAdapter(localGateway);

      const sampleId = `SEC-${sector.code}-SOS-01`;
      sf.enqueue({
        id: sampleId,
        category: 'SOS_EXPLICIT',
        createdAt: clockMs,
        ttlSeconds: 3600,
        consented: true,
        destination: 'LAB_CENTRE',
        payload: { sectorId: sector.id, explicitUserAction: true }
      });

      const verifiedCameras = cameras.filter(c => c.state === 'PUBLIC_CATALOG_VERIFIED').length;
      const syntheticCameras = cameras.filter(c => c.state === 'SYNTHETIC').length;
      const staleOrNoSignal = cameras.filter(c => c.state === 'STALE' || c.state === 'NO_SIGNAL').length;

      return {
        kind: 'OEP_SECTOR_CAUSAL_TRACE_V1',
        sectorId: sector.id,
        sectorName: sector.name,
        incidentType: sector.incidentType,
        parameters: params,
        simulationSummary: sim.summary,
        simulationResult: sim,
        observationalLayer: {
          totalCameras: cameras.length,
          verifiedCatalogCount: verifiedCameras,
          syntheticDemoCount: syntheticCameras,
          staleOrNoSignalCount: staleOrNoSignal,
          inferHumanPositionFromVideo: false,
          autoDispatchFromVideo: false,
          separationRule: 'OBSERVATIONAL_ONLY_NEVER_TRIGGERS_SOS_OR_112'
        },
        causalChain: [
          {
            step: '01_CAUSE',
            label: 'Causa / Incidente del escenario',
            detail: `${sector.incidentType} en ${sector.name}: ${params.damaged}% de infraestructura celular caída; perfil energético ${sim.summary.energyProfile}.`,
            evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION
          },
          {
            step: '02_OBSERVATION_AND_CONSENT',
            label: 'Datos recibidos (Separación Observación vs Participación)',
            detail: `${sim.summary.participating}/${sim.summary.totalDevices} nodos participan voluntariamente (${sim.summary.permissioned} con permiso de relé). ${sim.summary.humanSafe} SAFE explícitos, ${sim.summary.humanSOS} SOS explícitos, ${sim.summary.humanUnknown} UNKNOWN (silencio ≠ víctima). Cámaras del sector (${cameras.length}) aportan contexto visual separado sin inferir identidades.`,
            evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB
          },
          {
            step: '03_RULE_ENGINE',
            label: 'Regla aplicada ("Policía de tráfico" OEP)',
            detail: `Prioriza SOS_EXPLICIT sobre tráfico ordinario, bloquea nodos con batería CRITICAL como intermediarios y evalúa rutas disponibles (BLE=${params.bluetooth !== false}, Wi-Fi=${params.wifi !== false}, Gateway=${params.gateway !== false}).`,
            evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB
          },
          {
            step: '04_OUTCOME',
            label: 'Resultado en cola y enrutamiento',
            detail: `${sim.summary.syntheticAcks} mensajes alcanzan ACK_SYNTHETIC (${sim.summary.cellularOnlyAcks} vía celular simulado, ${sim.summary.simulatedLocalGatewayAcks} vía saltos locales al gateway) y ${sim.summary.queued} permanecen protegidos en QUEUED_LOCAL con TTL=3600s.`,
            evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION
          },
          {
            step: '05_CERTAINTY_AND_HUMAN_GAP',
            label: 'Grado de certeza y qué falta para un operador humano',
            detail: 'Certeza del modelo matemático: 100% determinista (semilla reproducible). Certeza física en campo: PENDIENTE (0 ensayos Android↔Android medidos, sin integración 112 ni verificación oficial CAP). Un coordinador humano debe verificar fuentes oficiales antes de actuar.',
            evidence: EVIDENCE_LABELS.PHYSICAL_FIELD_PENDING
          }
        ]
      };
    }
  };
}
