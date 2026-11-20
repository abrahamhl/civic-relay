import { REPO_URL, type EvidenceStatus, type LocalizedText } from './types';

export interface ScienceModuleItem {
  id: string;
  tag: LocalizedText;
  title: LocalizedText;
  hypothesis: LocalizedText;
  method: LocalizedText;
  result: LocalizedText;
  status: EvidenceStatus;
  evidenceId: string;
  paperHref: string;
  paperLabel: LocalizedText;
  viewerHref?: string;
  viewerLabel?: LocalizedText;
}

export interface PaperEntry {
  id: string;
  title: LocalizedText;
  tag: LocalizedText;
  summary: LocalizedText;
  formula: string;
  href: string;
  evidenceId: string;
  bibtex: string;
}

export interface ArchitecturalRender {
  id: string;
  title: LocalizedText;
  caption: LocalizedText;
  src: string;
}

export const ARCHITECTURAL_RENDERS: ArchitecturalRender[] = [
  {
    id: 'render-paer',
    title: { en: 'PAER Mesh Topology', es: 'Topología Mesh PAER', nl: 'PAER Mesh-topologie' },
    caption: { en: 'Physics-aware opportunistic routing around hazard fronts', es: 'Enrutamiento oportunista consciente de frentes de peligro', nl: 'Fysicabewuste opportunistische routering rond gevaarfronten' },
    src: '/media/renders/render-paer-mesh-topology.svg'
  },
  {
    id: 'render-4d-globe',
    title: { en: 'SENDA 4D Spatial-Temporal Globe', es: 'Globo 4D Espacio-Temporal', nl: 'SENDA 4D Ruimte-Tijd Globe' },
    caption: { en: 'Multi-source orbital, terrain, and corridor fusion', es: 'Fusión orbital, orográfica y de corredores', nl: 'Fusie van satelliet-, terrein- en corridorlagen' },
    src: '/media/renders/render-senda-4d-globe.svg'
  },
  {
    id: 'render-merkle',
    title: { en: 'RFC 6962 Merkle Audit Proof', es: 'Prueba Merkle RFC 6962', nl: 'RFC 6962 Merkle Auditbewijs' },
    caption: { en: 'Tamper-evident ledger for signed emergency receipts', es: 'Registro inmutable para recibos de emergencia firmados', nl: 'Manipulatiebestendig grootboek voor ondertekende ACK’s' },
    src: '/media/renders/render-merkle-rfc6962-proof.svg'
  },
  {
    id: 'render-itu-rain',
    title: { en: 'ITU-R P.838-3 Rain Attenuation Curve', es: 'Curva de atenuación por lluvia ITU-R P.838-3', nl: 'ITU-R P.838-3 Regendempingscurve' },
    caption: { en: 'Frequency-dependent rain fade budgets across RF & NTN bands', es: 'Balances de atenuación por lluvia en bandas RF y NTN', nl: 'Frequentieafhankelijke regendemping op RF- en NTN-banden' },
    src: '/media/renders/render-itu-p838-rain-curve.svg'
  },
  {
    id: 'render-rail',
    title: { en: 'Rail Safety Fusion Topology', es: 'Topología de seguridad ferroviaria', nl: 'Spoorveiligheids-topologie' },
    caption: { en: 'Multi-train passenger handset crash aggregation', es: 'Agregación multi-tren de avisos desde móviles de pasajeros', nl: 'Multi-trein passagiersfusie bij spoorincidenten' },
    src: '/media/renders/render-rail-safety-topology.svg'
  },
  {
    id: 'render-v16',
    title: { en: 'V16 C-ITS Reflex Latency', es: 'Latencia refleja V16 C-ITS', nl: 'V16 C-ITS Reflexlatentie' },
    caption: { en: 'Corridor hazard warning propagation across connected beacons', es: 'Propagación de alertas viales en corredores conectados', nl: 'Corridorwaarschuwingen via verbonden bakens' },
    src: '/media/renders/render-v16-reflex-latency.svg'
  },
  {
    id: 'render-cots',
    title: { en: 'COTS Edge Gateway Hardware', es: 'Hardware pasarela COTS', nl: 'COTS Edge Gateway Hardware' },
    caption: { en: 'Low-cost ESP32 / LoRa / BLE field relay companion architecture', es: 'Arquitectura de bajo coste con ESP32 / LoRa / BLE para campo', nl: 'Betaalbare ESP32 / LoRa / BLE veldgateway-architectuur' },
    src: '/media/renders/render-cots-gateway-hardware.svg'
  }
];

export const SCIENCE_MODULES: ScienceModuleItem[] = [
  {
    id: 'senda-3d',
    tag: { en: 'Wildfire 3D · Mass-Consistent Wind', es: 'Fuego 3D · Viento con conservación de masa', nl: 'Natuurbrand 3D · Massaconsistente wind' },
    title: {
      en: 'SENDA-3D: Offline 3D wind field, Briggs plume & Sentinel-2 scar assimilation',
      es: 'SENDA-3D: Campo de viento 3D offline, pluma de Briggs y asimilación Sentinel-2',
      nl: 'SENDA-3D: Offline 3D-windveld, Briggs-pluim & Sentinel-2-assimilatie'
    },
    hypothesis: {
      en: 'Fusing open NOAA GFS profiles, Copernicus DEM GLO-30, Sentinel-2 burn scars, and opportunistic fleet/camera sensors enables phone-local 3D fire modeling.',
      es: 'Combinar perfiles NOAA GFS, Copernicus DEM GLO-30, cicatrices Sentinel-2 y sensores de coches y cámaras permite modelado 3D de incendios en el propio teléfono.',
      nl: 'Fusie van NOAA GFS, Copernicus DEM GLO-30, Sentinel-2 en voertuigsensoren maakt 3D-brandmodellering direct op het toestel mogelijk.'
    },
    method: {
      en: 'Anisotropic Poisson wind solver (SOR ω=1.85), Briggs buoyancy plume, Dijkstra 16-neighbor spread, and EnKF traffic-camera fusion tested on 14 documented wildfires.',
      es: 'Ecuación de Poisson anisótropa (SOR ω=1,85), pluma de Briggs, propagación Dijkstra y filtro Kalman (EnKF) con cámaras sobre 14 incendios reales documentados.',
      nl: 'Anisotrope Poisson-windoplosser (SOR ω=1,85), Briggs-pluim, Dijkstra en EnKF-verkeersfusie over 14 gedocumenteerde natuurbranden.'
    },
    result: {
      en: 'Assimilating the 868 ha Sentinel-2 scar (San Martín, 23-07-2026) elevates Jaccard to 0.352 with 100% scar coverage inside P>=50%; 3-camera plume triangulation achieves 42 m base accuracy and 32-car wind estimation reaches 0.96 m/s median error.',
      es: 'La asimilación de la cicatriz Sentinel-2 de 868 ha (San Martín, 23-07-2026) alcanza Jaccard 0,352 con el 100 % dentro de P≥50 %; la triangulación con 3 cámaras sitúa la columna a 42 m y 32 coches estiman el viento con 0,96 m/s de error mediano.',
      nl: 'Assimilatie van het 868 ha Sentinel-2-litteken bereikt Jaccard 0,352 met 100% binnen P≥50%; 3-camera triangulatie haalt 42 m nauwkeurigheid en 32 auto’s schatten wind op 0,96 m/s.'
    },
    status: 'observed',
    evidenceId: 'EV-FIRE-SMV',
    paperHref: '/senda/paper.html',
    paperLabel: { en: 'Read SENDA-3D paper', es: 'Leer paper SENDA-3D', nl: 'Lees SENDA-3D-paper' },
    viewerHref: '/senda/fuego3d.html',
    viewerLabel: { en: 'Open 3D Fire Viewer', es: 'Abrir Visor Fuego 3D', nl: 'Open 3D-brandviewer' }
  },
  {
    id: 'arr-dtn',
    tag: { en: 'DTN Routing · H-ARR-R', es: 'Enrutamiento DTN · H-ARR-R', nl: 'DTN-routering · H-ARR-R' },
    title: {
      en: 'Receding-horizon custodian planning & cryptographic ACK gossip',
      es: 'Planificación de custodia móvil (ARR_REPLAN_V2) y gossip de ACK',
      nl: 'Receding-horizon beheerplanning & cryptografische ACK-gossip'
    },
    hypothesis: {
      en: 'Adaptive replanning with receipt-driven buffer purging achieves near-epidemic delivery inside strict radio airtime and battery envelopes.',
      es: 'La replanificación adaptativa con purga por recibos firmados logra entrega cercana a Epidemic dentro de cuotas estrictas de aire y batería.',
      nl: 'Adaptieve herplanning met ACK-gedreven opschoning bereikt bijna-epidemische bezorging binnen strikte energiebudgetten.'
    },
    method: {
      en: '120 independent disruption blocks benchmarking WAIT, CGR_EARLIEST, PROPHET_WARM, SPRAY_AND_FOCUS, EPIDEMIC_CAPPED, ARR_REPLAN_V2, and EPIDEMIC_CEILING.',
      es: '120 bloques independientes comparando WAIT, CGR_EARLIEST, PROPHET_WARM, SPRAY_AND_FOCUS, EPIDEMIC y ARR_REPLAN_V2.',
      nl: '120 onafhankelijke blokken ter vergelijking van 7 DTN-strategieën.'
    },
    result: {
      en: 'ARR_REPLAN_V2 achieves 94.2% delivery at 694 mJ mean energy (5.4 tx) — 84% less energy than EPIDEMIC_CEILING (4,420 mJ) with zero security invariant violations.',
      es: 'ARR_REPLAN_V2 alcanza 94,2 % de entrega con 694 mJ (5,4 transmisiones) — un 84 % menos de energía que EPIDEMIC_CEILING (4.420 mJ) y 0 violaciones de seguridad.',
      nl: 'ARR_REPLAN_V2 behaalt 94,2% bezorging bij 694 mJ (5,4 tx) — 84% zuiniger dan EPIDEMIC_CEILING met 0 beveiligingsschendingen.'
    },
    status: 'simulated',
    evidenceId: 'EV-ARR-V2',
    paperHref: '/senda/papers/paper-paer-dtn.html',
    paperLabel: { en: 'Read PAER-DTN paper', es: 'Leer paper PAER-DTN', nl: 'Lees PAER-DTN-paper' },
    viewerHref: '/senda/red.html',
    viewerLabel: { en: 'Open Multi-Carrier Lab', es: 'Abrir lab Multiportador', nl: 'Open netwerklab' }
  },
  {
    id: 'h-fire-b',
    tag: { en: 'Satellite Physics · H-FIRE-B', es: 'Física Satelital · H-FIRE-B', nl: 'Satellietfysica · H-FIRE-B' },
    title: {
      en: 'Causal GOES-R + HRRR upwind level-set benchmark across 6 external fires',
      es: 'Evaluación causal GOES-R + HRRR con level-set en 6 incendios reales',
      nl: 'Causale GOES-R + HRRR upwind level-set benchmark op 6 branden'
    },
    hypothesis: {
      en: 'Monotone upwind level-set advection driven by causal HRRR wind captures directional spread over real GOES-R thermal footprints.',
      es: 'La advección level-set upwind con viento causal HRRR captura la dirección del frente sobre detecciones térmicas reales GOES-R.',
      nl: 'Upwind level-set met causale HRRR-wind vangt de voortplantingsrichting op echte GOES-R-detecties.'
    },
    method: {
      en: 'Causal 3 h horizon over 6 external fires (Palisades, Eaton, Marshall, Smokehouse, Troublesome, Creek) with 10,000-replica bootstrap.',
      es: 'Horizonte causal de 3 h sobre 6 incendios externos (Palisades, Eaton, Marshall, Smokehouse, Troublesome, Creek) con bootstrap de 10.000 réplicas.',
      nl: 'Causale 3-uurshorizon op 6 externe branden met 10.000-bootstrap.'
    },
    result: {
      en: 'Beats isotropic same-area spread in 5/6 incidents (Δ growth-CSI +0.0184, 95% CI [-0.0022, +0.0440]); exploratory stage expanding toward >=10 DEM+fuel incidents.',
      es: 'Supera al crecimiento isotrópico en 5 de 6 incidentes (Δ growth-CSI +0,0184, IC 95 % [-0,0022, +0,0440]); investigación exploratoria en expansión hacia ≥10 incendios con DEM y combustible.',
      nl: 'Overtreft isotrope groei in 5 van 6 incidenten (Δ growth-CSI +0,0184); verkennende fase richting ≥10 incidenten met DEM- en brandstofkaarten.'
    },
    status: 'predicted',
    evidenceId: 'EV-FIRE-HFIREB',
    paperHref: `${REPO_URL}/blob/master/experimental/senda-fire-physics/results/FIRE_REAL_CASES_RESULTS.md`,
    paperLabel: { en: 'Read H-FIRE-B dataset report', es: 'Leer informe H-FIRE-B', nl: 'Lees H-FIRE-B-rapport' },
    viewerHref: '/senda/visor.html',
    viewerLabel: { en: 'Open 4D Scientific Viewer', es: 'Abrir Visor 4D', nl: 'Open 4D-viewer' }
  },
  {
    id: 'rail-fusion',
    tag: { en: 'Rail & C-ITS · Multi-Train Fusion', es: 'Ferrocarril y C-ITS · Fusión multi-tren', nl: 'Spoor & C-ITS · Multi-trein fusie' },
    title: {
      en: 'Passenger handset crash fusion & privacy-preserving YOLOX traffic flow',
      es: 'Fusión de impactos en ferrocarril y conteo vial YOLOX + ByteTrack',
      nl: 'Passagiers-crashfusie op het spoor & YOLOX verkeersanalyse'
    },
    hypothesis: {
      en: 'Combining passenger deceleration detection with a 20-30 s check-in locates multi-train derailments in under a minute even at 5% adoption.',
      es: 'Combinar detección de desaceleración con cuenta atrás de 20-30 s identifica un segundo convoy descarrilado en menos de un minuto incluso con 5 % de adopción.',
      nl: 'Combinatie van impactdetectie en 20-30 s check-in lokaliseert meervoudige treinontsporingen binnen een minuut bij 5% adoptie.'
    },
    method: {
      en: 'False-positive filters (phone drop, braking, bumps), 8-seed two-train fusion scenario, and live YOLOX-s + ByteTrack vehicle counting on TfL/Caltrans feeds.',
      es: 'Filtros de falsos positivos, escenario de dos trenes en 8 semillas y visión real YOLOX-s + ByteTrack sobre cámaras TfL/Caltrans sin matrículas.',
      nl: 'Foutpositievenfilters, tweetreinenscenario over 8 seeds en echte YOLOX-s + ByteTrack-analyse op TfL/Caltrans-camera’s.'
    },
    result: {
      en: 'Second train identified in 30-41 s across all 8 seeds; real Caltrans & TfL camera feeds processed with on-device vehicle counts and zero stored plates.',
      es: 'Segundo tren identificado en 30-41 s en las 8 semillas; cámaras reales Caltrans y TfL procesadas con conteo en local y cero almacenamiento de matrículas.',
      nl: 'Tweede trein geïdentificeerd in 30-41 s over alle 8 seeds; echte Caltrans- en TfL-feeds verwerkt met lokale tellingen.'
    },
    status: 'simulated',
    evidenceId: 'EV-RAIL-ADAMUZ',
    paperHref: '/senda/papers/paper-v16-c-its.html',
    paperLabel: { en: 'Read V16 & C-ITS paper', es: 'Leer paper V16 y C-ITS', nl: 'Lees V16 & C-ITS-paper' },
    viewerHref: '/senda/incidente.html',
    viewerLabel: { en: 'Open Rail Incident Panel', es: 'Abrir panel ferroviario', nl: 'Open spoorpaneel' }
  },
  {
    id: 'flood-water',
    tag: { en: 'Hydrology · Spain & Netherlands', es: 'Hidrología · España y Países Bajos', nl: 'Hydrologie · Spanje & Nederland' },
    title: {
      en: 'EMSR773 flood road isolation & 25-station Rijkswaterstaat wave monitor',
      es: 'Aislamiento vial EMSR773 (Valencia) y ondas de crecida en Países Bajos',
      nl: 'EMSR773 overstromingsisolatie & 25-stations Rijkswaterstaat-monitor'
    },
    hypothesis: {
      en: 'Graph reachability over satellite flood footprints pinpoints isolated dry neighborhoods, while multi-station gauges quantify downstream wave travel times.',
      es: 'La alcanzabilidad sobre huellas satelitales localiza núcleos secos aislados, mientras las estaciones hidrológicas miden el tránsito de ondas de crecida.',
      nl: 'Graafbereikbaarheid over satellietwater toont afgesloten wijken, terwijl meetstations de reistijd van watergolven kwantificeren.'
    },
    method: {
      en: 'In-browser OSM + Copernicus EMSR773 graph solver + 28-day Rijkswaterstaat multi-basin gauge series.',
      es: 'Motor de grafos OSM + Copernicus EMSR773 en el navegador + series de 28 días en 25 estaciones de Rijkswaterstaat.',
      nl: 'In-browser OSM + Copernicus EMSR773-solver + 28-daagse Rijkswaterstaat-meetreeksen.'
    },
    result: {
      en: 'Runs deterministically client-side over observed Copernicus EMSR773 polygons and 25 Dutch hydrological stations.',
      es: 'Ejecución determinista en el navegador sobre polígonos observados Copernicus EMSR773 y 25 estaciones hidrológicas neerlandesas.',
      nl: 'Deterministische uitvoering in de browser over waargenomen Copernicus EMSR773-data en 25 Nederlandse meetstations.'
    },
    status: 'observed',
    evidenceId: 'EV-FLOOD-DANA',
    paperHref: '/senda/aislamiento.html',
    paperLabel: { en: 'Open Flood Isolation', es: 'Abrir Aislamiento Vial', nl: 'Open Isolatie-engine' },
    viewerHref: '/senda/agua-nl.html',
    viewerLabel: { en: 'Open NL Water Monitor', es: 'Abrir Monitor Agua NL', nl: 'Open NL Watermonitor' }
  },
  {
    id: 'rubble-csi',
    tag: { en: '3D Buildings & Acoustic/RF Rescue', es: 'Edificios 3D y Rescate Acústico/RF', nl: '3D-gebouwen & Akoestische/RF-redding' },
    title: {
      en: 'EMS-98 building digital twin, BLE surface bridge, AR heatmap & Wi-Fi CSI',
      es: 'Gemelo 3D EMS-98, puente BLE bajo escombros, AR y modelo Wi-Fi CSI',
      nl: 'EMS-98 gebouw-twin, BLE-puinbrug, AR-heatmap & Wi-Fi CSI'
    },
    hypothesis: {
      en: 'Combining OSM 3D footprints, surface BLE bridges, AR camera projection, and ESP32 CSI analysis accelerates structured floor-by-floor search.',
      es: 'Combinar huellas OSM 3D, puentes BLE de superficie, proyección en cámara AR y análisis ESP32 CSI estructura la búsqueda por plantas y viviendas.',
      nl: 'Combinatie van 3D OSM-gebouwen, BLE-puinbruggen, AR-projectie en ESP32 CSI versnelt gestructureerde zoekacties per verdieping.'
    },
    method: {
      en: 'Three.js rotatable building twin, weighted RSSI trilateration, ITU-R P.2040 OFDM wall attenuation, and MFSK-16 acoustic fallback.',
      es: 'Gemelo rotable Three.js, trilateración RSSI ponderada, atenuación OFDM ITU-R P.2040 y módem acústico MFSK-16.',
      nl: 'Roteerbare Three.js gebouw-twin, gewogen RSSI-trilateratie, ITU-R P.2040-demping en MFSK-16 geluidsmodem.'
    },
    result: {
      en: 'Interactive 3D building twin, signed resident check-in aggregation, and robust MFSK-16 audio round-trip with Hamming(7,4) + CRC-32 verified in software.',
      es: 'Gemelo 3D interactivo, cuadro firmado de respuestas por planta y transmisión acústica MFSK-16 con Hamming(7,4) + CRC-32 verificados en software.',
      nl: 'Interactieve 3D-gebouwtwin, ondertekende bewonerscheck-ins en MFSK-16 audio-overdracht met Hamming(7,4) + CRC-32 geverifieerd.'
    },
    status: 'confirmed',
    evidenceId: 'EV-ACOUSTIC',
    paperHref: '/senda/papers/paper-theorems.html',
    paperLabel: { en: 'Read Propagation Theorems', es: 'Leer Teoremas de Propagación', nl: 'Lees Propagatiestellingen' },
    viewerHref: '/senda/edificios.html',
    viewerLabel: { en: 'Open Building 3D Lab', es: 'Abrir Lab Edificios 3D', nl: 'Open 3D-gebouwlab' }
  }
];

export const SCIENCE_PAPERS: PaperEntry[] = [
  {
    id: 'senda-fuego3d',
    tag: { en: 'Preprint · v0.20', es: 'Preprint · v0.20', nl: 'Preprint · v0.20' },
    title: {
      en: 'SENDA-3D: Opportunistic Sensors, Mass-Consistent 3D Wind & Satellite Scar Assimilation',
      es: 'SENDA-3D: Sensores de oportunidad, viento 3D y asimilación de cicatrices de satélite',
      nl: 'SENDA-3D: Opportunistische sensoren, 3D-wind & satelliet-littekenassimilatie'
    },
    summary: {
      en: 'Full case study of the 23 July 2026 San Martín de Valdeiglesias wildfire plus 14 reference fires and EnKF traffic-camera fusion.',
      es: 'Caso completo del incendio de San Martín de Valdeiglesias (23-07-2026), 14 incendios de referencia y fusión tráfico-cámaras EnKF.',
      nl: 'Volledige casestudie van San Martín de Valdeiglesias (23-07-2026), 14 referentiebranden en EnKF-verkeersfusie.'
    },
    formula: '∂²λ/∂x² + ∂²λ/∂y² + (α₁/α₂)² · ∂²λ/∂z² = −∇·u₀',
    href: '/senda/paper.html',
    evidenceId: 'EV-FIRE-SMV',
    bibtex: `@misc{haddioui2026senda3d,
  title={SENDA-3D: Opportunistic Sensors, Mass-Consistent 3D Wind and Satellite Scar Assimilation},
  author={Haddioui, Abraham},
  year={2026},
  note={Preprint v0.20, repository abrahamhl/civic-relay}
}`
  },
  {
    id: 'paper-theorems',
    tag: { en: 'Paper I · Telecom, RF & Acoustics', es: 'Paper I · Telecom, RF y Acústica', nl: 'Paper I · Telecom, RF & Akoestiek' },
    title: {
      en: 'Analytical Propagation Theorems & Link-Budget Foundations for Complex Disasters',
      es: 'Fundamentos Científicos y Teoremas de Propagación de SENDA en Catástrofes Complejas',
      nl: 'Analytische Propagatiestellingen & Linkbudgetten voor Complexe Rampen'
    },
    summary: {
      en: 'Five closed-form theorems: Al-Hourani A2G elevation (ITU-R P.1410), Fiedler partition closure, Deygout diffraction (ITU-R P.526-15), passive radar CAF, and ISO 9613-1 acoustics.',
      es: 'Cinco teoremas cerrados: elevación A2G Al-Hourani (ITU-R P.1410), autovector de Fiedler, difracción Deygout (ITU-R P.526-15), CAF y acústica ISO 9613-1.',
      nl: 'Vijf gesloten stellingen: Al-Hourani A2G, Fiedler-partitiesluiting, Deygout-diffractie ITU-R P.526-15, CAF en ISO 9613-1 akoestiek.'
    },
    formula: 'L_diff(dB) = L_1 + L_2 + L_3 (Deygout ITU-R P.526-15 §4.3)',
    href: '/senda/papers/paper-theorems.html',
    evidenceId: 'EV-CORE-506',
    bibtex: `@misc{haddioui2026theorems,
  title={Analytical Propagation and Link-Budget Foundations for SENDA},
  author={Haddioui, Abraham},
  year={2026},
  note={SENDA Research Archive, abrahamhl/civic-relay}
}`
  },
  {
    id: 'paper-paer-dtn',
    tag: { en: 'Paper II · Mesh & DTN Routing', es: 'Paper II · Redes Mesh y DTN', nl: 'Paper II · Mesh & DTN-routering' },
    title: {
      en: 'PAER (Physics-Aware Emergency Routing) & Receding-Horizon Custody',
      es: 'Protocolo PAER: Enrutamiento de Emergencia Consciente de la Física y Custodia Móvil',
      nl: 'PAER (Physics-Aware Emergency Routing) & Receding-Horizon Beheer'
    },
    summary: {
      en: 'Delay-tolerant routing coupled to thermal and flood hazard fronts with cryptographic receipt purging across constrained airtime budgets.',
      es: 'Enrutamiento tolerante a retardos acoplado a frentes térmicos e inundación con purga criptográfica de colas.',
      nl: 'Vertragingstolerante routering gekoppeld aan gevaarfronten en cryptografische bufferopschoning.'
    },
    formula: 'P_fwd(u,v) = [1 − T_hazard(v)/T_crit] · [Δt_contact / τ_burn] · PRoPHET(u,v)',
    href: '/senda/papers/paper-paer-dtn.html',
    evidenceId: 'EV-ARR-V2',
    bibtex: `@misc{haddioui2026paer,
  title={Physics-Aware Emergency Routing (PAER) for Degraded Connectivity},
  author={Haddioui, Abraham},
  year={2026},
  note={SENDA Research Archive, abrahamhl/civic-relay}
}`
  },
  {
    id: 'paper-calibration',
    tag: { en: 'Paper III · Calibration & Statistics', es: 'Paper III · Calibración y Estadística', nl: 'Paper III · Kalibratie & Statistiek' },
    title: {
      en: 'Leave-One-Fire-Out Calibration, Platt Scaling & ITU-R P.838-3 Rain Attenuation',
      es: 'Calibración Empírica Fuera de Muestra (LOFO), Escala de Platt y Validación ITU-R P.838-3',
      nl: 'Leave-One-Fire-Out Kalibratie, Platt-schaling & ITU-R P.838-3 Regendemping'
    },
    summary: {
      en: 'Out-of-sample calibration methodology separating reliability, resolution, and uncertainty (Murphy 1973 Brier decomposition).',
      es: 'Calibración fuera de muestra con descomposición de Brier (Murphy 1973), escala logística de Platt e intervalos t de Student.',
      nl: 'Out-of-sample kalibratie met Murphy (1973) Brier-decompositie, Platt-schaling en Student-t-intervallen.'
    },
    formula: 'BS = Reliability − Resolution + Uncertainty (Murphy, 1973)',
    href: '/senda/papers/paper-calibration-lofo.html',
    evidenceId: 'EV-FIRE-SMV',
    bibtex: `@misc{haddioui2026calibration,
  title={Leave-One-Fire-Out Empirical Calibration and Reliability Diagnostics},
  author={Haddioui, Abraham},
  year={2026},
  note={SENDA Research Archive, abrahamhl/civic-relay}
}`
  },
  {
    id: 'paper-v16-cits',
    tag: { en: 'Paper IV · C-ITS, V16 & Mobility', es: 'Paper IV · C-ITS, V16 y Movilidad', nl: 'Paper IV · C-ITS, V16 & Mobiliteit' },
    title: {
      en: 'V16 Connected Beacons, C-ITS Corridor Reflex Latency & Vehicular Doppler Gateways',
      es: 'Balizas Conectadas V16, Latencia Refleja C-ITS y Pasarelas Doppler Vehiculares',
      nl: 'V16 Verbonden Bakens, C-ITS Corridorlatentie & Voertuig-Doppler Gateways'
    },
    summary: {
      en: 'Models road corridor hazard propagation, DGT/NDW DATEX II interoperability, and vehicles acting as mobile opportunistic data mules.',
      es: 'Modela la propagación de alertas en carreteras, interoperabilidad DATEX II (DGT/NDW) y vehículos actuando como mulas de datos.',
      nl: 'Modelleert waarschuwingspropagatie op snelwegen, DATEX II-interoperabiliteit (DGT/NDW) en voertuigen als mobiele gateways.'
    },
    formula: 'τ_reflex = τ_beacon + τ_fusion + τ_multihop <= T_braking(v, vis)',
    href: '/senda/papers/paper-v16-c-its.html',
    evidenceId: 'EV-RAIL-ADAMUZ',
    bibtex: `@misc{haddioui2026v16cits,
  title={V16 Connected Beacons, C-ITS Corridor Reflex Latency and Vehicular Gateways},
  author={Haddioui, Abraham},
  year={2026},
  note={SENDA Research Archive, abrahamhl/civic-relay}
}`
  }
];
