'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Locale } from './copy';
import {
  createSectorCameraAdapter,
  validateCameraUpstreamUrl,
  EVIDENCE_LABELS,
  type CameraState
} from '../lib/sector-camera-engine.mjs';

type MatrixLayout = 1 | 4 | 9;

interface PipelineNodeSpec {
  id: string;
  layer: 'OBSERVAR' | 'DECIDIR' | 'COORDINAR';
  title: string;
  problem: string;
  input: string;
  decision: string;
  output: string;
  evidence: string;
  modulePath: string;
  moduleUrl: string;
}

const PIPELINE_DATA: Record<Locale, PipelineNodeSpec[]> = {
  es: [
    {
      id: 'pipe-01-incident',
      layer: 'OBSERVAR',
      title: '01 · Incidente / Fuente Autorizada',
      problem: 'Evitar alertas falsas o inferencias automáticas a partir de rumores o cámaras sin verificar.',
      input: 'Aviso CAP 1.2 firmado (cuando exista convenio) o activación de ejercicio sintético + cámaras viales públicas (DGT/RWS) como contexto separado.',
      decision: 'Verificar firma/autoridad antes de aceptar una alerta como oficial; etiquetar todo escenario de prueba como EXERCISE_ONLY.',
      output: 'Evento acotado con procedencia explícita (SIMULATION_NOT_OFFICIAL o CAP verificado).',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-policy.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-policy.mjs'
    },
    {
      id: 'pipe-02-zone',
      layer: 'OBSERVAR',
      title: '02 · Zona y Sector Geográfico',
      problem: 'Acotar geográficamente qué área sufre caída de cobertura (ej. El Tiemblo 20 km) sin rastrear a toda la población.',
      input: 'Polígono GeoJSON del sector afectado y estado estimado de torres/pasarelas.',
      decision: 'Activar la política de emergencia únicamente dentro del polígono y durante la ventana temporal (expiresAfterSeconds).',
      output: 'Sector activo con sub-sectores, conos FOV estimados (no calibrados) y porcentaje de daño.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    },
    {
      id: 'pipe-03-consent',
      layer: 'OBSERVAR',
      title: '03 · Permisos y Participación Voluntaria',
      problem: 'Un navegador o app no puede ni debe «intervenir» teléfonos ajenos sin permiso explícito del usuario y del sistema operativo.',
      input: 'Consentimiento opt-in del ciudadano y permisos de radio concedidos al sistema operativo.',
      decision: 'Si participating=false o permission=false, el nodo se excluye de emitir mensajes y de actuar como relé.',
      output: 'Conjunto de nodos participantes y autorizados; revocación inmediata disponible en un clic.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/app/human-safety-panel.tsx',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/app/human-safety-panel.tsx'
    },
    {
      id: 'pipe-04-human',
      layer: 'DECIDIR',
      title: '04 · Estado Humano (SAFE / SOS / UNKNOWN)',
      problem: 'El silencio de un teléfono (batería agotada, sin cobertura) jamás debe contarse como víctima confirmada ni generar un SOS falso.',
      input: 'Acción humana voluntaria: «Estoy bien (SAFE)», «Necesito ayuda (SOS_EXPLICIT)» o ausencia de respuesta.',
      decision: 'Regla científica innegociable: NO RESPONSE = UNKNOWN. Solo SAFE y SOS_EXPLICIT generan sobres en la cola.',
      output: 'Contadores estrictamente separados: SAFE, SOS_EXPLICIT y UNKNOWN.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-05-queue',
      layer: 'DECIDIR',
      title: '05 · Cola Local Store-and-Forward + Prioridad',
      problem: 'Cuando cae la antena, las apps convencionales fallan al instante y pierden el mensaje.',
      input: 'Sobre validado con ID único, categoría (SOS_EXPLICIT / SAFE), TTL (3600s) y firma ECDSA P-256 opcional.',
      decision: 'Almacenar en cola acotada, deduplicar por ID, aplicar prioridad máxima a SOS_EXPLICIT y retener tráfico no crítico si batería ≤15% (CRITICAL).',
      output: 'Estado QUEUED con backoff exponencial hasta encontrar transporte compatible o expirar por TTL.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/store-forward.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/store-forward.mjs'
    },
    {
      id: 'pipe-06-route',
      layer: 'COORDINAR',
      title: '06 · «Policía de Tráfico» y Selección de Red',
      problem: 'Evitar que decenas de teléfonos colapsen un enlace precario o agoten la batería de un nodo crítico.',
      input: 'Grafo de vecinos compatibles (BLE / Wi-Fi / Celular / Gateway de borde) y nivel energético de cada nodo.',
      decision: 'Puntuar transportes por fiabilidad, latencia y coste energético; prohibir que un nodo con batería CRITICAL retransmita tráfico ajeno.',
      output: 'Ruta óptima calculada (directa o multisalto hacia Gateway) o permanencia segura en QUEUED_LOCAL.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-07-ack',
      layer: 'COORDINAR',
      title: '07 · Envío, Reintento y ACK con Significado Explícito',
      problem: 'Pulsar «Enviar» no significa que emergencias haya recibido nada.',
      input: 'Intento de despacho por el adaptador seleccionado y recibo devuelto por el receptor.',
      decision: 'Distinguir entre QUEUED, FORWARDED_UNCONFIRMED, ACK_SYNTHETIC (simulador) y recibo firmado ECDSA en laboratorio.',
      output: 'Estado auditable que jamás presenta un ACK de simulación como despacho real del 112.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/live-protocol-node.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/live-protocol-node.mjs'
    },
    {
      id: 'pipe-08-coordinator',
      layer: 'COORDINAR',
      title: '08 · Visibilidad para Coordinador Autorizado',
      problem: 'Sustituir las listas en papel en zonas de catástrofe por una vista clara de estados voluntarios y fuentes públicas verificadas.',
      input: 'Recibos agregados, estado de sectores y catálogo de cámaras públicas con control de frescura (STALE / NO_SIGNAL).',
      decision: 'Separar la capa observacional (cámaras) de la capa de mensajes consentidos; exigir validación humana antes de cualquier intervención.',
      output: 'Consola de coordinación exportable en JSON reproducible, lista para futuros pilotos institucionales.',
      evidence: EVIDENCE_LABELS.PHYSICAL_FIELD_PENDING,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    }
  ],
  en: [
    {
      id: 'pipe-01-incident',
      layer: 'OBSERVAR',
      title: '01 · Incident / Authorized Source',
      problem: 'Prevent false alarms or automatic inferences from unverified rumors or cameras.',
      input: 'Signed CAP 1.2 alert (when institutionally integrated) or synthetic exercise trigger + public road cameras (DGT/RWS) as separate context.',
      decision: 'Verify authority signature before accepting an official alert; tag all test scenarios as EXERCISE_ONLY.',
      output: 'Bounded event with explicit provenance (SIMULATION_NOT_OFFICIAL or verified CAP).',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-policy.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-policy.mjs'
    },
    {
      id: 'pipe-02-zone',
      layer: 'OBSERVAR',
      title: '02 · Geographic Zone & Sector',
      problem: 'Bound which geographic area suffers coverage loss (e.g., El Tiemblo 20 km) without tracking the general public.',
      input: 'GeoJSON polygon of the affected sector and estimated cell-tower/gateway status.',
      decision: 'Activate emergency policy strictly inside the polygon and within the expiration window (expiresAfterSeconds).',
      output: 'Active sector with sub-sectors, estimated (uncalibrated) FOV cones, and damage ratio.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    },
    {
      id: 'pipe-03-consent',
      layer: 'OBSERVAR',
      title: '03 · Permissions & Voluntary Participation',
      problem: 'A browser or app cannot and must not hijack nearby phones without explicit user and OS permission.',
      input: 'Citizen opt-in consent and OS-granted radio permissions.',
      decision: 'If participating=false or permission=false, the node is excluded from originating or relaying traffic.',
      output: 'Set of consenting, permitted nodes with instant one-click revocation.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/app/human-safety-panel.tsx',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/app/human-safety-panel.tsx'
    },
    {
      id: 'pipe-04-human',
      layer: 'DECIDIR',
      title: '04 · Human Status (SAFE / SOS / UNKNOWN)',
      problem: 'Phone silence (dead battery, no signal) must never be counted as a confirmed casualty or generate a false SOS.',
      input: 'Voluntary human action: SAFE, SOS_EXPLICIT, or no response.',
      decision: 'Non-negotiable scientific rule: NO RESPONSE = UNKNOWN. Only explicit SAFE and SOS_EXPLICIT enter the queue.',
      output: 'Strictly separated counters: SAFE, SOS_EXPLICIT, and UNKNOWN.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-05-queue',
      layer: 'DECIDIR',
      title: '05 · Store-and-Forward Queue + Priority',
      problem: 'When a tower fails, conventional apps fail immediately and drop the message.',
      input: 'Validated envelope with unique ID, category (SOS_EXPLICIT / SAFE), TTL (3600s), and optional ECDSA P-256 signature.',
      decision: 'Store in bounded queue, deduplicate by ID, prioritize SOS_EXPLICIT, and hold non-critical traffic if battery ≤15% (CRITICAL).',
      output: 'QUEUED state with exponential backoff until a compatible route appears or TTL expires.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/store-forward.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/store-forward.mjs'
    },
    {
      id: 'pipe-06-route',
      layer: 'COORDINAR',
      title: '06 · Routing Traffic-Cop & Network Selection',
      problem: 'Prevent dozens of phones from collapsing a fragile link or draining a critical node’s battery.',
      input: 'Graph of compatible neighbors (BLE / Wi-Fi / Cellular / Edge Gateway) and node energy profiles.',
      decision: 'Score transports by reliability, latency, and energy cost; forbid CRITICAL battery nodes from relaying third-party traffic.',
      output: 'Computed optimal route (direct or multi-hop to Gateway) or safe retention in QUEUED_LOCAL.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-07-ack',
      layer: 'COORDINAR',
      title: '07 · Dispatch, Retry & Explicit-Meaning ACK',
      problem: 'Pressing Send does not mean emergency services received anything.',
      input: 'Dispatch attempt via selected adapter and receiver receipt.',
      decision: 'Distinguish QUEUED, FORWARDED_UNCONFIRMED, ACK_SYNTHETIC (simulator), and ECDSA-signed lab receipts.',
      output: 'Auditable state that never misrepresents a synthetic ACK as a live 112 dispatch.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/live-protocol-node.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/live-protocol-node.mjs'
    },
    {
      id: 'pipe-08-coordinator',
      layer: 'COORDINAR',
      title: '08 · Authorized Coordinator Visibility',
      problem: 'Replace paper lists in disaster zones with a clear view of voluntary statuses and verified public sources.',
      input: 'Aggregated receipts, sector status, and public camera catalog with freshness checks (STALE / NO_SIGNAL).',
      decision: 'Separate observational cameras from consented status messages; require human operator verification before action.',
      output: 'Reproducible JSON-exportable coordination console ready for future institutional pilots.',
      evidence: EVIDENCE_LABELS.PHYSICAL_FIELD_PENDING,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    }
  ],
  nl: [
    {
      id: 'pipe-01-incident',
      layer: 'OBSERVAR',
      title: '01 · Incident / Geautoriseerde Bron',
      problem: 'Voorkom valse meldingen of automatische conclusies uit ongeverifieerde camera’s.',
      input: 'Ondertekende CAP 1.2-melding of gesimuleerde oefening + openbare wegcamera’s (DGT/RWS) als losse context.',
      decision: 'Controleer handtekening en autoriteit; label elk testscenario expliciet als EXERCISE_ONLY.',
      output: 'Afgebakend evenement met duidelijke herkomst (SIMULATION_NOT_OFFICIAL of geverifieerde CAP).',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-policy.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-policy.mjs'
    },
    {
      id: 'pipe-02-zone',
      layer: 'OBSERVAR',
      title: '02 · Geografische Zone & Sector',
      problem: 'Baken af welk gebied verbindingsverlies lijdt zonder de hele bevolking te volgen.',
      input: 'GeoJSON-polygoon van de getroffen sector en geschatte mast-/gatewaystatus.',
      decision: 'Activeer noodbeleid uitsluitend binnen de polygoon en gedurende de geldigheidsduur (expiresAfterSeconds).',
      output: 'Actieve sector met subsectoren, geschatte (ongekalibreerde) FOV-kegels en schaderatio.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    },
    {
      id: 'pipe-03-consent',
      layer: 'OBSERVAR',
      title: '03 · Toestemming & Vrijwillige Deelname',
      problem: 'Een browser of app mag nooit zonder toestemming radio’s van andere telefoons overnemen.',
      input: 'Opt-in toestemming van de burger en OS-radiorechten.',
      decision: 'Als participating=false of permission=false, verstuurt of relais-schakelt de node geen verkeer.',
      output: 'Verzameling deelnemende nodes met directe intrekking in één klik.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/app/human-safety-panel.tsx',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/app/human-safety-panel.tsx'
    },
    {
      id: 'pipe-04-human',
      layer: 'DECIDIR',
      title: '04 · Menselijke Status (SAFE / SOS / UNKNOWN)',
      problem: 'Stilte van een telefoon mag nooit als bevestigd slachtoffer tellen of automatisch een SOS maken.',
      input: 'Vrijwillige menselijke actie: SAFE, SOS_EXPLICIT of geen reactie.',
      decision: 'Harde regel: NO RESPONSE = UNKNOWN. Alleen expliciete SAFE en SOS_EXPLICIT gaan de wachtrij in.',
      output: 'Strikt gescheiden tellers: SAFE, SOS_EXPLICIT en UNKNOWN.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-05-queue',
      layer: 'DECIDIR',
      title: '05 · Store-and-Forward Wachtrij + Prioriteit',
      problem: 'Bij mastuitval verliezen gewone apps direct het bericht.',
      input: 'Gevalideerde envelop met unieke ID, categorie (SOS_EXPLICIT / SAFE), TTL (3600s) en optionele ECDSA P-256-handtekening.',
      decision: 'Bewaar in begrensde wachtrij, ontdubbel op ID, geef SOS_EXPLICIT voorrang en pauzeer niet-kritiek verkeer bij accu ≤15% (CRITICAL).',
      output: 'QUEUED-status met exponentiële backoff tot een route verschijnt of TTL verloopt.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/store-forward.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/store-forward.mjs'
    },
    {
      id: 'pipe-06-route',
      layer: 'COORDINAR',
      title: '06 · Verkeersregelaar & Netwerkkeuze',
      problem: 'Voorkom dat tientallen telefoons een zwakke verbinding overbelasten of een lege accu uitputten.',
      input: 'Graaf van compatibele buren (BLE / Wi-Fi / Mobiel / Gateway) en energiestatus per node.',
      decision: 'Beoordeel transporten op betrouwbaarheid, latentie en energie; verbied CRITICAL-accunodes als tussenstation.',
      output: 'Berekende route (direct of multi-hop naar Gateway) of veilige opslag in QUEUED_LOCAL.',
      evidence: EVIDENCE_LABELS.SYNTHETIC_SIMULATION,
      modulePath: 'investor-next/lib/emergency-routing.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/emergency-routing.mjs'
    },
    {
      id: 'pipe-07-ack',
      layer: 'COORDINAR',
      title: '07 · Verzending, Herhaling & Expliciete ACK',
      problem: 'Op Verzenden drukken betekent niet dat 112 iets heeft ontvangen.',
      input: 'Verzendpoging via gekozen adapter en ontvangstbewijs.',
      decision: 'Maak onderscheid tussen QUEUED, FORWARDED_UNCONFIRMED, ACK_SYNTHETIC (simulator) en ECDSA-labontvangst.',
      output: 'Controleerbare status die een gesimuleerde ACK nooit als echte 112-inzet voorstelt.',
      evidence: EVIDENCE_LABELS.REAL_CODE_LOCAL_LAB,
      modulePath: 'investor-next/lib/live-protocol-node.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/live-protocol-node.mjs'
    },
    {
      id: 'pipe-08-coordinator',
      layer: 'COORDINAR',
      title: '08 · Zichtbaarheid voor Geautoriseerde Coördinator',
      problem: 'Vervang papieren lijsten in rampgebieden door een helder overzicht van vrijwillige statussen en openbare bronnen.',
      input: 'Geaggregeerde ontvangstbewijzen, sectorstatus en openbare cameracatalogus met versheidscontrole (STALE / NO_SIGNAL).',
      decision: 'Scheid observatiecamera’s van vrijwillige berichten; vereis menselijke verificatie vóór elke actie.',
      output: 'Reproduceerbare JSON-exporteerbare coördinatieconsole klaar voor toekomstige pilots.',
      evidence: EVIDENCE_LABELS.PHYSICAL_FIELD_PENDING,
      modulePath: 'investor-next/lib/sector-camera-engine.mjs',
      moduleUrl: 'https://github.com/abrahamhl/civic-relay/blob/master/investor-next/lib/sector-camera-engine.mjs'
    }
  ]
};

export default function SectorIntelligenceConsole({ locale }: { locale: Locale }) {
  const [selectedSectorId, setSelectedSectorId] = useState<string>('SECTOR-AVILA-TIEMBLO');
  const [selectedSubSectorId, setSelectedSubSectorId] = useState<string>('AV-N403-NORTE');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('CAM-DGT-N403-PK82');
  const [stateFilter, setStateFilter] = useState<'ALL' | CameraState>('ALL');
  const [matrixLayout, setMatrixLayout] = useState<MatrixLayout>(4);
  const [privacyMosaic, setPrivacyMosaic] = useState<boolean>(false);
  const [operatorRole, setOperatorRole] = useState<'PUBLIC_VISITOR' | 'INSTITUTIONAL_OPERATOR'>('PUBLIC_VISITOR');
  const [showDecisionDrawer, setShowDecisionDrawer] = useState<boolean>(true);
  const [damagedOverride, setDamagedOverride] = useState<number>(85);
  const [gatewayOverride, setGatewayOverride] = useState<boolean>(true);
  const [ssrfTestUrl, setSsrfTestUrl] = useState<string>('https://infocar.dgt.es/etraffic/');
  const [activePipeIndex, setActivePipeIndex] = useState<number>(0);

  const adapter = useMemo(
    () =>
      createSectorCameraAdapter({
        role: operatorRole,
        institutionAuthorized: operatorRole === 'INSTITUTIONAL_OPERATOR'
      }),
    [operatorRole]
  );

  const sectors = useMemo(() => adapter.listSectors(), [adapter]);
  const { sector, cameras } = useMemo(
    () => adapter.getSector(selectedSectorId),
    [adapter, selectedSectorId]
  );

  const causalTrace = useMemo(
    () =>
      adapter.explainSectorDecision(selectedSectorId, {
        damaged: damagedOverride,
        gateway: gatewayOverride
      }),
    [adapter, selectedSectorId, damagedOverride, gatewayOverride]
  );

  const filteredCameras = useMemo(
    () =>
      cameras
        .filter(c => stateFilter === 'ALL' || c.state === stateFilter)
        .slice(0, matrixLayout),
    [cameras, stateFilter, matrixLayout]
  );

  const selectedCamera = useMemo(
    () => cameras.find(c => c.id === selectedCameraId) || cameras[0],
    [cameras, selectedCameraId]
  );

  const ssrfVerdict = useMemo(() => validateCameraUpstreamUrl(ssrfTestUrl), [ssrfTestUrl]);

  // Listen to 3D Globe sector/camera selections
  useEffect(() => {
    const onSelect = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sectorId?: string; cameraId?: string }>).detail;
      if (detail?.sectorId) {
        setSelectedSectorId(detail.sectorId);
        const foundSec = sectors.find(s => s.id === detail.sectorId);
        if (foundSec?.subSectors[0]) setSelectedSubSectorId(foundSec.subSectors[0].id);
      }
      if (detail?.cameraId) {
        setSelectedCameraId(detail.cameraId);
      }
    };
    window.addEventListener('oep:select-sector', onSelect);
    return () => window.removeEventListener('oep:select-sector', onSelect);
  }, [sectors]);

  const pipeNodes = PIPELINE_DATA[locale];
  const activePipe = pipeNodes[activePipeIndex] || pipeNodes[0];

  const labels = {
    es: {
      eyebrow: 'SUPERFICIE B · SECTOR INTELLIGENCE & COORDINACIÓN CCTV AUTORIZADA',
      title: 'DE LA VISTA GLOBAL AL SECTOR: CÁMARAS PÚBLICAS, COBERTURA Y DECISIONES TRAZABLES.',
      lead:
        'Selecciona un sector piloto o de ejercicio (como El Tiemblo en Ávila, Valencia o Arnhem). Inspecciona sub-sectores GeoJSON, conos de visión estimados (no calibrados), catálogo de fuentes viales abiertas (DGT / Rijkswaterstaat) y estados STALE / NO_SIGNAL / SYNTHETIC sin fingir vídeo en directo ni inferir víctimas automáticamente.',
      sectorPicker: '1. Elegir sector geográfico:',
      subSectorTitle: 'Sub-sectores GeoJSON y cobertura estimada',
      cameraMatrixTitle: 'Matriz de cámaras del sector (1 / 4 / 9 vistas)',
      filterLabel: 'Filtrar estado:',
      mosaicToggle: 'Modo Mosaico / Ocultar previsualización',
      rbacToggle: 'Vista Pública (RBAC estricto)',
      rbacOperator: 'Simular Rol Institucional Autorizado',
      decisionBtn: 'Ver cómo decide el motor OEP (Causa → Regla → Resultado)',
      damageSlider: 'Infraestructura celular dañada en el sector',
      gatewayToggle: 'Gateway de borde disponible en el sector',
      ssrfTitle: 'Validador de Seguridad Anti-SSRF y Dominios Permitidos',
      pipeHeading: 'MODELO MENTAL UNIFICADO: OBSERVAR → DECIDIR → COORDINAR',
      pipeSub: 'Pulsa cada eslabón para inspeccionar qué problema resuelve, qué recibe, qué decide, qué salida genera y en qué archivo del repositorio vive.'
    },
    en: {
      eyebrow: 'SURFACE B · SECTOR INTELLIGENCE & AUTHORIZED CCTV COORDINATION',
      title: 'FROM GLOBAL VIEW TO SECTOR: PUBLIC CAMERAS, COVERAGE & TRACEABLE DECISIONS.',
      lead:
        'Select a pilot or exercise sector (El Tiemblo in Ávila, Valencia, or Arnhem). Inspect GeoJSON sub-sectors, estimated (uncalibrated) FOV cones, open road camera catalogs (DGT / Rijkswaterstaat), and explicit STALE / NO_SIGNAL / SYNTHETIC states without faking live streams or inferring casualties.',
      sectorPicker: '1. Select geographic sector:',
      subSectorTitle: 'GeoJSON sub-sectors & estimated coverage',
      cameraMatrixTitle: 'Sector camera matrix (1 / 4 / 9 views)',
      filterLabel: 'Filter state:',
      mosaicToggle: 'Mosaic Mode / Hide preview',
      rbacToggle: 'Public View (Strict RBAC)',
      rbacOperator: 'Simulate Authorized Institutional Role',
      decisionBtn: 'See how the OEP engine decides (Cause → Rule → Outcome)',
      damageSlider: 'Damaged cellular infrastructure in sector',
      gatewayToggle: 'Edge gateway available in sector',
      ssrfTitle: 'Anti-SSRF Security & Domain Allowlist Validator',
      pipeHeading: 'UNIFIED MENTAL MODEL: OBSERVE → DECIDE → COORDINATE',
      pipeSub: 'Click any link in the chain to inspect the problem it solves, its input, decision rule, output, evidence state, and exact repository file.'
    },
    nl: {
      eyebrow: 'OPPERVLAK B · SECTOR INTELLIGENCE & GEAUTORISEERDE CCTV-COÖRDINATIE',
      title: 'VAN WERELDBOL NAAR SECTOR: OPENBARE CAMERA’S, DEKKING EN TRACEERBARE BESLISSINGEN.',
      lead:
        'Selecteer een pilot- of oefensector (El Tiemblo in Ávila, Valencia of Arnhem). Inspecteer GeoJSON-subsectoren, geschatte (ongekalibreerde) FOV-kegels, openbare wegcameracatalogi (DGT / Rijkswaterstaat) en expliciete STALE / NO_SIGNAL / SYNTHETIC-statussen zonder nep-livestreams.',
      sectorPicker: '1. Kies geografische sector:',
      subSectorTitle: 'GeoJSON-subsectoren & geschatte dekking',
      cameraMatrixTitle: 'Cameramatrix van de sector (1 / 4 / 9 weergaven)',
      filterLabel: 'Filter status:',
      mosaicToggle: 'Mozaïekmodus / Verberg voorbeeld',
      rbacToggle: 'Publieke weergave (Strikte RBAC)',
      rbacOperator: 'Simuleer Geautoriseerde Institutionele Rol',
      decisionBtn: 'Bekijk hoe de OEP-engine beslist (Oorzaak → Regel → Uitkomst)',
      damageSlider: 'Beschadigde mobiele infrastructuur in sector',
      gatewayToggle: 'Randgateway beschikbaar in sector',
      ssrfTitle: 'Anti-SSRF Beveiliging & Domein-Allowlist Validator',
      pipeHeading: 'GEÜNIFICEERD MODEL: OBSERVEREN → BESLISSEN → COÖRINEREN',
      pipeSub: 'Klik op een schakel om het probleem, de invoer, beslisregel, uitvoer, bewijsstatus en het bronbestand te bekijken.'
    }
  }[locale];

  // Convert lon/lat within sector bounding box to SVG 0..560 x 0..320
  const bounds = useMemo(() => {
    const ring = sector.geometry.coordinates[0];
    const lons = ring.map(p => p[0]);
    const lats = ring.map(p => p[1]);
    return {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats)
    };
  }, [sector]);

  const projectPoint = (lon: number, lat: number): [number, number] => {
    const x = ((lon - bounds.minLon) / Math.max(0.001, bounds.maxLon - bounds.minLon)) * 480 + 40;
    const y = ((bounds.maxLat - lat) / Math.max(0.001, bounds.maxLat - bounds.minLat)) * 240 + 40;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  return (
    <section
      id="sector-intelligence"
      data-testid="sector-intelligence-section"
      className="container"
      aria-labelledby="sector-intel-heading"
      style={{
        marginTop: '2.5rem',
        marginBottom: '2.5rem',
        padding: '1.6rem',
        borderRadius: '0.85rem',
        border: '1px solid rgba(90, 175, 196, 0.28)',
        background: 'linear-gradient(180deg, rgba(7, 19, 30, 0.96) 0%, rgba(5, 13, 21, 0.98) 100%)',
        color: '#e2f1f8'
      }}
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <p className="eyebrow" style={{ color: '#38bdf8', marginBottom: '0.35rem' }}>
          {labels.eyebrow}
        </p>
        <h2 id="sector-intel-heading" style={{ fontSize: 'clamp(1.35rem, 2.5vw, 2rem)', margin: '0 0 0.55rem 0' }}>
          {labels.title}
        </h2>
        <p style={{ color: '#cbd5e1', maxWidth: '78ch', lineHeight: 1.6, margin: 0 }}>{labels.lead}</p>
      </div>

      {/* Top Controls: Sector Selector + Matrix Layout + Privacy/RBAC Toggles */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem',
          borderRadius: '0.6rem',
          background: 'rgba(12, 31, 46, 0.85)',
          border: '1px solid rgba(125, 211, 252, 0.2)',
          marginBottom: '1.2rem'
        }}
      >
        <div role="group" aria-label={labels.sectorPicker} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.8rem', color: '#bae6fd' }}>{labels.sectorPicker}</strong>
          {sectors.map(s => (
            <button
              key={s.id}
              type="button"
              data-testid={`sector-btn-${s.id}`}
              aria-pressed={selectedSectorId === s.id}
              onClick={() => {
                setSelectedSectorId(s.id);
                if (s.subSectors[0]) setSelectedSubSectorId(s.subSectors[0].id);
                const firstCam = adapter.getSector(s.id).cameras[0];
                if (firstCam) setSelectedCameraId(firstCam.id);
              }}
              style={{
                padding: '0.42rem 0.75rem',
                borderRadius: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: selectedSectorId === s.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.3)',
                background: selectedSectorId === s.id ? '#0369a1' : 'rgba(15, 23, 42, 0.75)',
                color: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              {s.code} · {s.name} ({s.incidentType})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
          <button
            type="button"
            data-testid="sector-toggle-mosaic"
            aria-pressed={privacyMosaic}
            onClick={() => setPrivacyMosaic(v => !v)}
            style={{
              padding: '0.36rem 0.65rem',
              borderRadius: '0.35rem',
              fontSize: '0.76rem',
              border: '1px solid rgba(167, 243, 208, 0.4)',
              background: privacyMosaic ? '#065f46' : 'rgba(15, 23, 42, 0.7)',
              color: '#d1fae5',
              cursor: 'pointer'
            }}
          >
            {labels.mosaicToggle}
          </button>
          <button
            type="button"
            data-testid="sector-toggle-rbac"
            aria-pressed={operatorRole === 'INSTITUTIONAL_OPERATOR'}
            onClick={() => setOperatorRole(r => (r === 'PUBLIC_VISITOR' ? 'INSTITUTIONAL_OPERATOR' : 'PUBLIC_VISITOR'))}
            style={{
              padding: '0.36rem 0.65rem',
              borderRadius: '0.35rem',
              fontSize: '0.76rem',
              border: '1px solid rgba(251, 191, 36, 0.45)',
              background: operatorRole === 'INSTITUTIONAL_OPERATOR' ? '#78350f' : 'rgba(15, 23, 42, 0.7)',
              color: '#fef3c7',
              cursor: 'pointer'
            }}
          >
            {operatorRole === 'PUBLIC_VISITOR' ? labels.rbacToggle : labels.rbacOperator}
          </button>
        </div>
      </div>

      {/* Main Two-Column Sector Workspace: Left = 2.5D GIS Sector Map + SubSectors, Right = Camera Matrix & Source Inspector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.15rem',
          marginBottom: '1.25rem'
        }}
      >
        {/* Left Column: 2.5D Sector Vector Map with Estimated FOV Cones & Voluntary Nodes */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.65rem',
            border: '1px solid rgba(120, 190, 210, 0.22)',
            background: 'rgba(8, 22, 34, 0.92)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
            <strong style={{ fontSize: '0.86rem', color: '#7dd3fc' }}>
              {sector.name} · {sector.region}
            </strong>
            <span
              style={{
                padding: '0.15rem 0.5rem',
                borderRadius: '0.28rem',
                background: 'rgba(245, 158, 11, 0.16)',
                border: '1px solid #f59e0b',
                color: '#fde68a',
                fontSize: '0.68rem',
                fontWeight: 700
              }}
            >
              {sector.evidenceLabel}
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '0 0 0.65rem 0', lineHeight: 1.5 }}>
            {sector.description[locale]}
          </p>

          {/* Interactive SVG GIS Map of the Selected Sector */}
          <svg
            viewBox="0 0 560 320"
            role="img"
            aria-label={`Mapa vectorial del sector ${sector.name} con sub-sectores y conos de visión estimados`}
            data-testid="sector-gis-map-svg"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '0.5rem',
              background: '#040d16',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}
          >
            {/* Coordinate grid */}
            {[80, 160, 240, 320, 400, 480].map(x => (
              <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={320} stroke="rgba(125,211,252,0.08)" strokeWidth="1" />
            ))}
            {[64, 128, 192, 256].map(y => (
              <line key={`gy-${y}`} x1={0} y1={y} x2={560} y2={y} stroke="rgba(125,211,252,0.08)" strokeWidth="1" />
            ))}

            {/* Sub-sector polygons */}
            {sector.subSectors.map(sub => {
              const pts = sub.polygon.map(([lon, lat]) => projectPoint(lon, lat).join(',')).join(' ');
              const active = selectedSubSectorId === sub.id;
              const fill =
                sub.towerStatus === 'OFFLINE_SYNTHETIC'
                  ? 'rgba(239, 68, 68, 0.18)'
                  : sub.towerStatus === 'DAMAGED_SYNTHETIC'
                  ? 'rgba(245, 158, 11, 0.18)'
                  : 'rgba(16, 185, 129, 0.16)';
              const stroke = active ? '#38bdf8' : 'rgba(148, 163, 184, 0.5)';
              return (
                <g
                  key={sub.id}
                  onClick={() => setSelectedSubSectorId(sub.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={active ? 2.4 : 1.2} />
                </g>
              );
            })}

            {/* Camera FOV Estimated Cones (`calibrated: false`) */}
            {cameras.map(cam => {
              const ring = cam.fovFeature.geometry.coordinates[0];
              const pts = ring.map(([lon, lat]) => projectPoint(lon, lat).join(',')).join(' ');
              const [cx, cy] = projectPoint(cam.coordinates[1], cam.coordinates[0]);
              const isSelected = selectedCamera?.id === cam.id;
              const color =
                cam.state === 'PUBLIC_CATALOG_VERIFIED'
                  ? '#38bdf8'
                  : cam.state === 'SYNTHETIC'
                  ? '#a78bfa'
                  : cam.state === 'STALE'
                  ? '#f59e0b'
                  : '#ef4444';
              return (
                <g
                  key={cam.id}
                  data-testid={`map-camera-cone-${cam.id}`}
                  onClick={() => setSelectedCameraId(cam.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <polygon
                    points={pts}
                    fill={color}
                    fillOpacity={isSelected ? 0.34 : 0.16}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1}
                    strokeDasharray="3 2"
                  />
                  <circle cx={cx} cy={cy} r={isSelected ? 6.5 : 4.8} fill={color} stroke="#040d16" strokeWidth="1.5" />
                  <text x={cx + 8} y={cy + 4} fill="#e2f1f8" fontSize="9.5" fontWeight="600">
                    {cam.id.replace('CAM-', '')} ({cam.state})
                  </text>
                </g>
              );
            })}

            {/* Synthetic participating nodes overlay from runScenario */}
            {causalTrace.simulationResult.devices.slice(0, 24).map(dev => {
              const nx = 55 + dev.x * 450;
              const ny = 45 + dev.y * 230;
              const c =
                dev.humanStatus === 'SOS_EXPLICIT'
                  ? '#fb7185'
                  : dev.humanStatus === 'SAFE'
                  ? '#34d399'
                  : '#94a3b8';
              return (
                <circle
                  key={dev.id}
                  cx={nx}
                  cy={ny}
                  r={dev.humanStatus === 'SOS_EXPLICIT' ? 4.2 : 2.8}
                  fill={c}
                  opacity={dev.participating ? 0.9 : 0.3}
                />
              );
            })}

            <text x="14" y="308" fill="#94a3b8" fontSize="9.5">
              CONOS FOV ESTIMADOS POR AZIMUT (NO CALIBRADOS) · NODOS SINTÉTICOS SEPARADOS DE CÁMARAS
            </text>
          </svg>

          {/* Sub-sector cards */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
              {labels.subSectorTitle}:
            </div>
            <div style={{ display: 'grid', gap: '0.38rem' }}>
              {sector.subSectors.map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  data-testid={`subsector-btn-${sub.id}`}
                  aria-pressed={selectedSubSectorId === sub.id}
                  onClick={() => setSelectedSubSectorId(sub.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.4rem',
                    border: selectedSubSectorId === sub.id ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.22)',
                    background: selectedSubSectorId === sub.id ? 'rgba(14, 116, 144, 0.32)' : 'rgba(15, 23, 42, 0.6)',
                    color: '#f1f5f9',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span>
                    <b>{sub.id}</b> · {sub.name}
                  </span>
                  <span style={{ color: sub.coveragePct === 0 ? '#fca5a5' : '#fde68a', fontWeight: 600 }}>
                    {sub.towerStatus} ({sub.coveragePct}% cob.)
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 1/4/9 Camera Matrix + Selected Camera Provenance & Freshness Sheet */}
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.65rem',
            border: '1px solid rgba(120, 190, 210, 0.22)',
            background: 'rgba(8, 22, 34, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.86rem', color: '#7dd3fc' }}>{labels.cameraMatrixTitle}</strong>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {([1, 4, 9] as MatrixLayout[]).map(n => (
                <button
                  key={n}
                  type="button"
                  data-testid={`camera-matrix-layout-${n}`}
                  aria-pressed={matrixLayout === n}
                  onClick={() => setMatrixLayout(n)}
                  style={{
                    padding: '0.22rem 0.5rem',
                    borderRadius: '0.28rem',
                    fontSize: '0.72rem',
                    border: matrixLayout === n ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.3)',
                    background: matrixLayout === n ? '#0284c7' : 'transparent',
                    color: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  {n === 1 ? '1×1' : n === 4 ? '2×2 (4)' : '3×3 (9)'}
                </button>
              ))}
            </div>
          </div>

          {/* Camera State Filter Pills */}
          <div role="group" aria-label={labels.filterLabel} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>{labels.filterLabel}</span>
            {(['ALL', 'PUBLIC_CATALOG_VERIFIED', 'SYNTHETIC', 'STALE', 'NO_SIGNAL'] as const).map(st => (
              <button
                key={st}
                type="button"
                data-testid={`camera-filter-${st}`}
                aria-pressed={stateFilter === st}
                onClick={() => setStateFilter(st)}
                style={{
                  padding: '0.2rem 0.48rem',
                  borderRadius: '0.28rem',
                  fontSize: '0.7rem',
                  border: stateFilter === st ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                  background: stateFilter === st ? 'rgba(3, 105, 161, 0.45)' : 'rgba(15, 23, 42, 0.6)',
                  color: '#e2e8f0',
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Camera Feed Cards Grid */}
          <div
            data-testid="sector-camera-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: matrixLayout === 1 ? '1fr' : 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.6rem'
            }}
          >
            {filteredCameras.map(cam => {
              const isSelected = selectedCamera?.id === cam.id;
              const badgeColor =
                cam.state === 'PUBLIC_CATALOG_VERIFIED'
                  ? { bg: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: '#a7f3d0' }
                  : cam.state === 'SYNTHETIC'
                  ? { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#ddd6fe' }
                  : cam.state === 'STALE'
                  ? { bg: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: '#fde68a' }
                  : { bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: '#fecaca' };

              return (
                <article
                  key={cam.id}
                  data-testid={`camera-card-${cam.id}`}
                  onClick={() => setSelectedCameraId(cam.id)}
                  style={{
                    padding: '0.65rem',
                    borderRadius: '0.48rem',
                    border: isSelected ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,0.24)',
                    background: 'rgba(4, 13, 22, 0.9)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.45rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <strong style={{ fontSize: '0.76rem', color: '#f1f5f9' }}>{cam.title}</strong>
                    <span
                      data-testid={`camera-state-badge-${cam.id}`}
                      style={{
                        padding: '0.1rem 0.38rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: badgeColor.bg,
                        border: `1px solid ${badgeColor.border}`,
                        color: badgeColor.text,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {cam.access.permitted ? cam.state : 'RBAC_BLOCKED'}
                    </span>
                  </div>

                  {/* Honest Viewport Box (Never fakes a live video stream with GIFs) */}
                  <div
                    style={{
                      padding: '0.6rem',
                      borderRadius: '0.35rem',
                      background: privacyMosaic
                        ? 'repeating-linear-gradient(45deg, #0f172a, #0f172a 8px, #1e293b 8px, #1e293b 16px)'
                        : '#081523',
                      border: '1px dashed rgba(125, 211, 252, 0.25)',
                      fontSize: '0.71rem',
                      color: '#cbd5e1',
                      minHeight: '68px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    {!cam.access.permitted ? (
                      <span style={{ color: '#fca5a5', fontWeight: 600 }}>
                        🔒 {EVIDENCE_LABELS.UNAVAILABLE_NO_PERMISSION}: {cam.access.status}
                      </span>
                    ) : privacyMosaic ? (
                      <span style={{ color: '#a7f3d0' }}>
                        ▓ MOSAICO DE PRIVACIDAD ACTIVO (Metadatos conservados, vista oculta)
                      </span>
                    ) : cam.state === 'NO_SIGNAL' ? (
                      <span style={{ color: '#fca5a5' }}>
                        ⊘ NO SIGNAL · Sin portadora / corte eléctrico en el escenario
                      </span>
                    ) : cam.state === 'STALE' ? (
                      <span style={{ color: '#fde68a' }}>
                        ⚠ STALE (LECTURA CONGELADA) · Último fotograma: {cam.lastFrameAt} (No es LIVE)
                      </span>
                    ) : cam.state === 'PUBLIC_CATALOG_VERIFIED' ? (
                      <span>
                        ✓ Catálogo Abierto Verificado ({cam.roadOrLandmark}) · Azimut est. {cam.fovEstimate.azimuthDeg}° (No calibrado)
                      </span>
                    ) : (
                      <span style={{ color: '#ddd6fe' }}>
                        ◈ TELEMETRÍA SINTÉTICA DE DEMOSTRACIÓN · {cam.roadOrLandmark}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: '#94a3b8' }}>
                    <span>Frescura: {cam.freshness}</span>
                    <span>{cam.lastFrameAt ? cam.lastFrameAt.slice(11, 19) + ' UTC' : 'N/A'}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Selected Camera Full Provenance, Terms & Privacy Sheet */}
          {selectedCamera && (
            <div
              data-testid="selected-camera-detail-sheet"
              style={{
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: 'rgba(12, 31, 46, 0.9)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                fontSize: '0.75rem',
                lineHeight: 1.5
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                <strong style={{ color: '#7dd3fc' }}>
                  Ficha de Fuente Seleccionada: {selectedCamera.id}
                </strong>
                <span style={{ color: '#fde68a', fontWeight: 600 }}>
                  FOV: {selectedCamera.fovEstimate.azimuthDeg}° / {selectedCamera.fovEstimate.rangeMeters}m (Calibrado: NO)
                </span>
              </div>
              <p style={{ margin: '0.25rem 0', color: '#e2e8f0' }}>
                <b>Proveedor / Titular:</b> {selectedCamera.provider}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#cbd5e1' }}>
                <b>Licencia y atribución:</b> {selectedCamera.license} — <i>{selectedCamera.attribution}</i>
              </p>
              <p style={{ margin: '0.25rem 0', color: '#a7f3d0' }}>
                <b>Valla de privacidad RGPD:</b> {selectedCamera.privacyNotice} (Reconocimiento facial: <code>false</code> · LPR/Matrículas: <code>false</code> · Despacho automático 112: <code>false</code>)
              </p>
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <a
                  href={selectedCamera.officialSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'underline' }}
                >
                  Abrir fuente oficial externa ↗
                </a>
                <a
                  href={selectedCamera.termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#93c5fd', textDecoration: 'underline' }}
                >
                  Condiciones de reutilización / licencia ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Causal Decision Explainer ("Ver cómo decide") + Live Scenario Coupling */}
      <div
        data-testid="sector-decision-explainer"
        style={{
          padding: '1rem',
          borderRadius: '0.65rem',
          border: '1px solid rgba(52, 211, 153, 0.32)',
          background: 'rgba(6, 28, 36, 0.9)',
          marginBottom: '1.25rem'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <button
            type="button"
            data-testid="toggle-decision-explainer"
            aria-expanded={showDecisionDrawer}
            onClick={() => setShowDecisionDrawer(v => !v)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '0.4rem',
              border: '1px solid #34d399',
              background: 'rgba(6, 78, 59, 0.65)',
              color: '#ecfdf5',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            {labels.decisionBtn} {showDecisionDrawer ? '▴' : '▾'}
          </button>

          {/* Interactive Scenario Sliders coupled to explainSectorDecision */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', fontSize: '0.76rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>
                {labels.damageSlider}: <b>{damagedOverride}%</b>
              </span>
              <input
                type="range"
                data-testid="sector-damage-slider"
                min={0}
                max={100}
                step={5}
                value={damagedOverride}
                onChange={e => setDamagedOverride(Number(e.target.value))}
              />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-testid="sector-gateway-checkbox"
                checked={gatewayOverride}
                onChange={e => setGatewayOverride(e.target.checked)}
              />
              <span>{labels.gatewayToggle}</span>
            </label>
          </div>
        </div>

        {showDecisionDrawer && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
            {causalTrace.causalChain.map(item => (
              <article
                key={item.step}
                data-testid={`causal-step-${item.step}`}
                style={{
                  padding: '0.7rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(9, 20, 32, 0.9)',
                  border: '1px solid rgba(125, 211, 252, 0.2)',
                  fontSize: '0.75rem',
                  lineHeight: 1.5
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.3rem', marginBottom: '0.3rem' }}>
                  <strong style={{ color: '#67e8f9' }}>{item.label}</strong>
                </div>
                <p style={{ margin: '0 0 0.4rem 0', color: '#dbeafe' }}>{item.detail}</p>
                <small style={{ color: '#fde68a', fontWeight: 600 }}>{item.evidence}</small>
              </article>
            ))}
          </div>
        )}

        {/* Anti-SSRF & Domain Allowlist Interactive Security Check */}
        <div
          style={{
            marginTop: '0.85rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
            <strong style={{ color: '#93c5fd' }}>🛡️ {labels.ssrfTitle}:</strong>
            <input
              type="text"
              data-testid="ssrf-validator-input"
              aria-label={labels.ssrfTitle}
              value={ssrfTestUrl}
              onChange={e => setSsrfTestUrl(e.target.value)}
              style={{
                padding: '0.28rem 0.55rem',
                borderRadius: '0.3rem',
                border: '1px solid rgba(148,163,184,0.4)',
                background: '#040d16',
                color: '#f8fafc',
                fontSize: '0.74rem',
                minWidth: '240px'
              }}
            />
            <button
              type="button"
              data-testid="ssrf-test-loopback"
              onClick={() => setSsrfTestUrl('http://127.0.0.1:8080/private-cam')}
              style={{ padding: '0.24rem 0.5rem', borderRadius: '0.28rem', background: '#334155', color: '#f8fafc', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Probar bloqueo SSRF (127.0.0.1)
            </button>
            <button
              type="button"
              data-testid="ssrf-test-dgt"
              onClick={() => setSsrfTestUrl('https://infocar.dgt.es/etraffic/')}
              style={{ padding: '0.24rem 0.5rem', borderRadius: '0.28rem', background: '#0369a1', color: '#f8fafc', border: 'none', fontSize: '0.7rem', cursor: 'pointer' }}
            >
              Probar dominio DGT permitido
            </button>
          </div>
          <code
            data-testid="ssrf-validator-verdict"
            style={{
              padding: '0.22rem 0.55rem',
              borderRadius: '0.3rem',
              background: ssrfVerdict.allowed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.22)',
              color: ssrfVerdict.allowed ? '#a7f3d0' : '#fecaca',
              fontWeight: 700
            }}
          >
            {ssrfVerdict.allowed ? `ALLOW: ${ssrfVerdict.reason}` : `BLOCK: ${ssrfVerdict.reason}`}
          </code>
        </div>
      </div>

      {/* Section 7: Unified 8-Link Interactive Pipeline (OBSERVAR → DECIDIR → COORDINAR) */}
      <div
        id="unified-pipeline-explorer"
        data-testid="unified-pipeline-explorer"
        style={{
          padding: '1rem',
          borderRadius: '0.65rem',
          border: '1px solid rgba(125, 211, 252, 0.25)',
          background: 'rgba(9, 23, 36, 0.94)'
        }}
      >
        <div style={{ marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '0.88rem', color: '#38bdf8', display: 'block' }}>{labels.pipeHeading}</strong>
          <span style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>{labels.pipeSub}</span>
        </div>

        <div
          role="group"
          aria-label={labels.pipeHeading}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '0.45rem',
            marginBottom: '0.85rem'
          }}
        >
          {pipeNodes.map((node, idx) => (
            <button
              key={node.id}
              type="button"
              data-testid={`pipeline-node-${idx}`}
              aria-pressed={activePipeIndex === idx}
              onClick={() => setActivePipeIndex(idx)}
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: '0.42rem',
                border: activePipeIndex === idx ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,0.25)',
                background: activePipeIndex === idx ? 'rgba(3, 105, 161, 0.45)' : 'rgba(15, 23, 42, 0.7)',
                color: '#f8fafc',
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <small style={{ display: 'block', fontSize: '0.65rem', color: '#7dd3fc', fontWeight: 700 }}>
                {node.layer}
              </small>
              <strong style={{ fontSize: '0.75rem' }}>{node.title}</strong>
            </button>
          ))}
        </div>

        {/* Expanded 5-Field Card for the Active Pipeline Link */}
        <div
          data-testid="pipeline-active-detail"
          style={{
            padding: '0.85rem',
            borderRadius: '0.5rem',
            background: 'rgba(4, 12, 20, 0.92)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.76rem',
            lineHeight: 1.5
          }}
        >
          <div>
            <strong style={{ color: '#fca5a5', display: 'block' }}>1. Problema que resuelve</strong>
            <p style={{ margin: '0.2rem 0 0 0', color: '#e2e8f0' }}>{activePipe.problem}</p>
          </div>
          <div>
            <strong style={{ color: '#93c5fd', display: 'block' }}>2. Entrada (Input)</strong>
            <p style={{ margin: '0.2rem 0 0 0', color: '#e2e8f0' }}>{activePipe.input}</p>
          </div>
          <div>
            <strong style={{ color: '#fde68a', display: 'block' }}>3. Regla / Decisión</strong>
            <p style={{ margin: '0.2rem 0 0 0', color: '#e2e8f0' }}>{activePipe.decision}</p>
          </div>
          <div>
            <strong style={{ color: '#a7f3d0', display: 'block' }}>4. Salida (Output)</strong>
            <p style={{ margin: '0.2rem 0 0 0', color: '#e2e8f0' }}>{activePipe.output}</p>
          </div>
          <div>
            <strong style={{ color: '#c4b5fd', display: 'block' }}>5. Estado de evidencia y código</strong>
            <p style={{ margin: '0.2rem 0 0.35rem 0', color: '#fde68a', fontWeight: 700 }}>{activePipe.evidence}</p>
            <a
              href={activePipe.moduleUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}
            >
              <code>{activePipe.modulePath}</code> ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
