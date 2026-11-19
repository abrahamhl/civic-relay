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
  inconclusive?: boolean;
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

export const SCIENCE_MODULES: ScienceModuleItem[] = [
  {
    id: 'h-fire-b',
    tag: { en: 'Wildfire Physics · H-FIRE-B', es: 'Física del fuego · H-FIRE-B', nl: 'Natuurbrandfysica · H-FIRE-B' },
    title: {
      en: 'Multi-incident GOES-R + HRRR level-set evaluation (inconclusive)',
      es: 'Evaluación multi-incidente GOES-R + HRRR (resultado inconcluso)',
      nl: 'Multi-incident GOES-R + HRRR-evaluatie (onbeslist resultaat)'
    },
    hypothesis: {
      en: 'Monotone upwind level-set driven by causal HRRR wind beats same-area isotropic spread on external US wildfires.',
      es: 'El frente upwind con viento HRRR causal supera al crecimiento isotrópico de igual área en 6 incendios externos.',
      nl: 'Upwind level-set met causale HRRR-wind overtreft isotrope groei op 6 externe Amerikaanse branden.'
    },
    method: {
      en: 'Causal 3 h horizon over 6 external fires (Palisades, Eaton, Marshall, Smokehouse, Troublesome, Creek); 10,000-rep bootstrap (seed 20261117).',
      es: 'Horizonte causal de 3 h en 6 incendios externos (Palisades, Eaton, Marshall, Smokehouse, Troublesome, Creek); bootstrap 10.000 réplicas.',
      nl: 'Causale 3-uurshorizon op 6 externe branden; 10.000-bootstrap (seed 20261117).'
    },
    result: {
      en: 'INCONCLUSIVE: Δ growth-CSI +0.0184 (95% CI [-0.0022, +0.0440] includes 0). Beats isotropic in 5/6 fires, loses IoU vs persistence (-0.1425). No operational evacuation use.',
      es: 'INCONCLUSO: Δ growth-CSI +0,0184 (IC 95 % [-0,0022, +0,0440], incluye 0). Supera al isotrópico en 5/6 pero pierde en IoU frente a persistencia (-0,1425). Sin uso operativo.',
      nl: 'ONBESLIST: Δ growth-CSI +0,0184 (95% BI [-0,0022, +0,0440] bevat 0). Wint 5/6 van isotroop, verliest IoU vs persistentie (-0,1425). Geen operationeel gebruik.'
    },
    status: 'predicted',
    evidenceId: 'EV-FIRE-HFIREB',
    inconclusive: true,
    paperHref: `${REPO_URL}/blob/master/experimental/senda-fire-physics/results/FIRE_REAL_CASES_RESULTS.md`,
    paperLabel: { en: 'Read H-FIRE-B report', es: 'Leer informe H-FIRE-B', nl: 'Lees H-FIRE-B-rapport' },
    viewerHref: '/senda/fuego3d.html',
    viewerLabel: { en: 'Open 3D Fire Viewer', es: 'Abrir visor Fuego 3D', nl: 'Open 3D-brandviewer' }
  },
  {
    id: 'senda-3d',
    tag: { en: 'Wildfire 3D · Case Study', es: 'Incendio 3D · Caso real', nl: 'Natuurbrand 3D · Praktijkgeval' },
    title: {
      en: 'SENDA-3D: Mass-consistent 3D wind & Sentinel-2 scar assimilation',
      es: 'SENDA-3D: Viento 3D con conservación de masa y cicatriz Sentinel-2',
      nl: 'SENDA-3D: Massaconsistente 3D-wind & Sentinel-2-assimilatie'
    },
    hypothesis: {
      en: 'Fusing open GFS profiles, Copernicus DEM GLO-30, Sentinel-2 burn scars, and opportunistic fleet sensors improves offline front estimation.',
      es: 'Combinar GFS abierto, Copernicus DEM GLO-30, cicatrices Sentinel-2 y sensores de coches mejora la estimación offline del frente.',
      nl: 'Fusie van GFS, Copernicus DEM, Sentinel-2 en voertuigsensoren verbetert offline brandfrontschatting.'
    },
    method: {
      en: 'Anisotropic Poisson wind solver (SOR ω=1.85), Briggs plume, Dijkstra 16-neighbor spread, validated against 868 ha Sentinel-2 dNBR scar (San Martín, 23-07-2026).',
      es: 'Ecuación de Poisson anisótropa (SOR ω=1,85), pluma de Briggs y propagación Dijkstra validados contra cicatriz Sentinel-2 de 868 ha (San Martín, 23-07-2026).',
      nl: 'Anisotrope Poisson-windoplosser (SOR ω=1,85), Briggs-pluim en Dijkstra gevalideerd op 868 ha Sentinel-2-litteken.'
    },
    result: {
      en: 'Raw model Jaccard 0.064 (fails to beat same-area circle 0.131). In-sample scar assimilation raises Jaccard to 0.352; requires out-of-sample validation.',
      es: 'Sin asimilar: Jaccard 0,064 (no supera a un círculo de igual área: 0,131). Asimilando en muestra alcanza 0,352; requiere validación fuera de muestra.',
      nl: 'Ruw model Jaccard 0,064 (slechter dan cirkel 0,131). In-sample assimilatie verhoogt dit naar 0,352; out-of-sample validatie nodig.'
    },
    status: 'observed',
    evidenceId: 'EV-FIRE-SMV',
    paperHref: '/senda/paper.html',
    paperLabel: { en: 'Read SENDA-3D paper', es: 'Leer paper SENDA-3D', nl: 'Lees SENDA-3D-paper' },
    viewerHref: '/senda/visor.html',
    viewerLabel: { en: 'Open 4D Scientific Viewer', es: 'Abrir Visor 4D científico', nl: 'Open 4D wetenschappelijke viewer' }
  },
  {
    id: 'arr-dtn',
    tag: { en: 'DTN Routing · H-ARR-R', es: 'Enrutamiento DTN · H-ARR-R', nl: 'DTN-routering · H-ARR-R' },
    title: {
      en: 'Receding-horizon custodian planning & ACK gossip under strict budgets',
      es: 'Planificación de custodia con horizonte móvil y gossip de ACK',
      nl: 'Receding-horizon beheerplanning & ACK-gossip binnen energiebudget'
    },
    hypothesis: {
      en: 'Adaptive replanning with cryptographic receipt purging delivers near-epidemic success at a fraction of epidemic airtime and battery cost.',
      es: 'La replanificación adaptativa con purga por recibo logra entrega cercana a Epidemic con una fracción del tiempo de aire y energía.',
      nl: 'Adaptieve herplanning met cryptografische ACK-purging haalt bijna-epidemische bezorging tegen een fractie van de energiekosten.'
    },
    method: {
      en: '120 independent disruption blocks comparing WAIT, CGR_EARLIEST, PROPHET_WARM, SPRAY_AND_FOCUS, EPIDEMIC_CAPPED, ARR_REPLAN_V2, and EPIDEMIC_CEILING.',
      es: '120 bloques independientes comparando WAIT, CGR_EARLIEST, PROPHET_WARM, SPRAY_AND_FOCUS, EPIDEMIC y ARR_REPLAN_V2.',
      nl: '120 onafhankelijke blokken met vergelijking tussen WAIT, CGR_EARLIEST, PROPHET, SPRAY_AND_FOCUS, EPIDEMIC en ARR_REPLAN_V2.'
    },
    result: {
      en: 'Simulated: ARR_REPLAN_V2 reaches 94.2% delivery at 694 mJ (5.4 tx) vs CGR_EARLIEST 58.3% and EPIDEMIC_CEILING 96.7% at 4,420 mJ (0 security violations).',
      es: 'Simulado: ARR_REPLAN_V2 alcanza 94,2 % de entrega con 694 mJ (5,4 tx) frente a CGR 58,3 % y Epidemic 96,7 % con 4.420 mJ (0 violaciones).',
      nl: 'Gesimuleerd: ARR_REPLAN_V2 haalt 94,2% bezorging bij 694 mJ (5,4 tx) vs CGR 58,3% en Epidemic 96,7% bij 4.420 mJ.'
    },
    status: 'simulated',
    evidenceId: 'EV-ARR-V2',
    paperHref: '/senda/papers/paper-paer-dtn.html',
    paperLabel: { en: 'Read PAER-DTN paper', es: 'Leer paper PAER-DTN', nl: 'Lees PAER-DTN-paper' },
    viewerHref: '/senda/red.html',
    viewerLabel: { en: 'Open Multi-Carrier Lab', es: 'Abrir lab de red', nl: 'Open netwerklab' }
  },
  {
    id: 'rail-fusion',
    tag: { en: 'Rail Safety · Multi-train', es: 'Ferrocarril · Multi-tren', nl: 'Spoorveiligheid · Meerdere treinen' },
    title: {
      en: 'Offline passenger handset crash fusion for multi-train incidents',
      es: 'Fusión offline de avisos de pasajeros en incidentes ferroviarios',
      nl: 'Offline passagierstoestel-fusie bij meervoudige treinincidenten'
    },
    hypothesis: {
      en: 'Aggregating handset deceleration/rollover triggers with a 20-30 s user check-in flags a second derailed train within 1 minute even at 5% adoption.',
      es: 'Agregar impactos con cuenta atrás de 20-30 s detecta un segundo tren descarrilado en menos de 1 minuto incluso con 5 % de adopción.',
      nl: 'Aggregatie van impactmeldingen met 20-30 s aftelling detecteert een tweede ontspoorde trein binnen 1 minuut bij 5% adoptie.'
    },
    method: {
      en: 'False-positive rejection tests (phone drops, braking, bumps) + 8-seed two-train scenario (rail-incident.mjs, rail-scenario.mjs).',
      es: 'Tests de falsos positivos (caídas, frenadas, baches) + escenario de dos trenes en 8 semillas (rail-incident.mjs, rail-scenario.mjs).',
      nl: 'Foutpositieventests (vallen, remmen, hobbels) + tweetreinenscenario over 8 seeds.'
    },
    result: {
      en: 'Simulated: second train identified in 30-41 s across all 8 seeds. Requires field drill with civil protection and rail operator agreement.',
      es: 'Simulado: segundo tren identificado en 30-41 s en las 8 semillas. Requiere simulacro real y convenio con operadores ferroviarios.',
      nl: 'Gesimuleerd: tweede trein gedetecteerd in 30-41 s in alle 8 seeds. Vereist veldoefening en spoorwegovereenkomst.'
    },
    status: 'simulated',
    evidenceId: 'EV-RAIL-ADAMUZ',
    paperHref: '/senda/papers/paper-v16-c-its.html',
    paperLabel: { en: 'Read C-ITS & Rail paper', es: 'Leer paper C-ITS', nl: 'Lees C-ITS-paper' },
    viewerHref: '/senda/incidente.html',
    viewerLabel: { en: 'Open Rail Panel', es: 'Abrir panel ferroviario', nl: 'Open spoorpaneel' }
  },
  {
    id: 'flood-water',
    tag: { en: 'Hydrology · ES & NL', es: 'Hidrología · ES y NL', nl: 'Hydrologie · ES & NL' },
    title: {
      en: 'Flood road isolation (EMSR773 Valencia) & Rijkswaterstaat wave tracking',
      es: 'Aislamiento vial por riada (EMSR773) y ondas de crecida (Países Bajos)',
      nl: 'Wegenisolatie bij overstroming (EMSR773) & Rijkswaterstaat-watergolven'
    },
    hypothesis: {
      en: 'Combining Copernicus EMS flood footprints with OSM graphs isolates cut-off dry nodes; multi-station RWS gauges quantify flood-wave lag.',
      es: 'Cruzar huella Copernicus EMS con calles OSM señala cruces secos aislados; 25 estaciones RWS miden el tránsito de crecidas en NL.',
      nl: 'Combinatie van Copernicus EMS met OSM toont afgesloten droge knooppunten; 25 RWS-stations meten golfvertraging in NL.'
    },
    method: {
      en: 'Client-side graph reachability over EMSR773 (30-31 Oct 2024) + 28-day RWS gauge series (17-11-2026 snapshot).',
      es: 'Alcanzabilidad en navegador sobre EMSR773 (30-31 oct 2024) + series de 28 días de 25 estaciones RWS (foto 17-11-2026).',
      nl: 'Client-side graafbereikbaarheid op EMSR773 + 28-daagse RWS-meetreeksen (snapshot 17-11-2026).'
    },
    result: {
      en: 'Observed datasets processed in-browser. Limits: satellite misses water in dense urban cores; RWS view is a dated snapshot without official warning thresholds.',
      es: 'Datos observados procesados en el navegador. Límites: el satélite no delimita agua en cascos urbanos densos; RWS es foto fija sin umbrales oficiales.',
      nl: 'Waargenomen datasets verwerkt in browser. Grenzen: satelliet mist water in dichte stadskernen; RWS is een statische snapshot.'
    },
    status: 'observed',
    evidenceId: 'EV-FLOOD-DANA',
    paperHref: `${REPO_URL}/blob/master/README.md`,
    paperLabel: { en: 'Read methods & limits', es: 'Leer métodos y límites', nl: 'Lees methoden & grenzen' },
    viewerHref: '/senda/aislamiento.html',
    viewerLabel: { en: 'Open Flood Engine', es: 'Abrir motor de aislamiento', nl: 'Open isolatie-engine' }
  },
  {
    id: 'rubble-csi',
    tag: { en: 'Rubble Rescue · BLE & CSI', es: 'Escombros · BLE y Wi-Fi CSI', nl: 'Puinredding · BLE & Wi-Fi CSI' },
    title: {
      en: 'Building digital twin, surface phone bridge & Wi-Fi CSI respiration model',
      es: 'Gemelo digital de edificios, puente bajo escombros y modelo Wi-Fi CSI',
      nl: 'Digitale gebouw-twin, puinbrug & Wi-Fi CSI-ademhalingsmodel'
    },
    hypothesis: {
      en: 'A surface handset bridges a trapped victim’s BLE signal while an external ESP32 CSI probe models respiration behind debris.',
      es: 'Un móvil en superficie hace de puente BLE para una víctima atrapada mientras un accesorio ESP32 modela respiración por Wi-Fi CSI.',
      nl: 'Een toestel bovengronds overbrugt het BLE-signaal terwijl een ESP32 CSI-sensor ademhaling achter puin modelleert.'
    },
    method: {
      en: 'Synthetic RSSI trilateration, OSM building footprints (EMS-98), and 64-subcarrier OFDM wall attenuation (ITU-R P.2040).',
      es: 'Trilateración RSSI sintética, huellas OSM (EMS-98) y atenuación OFDM de 64 subportadoras (ITU-R P.2040).',
      nl: 'Synthetische RSSI-trilateratie, OSM-gebouwen (EMS-98) en 64-subcarrier OFDM-muurdemping (ITU-R P.2040).'
    },
    result: {
      en: 'Software models only (synthetic <1 m BLE fix, 14 rpm synthetic respiration). Zero physical through-wall rescue measurements performed.',
      es: 'Solo modelos de software (error sintético <1 m BLE, 14 rpm sintéticas). Cero mediciones físicas reales tras muros o escombros.',
      nl: 'Alleen softwaremodellen. Nul fysieke metingen door muren of puin uitgevoerd.'
    },
    status: 'untested',
    evidenceId: 'EV-10-INST',
    paperHref: '/senda/papers/paper-theorems.html',
    paperLabel: { en: 'Read propagation theorems', es: 'Leer teoremas de propagación', nl: 'Lees propagatiestellingen' },
    viewerHref: '/senda/edificios.html',
    viewerLabel: { en: 'Open Building 3D Lab', es: 'Abrir lab Edificios 3D', nl: 'Open 3D-gebouwlab' }
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
    tag: { en: 'Working Paper I · RF & Acoustics', es: 'Documento I · RF y Acústica', nl: 'Werkdocument I · RF & Akoestiek' },
    title: {
      en: 'Analytical Propagation & Link-Budget Foundations for Degraded-Infrastructure Routing',
      es: 'Fundamentos analíticos de propagación y presupuestos de enlace en catástrofes',
      nl: 'Analytische propagatie- en linkbudgetgrondslagen bij infrastructuuruitval'
    },
    summary: {
      en: 'Closed-form Al-Hourani A2G elevation, Fiedler partition closure, ITU-R P.526 Deygout diffraction, and ISO 9613-1 acoustic budgets.',
      es: 'Elevación A2G Al-Hourani, cierre de particiones Fiedler, difracción Deygout ITU-R P.526 y balance acústico ISO 9613-1.',
      nl: 'Al-Hourani A2G-elevatie, Fiedler-partitiesluiting, ITU-R P.526 Deygout-diffractie en ISO 9613-1 akoestische budgetten.'
    },
    formula: 'L_diff(dB) = L_1 + L_2 + L_3 (Deygout ITU-R P.526-15)',
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
    tag: { en: 'Working Paper II · DTN', es: 'Documento II · Redes DTN', nl: 'Werkdocument II · DTN' },
    title: {
      en: 'Physics-Aware Emergency Routing (PAER) & Receding-Horizon Custody',
      es: 'Enrutamiento de emergencia consciente de la física (PAER) y custodia móvil',
      nl: 'Physics-Aware Emergency Routing (PAER) & receding-horizon beheer'
    },
    summary: {
      en: 'Delay-tolerant routing coupled to hazard arrival fields and receipt-driven buffer purging across constrained airtime budgets.',
      es: 'Enrutamiento tolerante a retardos acoplado a frentes de peligro y purga de cola mediante recibos criptográficos.',
      nl: 'Vertragingstolerante routering gekoppeld aan gevaarfronten en ontvangstbewijs-gestuurde bufferopschoning.'
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
    tag: { en: 'Working Paper III · Statistics', es: 'Documento III · Calibración', nl: 'Werkdocument III · Kalibratie' },
    title: {
      en: 'Leave-One-Fire-Out Calibration, Reliability Diagrams & ITU-R P.838-3 Rain Attenuation',
      es: 'Calibración dejando fuera un incendio (LOFO) y atenuación por lluvia ITU-R P.838-3',
      nl: 'Leave-One-Fire-Out-kalibratie en ITU-R P.838-3 regendemping'
    },
    summary: {
      en: 'Out-of-sample calibration methodology separating reliability, resolution, and uncertainty (Murphy 1973 decomposition).',
      es: 'Metodología de calibración fuera de muestra con descomposición de Brier (Murphy 1973) e intervalos predictivos t de Student.',
      nl: 'Out-of-sample kalibratie met Murphy (1973) Brier-decompositie en Student-t-voorspellingsintervallen.'
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
  }
];
