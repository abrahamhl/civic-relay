import type { EvidenceStatus, Locale, LocalizedText } from '../data/types';

export type LayerId =
  | 'incidents'
  | 'routes'
  | 'relays'
  | 'coverage'
  | 'infrastructure'
  | 'hazard'
  | 'transport';

export type EntityKind = 'event' | 'sensor' | 'route' | 'team' | 'decision';
export type Priority = 'critical' | 'high' | 'medium' | 'info';

export interface MapEntity {
  id: string;
  kind: EntityKind;
  layer: LayerId;
  priority: Priority;
  timeOffsetMin: number;
  lat: number;
  lon: number;
  title: LocalizedText;
  summary: LocalizedText;
  status: EvidenceStatus;
  evidenceId: string;
  sourceTag: string;
  metrics: Array<{ label: LocalizedText; value: string }>;
}

export interface RouteArc {
  id: string;
  from: [number, number]; // [lon, lat]
  to: [number, number];
  via?: [number, number];
  label: LocalizedText;
  channel: 'ble-sat' | 'leo-d2d' | 'sms' | 'acoustic' | 'baseline';
  etaMin: number;
  status: EvidenceStatus;
}

export interface CorrelationLink {
  fromId: string;
  toId: string;
  relation: LocalizedText;
  explanation: LocalizedText;
  evidenceId: string;
}

export interface PlatformScenario {
  id: string;
  code: string;
  name: LocalizedText;
  subtitle: LocalizedText;
  regionCenter: [number, number]; // [lon, lat]
  regionZoom: number;
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  sendaEtaMin: number;
  baselineEtaMin: number;
  evidenceId: string;
  entities: MapEntity[];
  routes: RouteArc[];
  links: CorrelationLink[];
}

export const LAYER_META: Record<
  LayerId,
  { label: LocalizedText; defaultOn: boolean; defaultStatus: EvidenceStatus }
> = {
  incidents: {
    label: { en: 'Incidents', es: 'Incidentes', nl: 'Incidenten' },
    defaultOn: true,
    defaultStatus: 'observed'
  },
  routes: {
    label: { en: 'Message routes', es: 'Rutas de mensaje', nl: 'Berichtroutes' },
    defaultOn: true,
    defaultStatus: 'simulated'
  },
  relays: {
    label: { en: 'Relay nodes', es: 'Nodos relé', nl: 'Relay-knooppunten' },
    defaultOn: true,
    defaultStatus: 'simulated'
  },
  coverage: {
    label: { en: 'Coverage / blackout', es: 'Cobertura / apagón', nl: 'Dekking / uitval' },
    defaultOn: true,
    defaultStatus: 'simulated'
  },
  infrastructure: {
    label: { en: 'Infrastructure', es: 'Infraestructura', nl: 'Infrastructuur' },
    defaultOn: true,
    defaultStatus: 'observed'
  },
  hazard: {
    label: { en: 'Weather / Wildfire', es: 'Meteorología / Fuego', nl: 'Weer / Natuurbrand' },
    defaultOn: true,
    defaultStatus: 'observed'
  },
  transport: {
    label: { en: 'Rail & Maritime', es: 'Ferrocarril y marítimo', nl: 'Spoor & scheepvaart' },
    defaultOn: false,
    defaultStatus: 'simulated'
  }
};

function makeScenario(
  id: string,
  code: string,
  name: LocalizedText,
  subtitle: LocalizedText,
  center: [number, number],
  span: [number, number],
  sendaEtaMin: number,
  baselineEtaMin: number,
  evidenceId: string,
  anchorLabel: LocalizedText,
  sensorLabel: LocalizedText,
  routeLabel: LocalizedText,
  teamLabel: LocalizedText,
  decisionLabel: LocalizedText,
  extraLayer: LayerId,
  correlationSentence: LocalizedText
): PlatformScenario {
  const [lon, lat] = center;
  const [dLon, dLat] = span;

  const evId = `${code}-EVT`;
  const senId = `${code}-SEN`;
  const rtId = `${code}-RTE`;
  const tmId = `${code}-TEM`;
  const decId = `${code}-DEC`;
  const infId = `${code}-INF`;
  const trnId = `${code}-TRN`;

  return {
    id,
    code,
    name,
    subtitle,
    regionCenter: center,
    regionZoom: dLon > 8 ? 4.4 : dLon > 2 ? 7.2 : 9.4,
    bbox: {
      minLon: lon - dLon,
      maxLon: lon + dLon,
      minLat: lat - dLat,
      maxLat: lat + dLat
    },
    sendaEtaMin,
    baselineEtaMin,
    evidenceId,
    entities: [
      {
        id: evId,
        kind: 'event',
        layer: 'incidents',
        priority: 'critical',
        timeOffsetMin: 0,
        lat,
        lon,
        title: anchorLabel,
        summary: subtitle,
        status: evidenceId === 'EV-FIRE-SMV' || evidenceId === 'EV-FLOOD-DANA' || evidenceId === 'EV-CONSOLE-16K' ? 'observed' : 'simulated',
        evidenceId,
        sourceTag: evidenceId,
        metrics: [
          { label: { en: 'SENDA ETA', es: 'ETA SENDA', nl: 'SENDA ETA' }, value: `~${sendaEtaMin} min` },
          { label: { en: 'Cellular baseline', es: 'Línea base móvil', nl: 'Mobiele baseline' }, value: `${baselineEtaMin} min` },
          { label: { en: 'Human silence rule', es: 'Regla de silencio', nl: 'Stilteregel' }, value: 'UNKNOWN (never casualty)' }
        ]
      },
      {
        id: senId,
        kind: 'sensor',
        layer: extraLayer,
        priority: 'high',
        timeOffsetMin: 2,
        lat: lat + dLat * 0.28,
        lon: lon - dLon * 0.26,
        title: sensorLabel,
        summary: {
          en: 'Corroborating telemetry input checked for upstream feed independence.',
          es: 'Entrada de sensor verificada para evitar duplicidad de fuentes aguas arriba.',
          nl: 'Bevestigende sensorinvoer gecontroleerd op brononafhankelijkheid.'
        },
        status: extraLayer === 'hazard' ? 'observed' : 'simulated',
        evidenceId,
        sourceTag: extraLayer === 'hazard' ? 'Copernicus / NOAA snapshot' : 'Simulated sensor',
        metrics: [
          { label: { en: 'Confidence', es: 'Confianza', nl: 'Betrouwbaarheid' }, value: 'Bounded (research)' },
          { label: { en: 'Freshness', es: 'Vigencia', nl: 'Actualiteit' }, value: 'Snapshot / Sim' }
        ]
      },
      {
        id: rtId,
        kind: 'route',
        layer: 'relays',
        priority: 'high',
        timeOffsetMin: Math.min(sendaEtaMin, 15),
        lat: lat - dLat * 0.14,
        lon: lon + dLon * 0.24,
        title: routeLabel,
        summary: {
          en: 'Blind E2EE relay path (ECDH P-256 + AES-GCM) racing multipath channels with signed ACK.',
          es: 'Ruta por relé ciego E2E (ECDH P-256 + AES-GCM) en carrera multicanal con ACK firmado.',
          nl: 'Blinde E2EE-relayroute (ECDH P-256 + AES-GCM) over meerdere kanalen met ondertekende ACK.'
        },
        status: 'simulated',
        evidenceId: 'EV-S01-ROUTE',
        sourceTag: 'router.mjs (Simulated)',
        metrics: [
          { label: { en: 'Envelope size', es: 'Tamaño sobre', nl: 'Envelopgrootte' }, value: '~300 B' },
          { label: { en: 'Physical RF status', es: 'Estado RF físico', nl: 'Fysieke RF-status' }, value: '0/30 trials' }
        ]
      },
      {
        id: tmId,
        kind: 'team',
        layer: 'infrastructure',
        priority: 'medium',
        timeOffsetMin: 8,
        lat: lat + dLat * 0.22,
        lon: lon + dLon * 0.34,
        title: teamLabel,
        summary: {
          en: 'Accredited coordination unit receiving deduplicated situation summary (secondary channel, non-112).',
          es: 'Unidad acreditada que recibe síntesis deduplicada (canal secundario, no sustituye al 112).',
          nl: 'Geaccrediteerde eenheid die ontdubbelde situatie-updates ontvangt (secundair kanaal).'
        },
        status: 'simulated',
        evidenceId: 'EV-10-INST',
        sourceTag: 'roles.mjs (Simulated)',
        metrics: [
          { label: { en: 'Trust anchor', es: 'Ancla de confianza', nl: 'Vertrouwensanker' }, value: 'Lab key only' },
          { label: { en: 'Live 112 link', es: 'Conexión 112 real', nl: 'Live 112-link' }, value: 'None' }
        ]
      },
      {
        id: decId,
        kind: 'decision',
        layer: 'coverage',
        priority: 'medium',
        timeOffsetMin: 12,
        lat: lat - dLat * 0.28,
        lon: lon - dLon * 0.12,
        title: decisionLabel,
        summary: {
          en: 'Simulated operator decision gated by two-step confirmation and logged in the audit trail.',
          es: 'Decisión operativa simulada sujeta a confirmación en dos pasos y registrada en auditoría.',
          nl: 'Gesimuleerde beslissing met tweestapsbevestiging en zichtbaar auditlogboek.'
        },
        status: 'simulated',
        evidenceId: 'EV-02-SWEEP',
        sourceTag: 'zones.mjs (Simulated)',
        metrics: [
          { label: { en: 'Consent policy', es: 'Consentimiento', nl: 'Toestemming' }, value: 'Pre-authorized opt-in' },
          { label: { en: 'Operational use', es: 'Uso operativo', nl: 'Operationeel' }, value: 'Disabled (Lab)' }
        ]
      },
      {
        id: infId,
        kind: 'sensor',
        layer: 'infrastructure',
        priority: 'info',
        timeOffsetMin: 4,
        lat: lat - dLat * 0.32,
        lon: lon + dLon * 0.16,
        title: {
          en: 'Cellular Tower / Substation Watch',
          es: 'Torre celular / Subestación',
          nl: 'Zendmast / Onderstation'
        },
        summary: {
          en: 'Monitors local backhaul outage window and battery depletion threshold.',
          es: 'Monitoriza ventana de corte de red y agotamiento de baterías en la zona.',
          nl: 'Bewaakt uitvalvenster en accuniveau van lokale masten.'
        },
        status: 'simulated',
        evidenceId: 'EV-02-SWEEP',
        sourceTag: 'blackout.mjs (Simulated)',
        metrics: [
          { label: { en: 'Backhaul', es: 'Enlace troncal', nl: 'Backhaul' }, value: 'Degraded (Sim)' }
        ]
      },
      {
        id: trnId,
        kind: 'sensor',
        layer: 'transport',
        priority: 'info',
        timeOffsetMin: 18,
        lat: lat + dLat * 0.08,
        lon: lon - dLon * 0.38,
        title: {
          en: 'Rail / Maritime Corridor Feed',
          es: 'Corredor ferroviario / marítimo',
          nl: 'Spoor- & scheepvaartcorridor'
        },
        summary: {
          en: 'Simulated corridor traffic layer modeling mule vehicles, rail stops, or coastal gateways.',
          es: 'Capa simulada de corredores ferroviarios/marítimos y vehículos mula en tránsito.',
          nl: 'Gesimuleerde spoor-/scheepvaartlaag voor mobiele gateways.'
        },
        status: 'simulated',
        evidenceId: 'EV-RAIL-ADAMUZ',
        sourceTag: 'rail-watch.mjs (Simulated)',
        metrics: [
          { label: { en: 'Corridor mode', es: 'Modo corredor', nl: 'Corridormodus' }, value: 'Simulated feed' }
        ]
      }
    ],
    routes: [
      {
        id: `${code}-R1`,
        from: [lon, lat],
        via: [lon + dLon * 0.24, lat - dLat * 0.14],
        to: [lon + dLon * 0.34, lat + dLat * 0.22],
        label: {
          en: `Primary SENDA path (~${sendaEtaMin} min)`,
          es: `Ruta principal SENDA (~${sendaEtaMin} min)`,
          nl: `Primaire SENDA-route (~${sendaEtaMin} min)`
        },
        channel: 'ble-sat',
        etaMin: sendaEtaMin,
        status: 'simulated'
      },
      {
        id: `${code}-R2`,
        from: [lon, lat],
        via: [lon - dLon * 0.26, lat + dLat * 0.28],
        to: [lon + dLon * 0.34, lat + dLat * 0.22],
        label: {
          en: 'Parallel LEO D2D / Gateway backup (~91 min)',
          es: 'Respaldo paralelo satélite D2D / pasarela (~91 min)',
          nl: 'Parallelle satelliet D2D / gateway-backup (~91 min)'
        },
        channel: 'leo-d2d',
        etaMin: 91,
        status: 'simulated'
      }
    ],
    links: [
      {
        fromId: evId,
        toId: senId,
        relation: { en: 'corroborated by', es: 'corroborado por', nl: 'bevestigd door' },
        explanation: correlationSentence,
        evidenceId
      },
      {
        fromId: evId,
        toId: rtId,
        relation: { en: 'routed via', es: 'enrutado por', nl: 'gerouteerd via' },
        explanation: {
          en: `Contact Graph Routing races multipath channels so the message arrives in ~${sendaEtaMin} min instead of waiting ${baselineEtaMin} min for cellular recovery (simulated).`,
          es: `Contact Graph Routing compite en paralelo para entregar en ~${sendaEtaMin} min frente a los ${baselineEtaMin} min de la línea base celular (simulado).`,
          nl: `Contact Graph Routing benut parallelle paden voor levering in ~${sendaEtaMin} min tegenover ${baselineEtaMin} min mobiele baseline (gesimuleerd).`
        },
        evidenceId: 'EV-S01-ROUTE'
      },
      {
        fromId: rtId,
        toId: tmId,
        relation: { en: 'delivers ACK to', es: 'entrega ACK a', nl: 'levert ACK aan' },
        explanation: {
          en: 'Signed receiver receipt confirms delivery and purges intermediate blind-relay copies across the mesh.',
          es: 'El recibo firmado por el receptor confirma entrega y purga copias en los relés ciegos intermedios.',
          nl: 'Ondertekende ontvangstbevestiging verifieert bezorging en wist kopieën bij tussenliggende relays.'
        },
        evidenceId: 'EV-CORE-506'
      },
      {
        fromId: senId,
        toId: decId,
        relation: { en: 'informs', es: 'fundamenta', nl: 'onderbouwt' },
        explanation: {
          en: 'Corroborated multi-source evidence unlocks the simulated pre-authorized relay decision with human two-step confirmation.',
          es: 'La evidencia corroborada habilita la decisión simulada de modo relé preautorizado tras confirmación humana en dos pasos.',
          nl: 'Bevestigd bewijs maakt de gesimuleerde relay-beslissing mogelijk na menselijke tweestapsbevestiging.'
        },
        evidenceId: 'EV-02-SWEEP'
      },
      {
        fromId: decId,
        toId: tmId,
        relation: { en: 'dispatches (sim)', es: 'asigna (sim)', nl: 'wijst toe (sim)' },
        explanation: {
          en: 'Simulated assignment recorded in the operator audit log; never connected to live 112 dispatch.',
          es: 'Asignación simulada registrada en el historial de auditoría; jamás conectada a un despacho real del 112.',
          nl: 'Gesimuleerde toewijzing vastgelegd in het auditlogboek; niet verbonden met echte 112-dispatch.'
        },
        evidenceId: 'EV-10-INST'
      }
    ]
  };
}

export const PLATFORM_SCENARIOS: PlatformScenario[] = [
  makeScenario(
    's01',
    'S01',
    { en: 'S01 · Arnhem -> San Martín', es: 'S01 · Arnhem -> San Martín', nl: 'S01 · Arnhem -> San Martín' },
    {
      en: '8 h local tower blackout; neighbor satellite + BLE hop races direct-to-cell and cellular baseline.',
      es: 'Apagón de antena de 8 h; salto BLE + satélite vecino compite contra satélite directo y celular.',
      nl: '8 uur zendmastuitval; BLE-hop + buursatelliet versus direct-to-cell en mobiele baseline.'
    },
    [-4.39, 40.36],
    [1.6, 1.1],
    4,
    480,
    'EV-S01-ROUTE',
    { en: 'San Martín Tower Blackout', es: 'Apagón antena San Martín', nl: 'Zendmastuitval San Martín' },
    { en: 'DGT / Tower Heartbeat Loss', es: 'Pérdida de enlace DGT / torre', nl: 'Uitval DGT / mastsignaal' },
    { en: 'BLE -> Neighbor Satellite Hop', es: 'Salto BLE -> Vecina con satélite', nl: 'BLE -> Buursatelliet-hop' },
    { en: 'Family Receiver (Arnhem)', es: 'Receptor familiar (Arnhem)', nl: 'Familie-ontvanger (Arnhem)' },
    { en: 'Activate Pre-Auth Relay Zone', es: 'Activar zona relé preautorizada', nl: 'Activeer vooraf geautoriseerde relay' },
    'infrastructure',
    {
      en: 'Tower heartbeat loss correlates with DGT corridor outage, isolating the local cell for 8 h (simulated scenario S01).',
      es: 'La pérdida de señal de la antena se correlaciona con el corte local, aislando el sector durante 8 h (escenario simulado S01).',
      nl: 'Signaalverlies van de mast correleert met lokale uitval van 8 uur (gesimuleerd scenario S01).'
    }
  ),
  makeScenario(
    's02',
    'S02',
    { en: 'S02 · Wildfire Interface (SMV)', es: 'S02 · Incendio forestal (SMV)', nl: 'S02 · Natuurbrand (SMV)' },
    {
      en: 'San Martín de Valdeiglesias 868 ha Sentinel-2 burn scar + GFS wind + opportunistic camera triangulation.',
      es: 'Incendio San Martín de Valdeiglesias (868 ha Sentinel-2) + viento GFS + triangulación por cámaras.',
      nl: 'San Martín de Valdeiglesias 868 ha Sentinel-2-litteken + GFS-wind + cameratriangulatie.'
    },
    [-4.41, 40.37],
    [0.5, 0.35],
    6,
    180,
    'EV-FIRE-SMV',
    { en: 'M-501 Ignition & 868 ha Scar', es: 'Ignición M-501 y cicatriz 868 ha', nl: 'M-501 ontsteking & 868 ha litteken' },
    { en: 'Sentinel-2 dNBR + NOAA GFS', es: 'Sentinel-2 dNBR + NOAA GFS', nl: 'Sentinel-2 dNBR + NOAA GFS' },
    { en: 'PAER Hazard-Aware DTN Path', es: 'Ruta DTN consciente del frente (PAER)', nl: 'PAER gevaarbewuste DTN-route' },
    { en: 'Forestry Command Unit (Sim)', es: 'Puesto de mando forestal (Sim)', nl: 'Bosbrandcommando (Sim)' },
    { en: 'Issue Secondary Corridor Alert', es: 'Emitir aviso secundario en vía', nl: 'Secundaire corridorwaarschuwing' },
    'hazard',
    {
      en: 'Observed Sentinel-2 burn scar (868 ha, 24-07-2026) and GFS Haines 6 profile anchor the wildfire corridor; H-FIRE-B external spread stays inconclusive.',
      es: 'La cicatriz Sentinel-2 observada (868 ha, 24-07-2026) y el índice Haines 6 de GFS anclan el incidente; la predicción H-FIRE-B externa sigue inconclusa.',
      nl: 'Waargenomen Sentinel-2-litteken (868 ha) en GFS Haines 6 verankeren het incident; externe H-FIRE-B-voorspelling blijft onbeslist.'
    }
  ),
  makeScenario(
    's03',
    'S03',
    { en: 'S03 · Flood Isolation (ES / NL)', es: 'S03 · Inundación (ES / NL)', nl: 'S03 · Overstroming (ES / NL)' },
    {
      en: 'Copernicus EMSR773 flood polygons cut OSM roads in l’Horta Sud; paired with 25 RWS Dutch water gauges.',
      es: 'Polígonos Copernicus EMSR773 cortan vías en l’Horta Sud; complementado con 25 estaciones RWS en Países Bajos.',
      nl: 'Copernicus EMSR773 snijdt wegen in l’Horta Sud af; gekoppeld aan 25 RWS-waterstations in Nederland.'
    },
    [-0.41, 39.42],
    [0.55, 0.35],
    9,
    240,
    'EV-FLOOD-DANA',
    { en: 'l’Horta Sud Cut-Off Dry Nodes', es: 'Cruces secos aislados (l’Horta Sud)', nl: 'Afgesloten droge wijken (l’Horta Sud)' },
    { en: 'Copernicus EMSR773 Footprint', es: 'Huella satélite Copernicus EMSR773', nl: 'Copernicus EMSR773-satellietdata' },
    { en: 'Vehicle Mule + Acoustic Hop', es: 'Mula vehicular + salto acústico', nl: 'Voertuigmule + akoestische hop' },
    { en: 'Municipal Civil Protection (Sim)', es: 'Protección Civil municipal (Sim)', nl: 'Gemeentelijke hulpverlening (Sim)' },
    { en: 'Deploy Portable Relay Node', es: 'Desplegar repetidor portátil (Sim)', nl: 'Mobiele repeater inzetten (Sim)' },
    'hazard',
    {
      en: 'Observed EMSR773 flood polygons sever dry street clusters from nearby hospitals on the OSM road graph.',
      es: 'El agua observada en EMSR773 corta el acceso vial de cruces secos hacia hospitales cercanos sobre el grafo OSM.',
      nl: 'Waargenomen EMSR773-waterpolygonen blokkeren routes van droge straten naar ziekenhuizen op het OSM-wegennet.'
    }
  ),
  makeScenario(
    's04',
    'S04',
    { en: 'S04 · Earthquake & First Waves', es: 'S04 · Sismo y primeras ondas', nl: 'S04 · Aardbeving en eerste golven' },
    {
      en: 'Handset STA/LTA triggers corroborated against USGS/EMSC seismic catalogs before enabling pre-authorized relay.',
      es: 'Disparos STA/LTA en móviles corroborados con catálogos USGS/EMSC antes de activar el modo relé.',
      nl: 'STA/LTA-triggers op toestellen bevestigd met USGS/EMSC vóór activering van relay-modus.'
    },
    [-3.6, 37.18],
    [1.4, 0.9],
    3,
    120,
    'EV-CONSOLE-16K',
    { en: 'Corroborated M 5.2 Seismic Event', es: 'Evento sísmico M 5,2 corroborado', nl: 'Bevestigde M 5,2 aardbeving' },
    { en: 'USGS / EMSC Independent Check', es: 'Contraste independiente USGS / EMSC', nl: 'Onafhankelijke USGS / EMSC-check' },
    { en: 'Zero-Touch Standby -> Relay Mesh', es: 'Paso Standby -> Malla relé', nl: 'Standby -> Relay-mesh overgang' },
    { en: 'Regional Seismic Desk (Sim)', es: 'Mesa sísmica regional (Sim)', nl: 'Regionaal seismisch centrum (Sim)' },
    { en: 'Corroborate Zone (No Single Source)', es: 'Corroborar zona (multisource)', nl: 'Zone bevestigen (multibron)' },
    'hazard',
    {
      en: 'Cross-source audit verifies USGS vs EMSC independence and rejects GDACS mirror duplication before declaring the zone.',
      es: 'La auditoría cruzada comprueba independencia USGS/EMSC y descarta la réplica de GDACS antes de declarar la zona.',
      nl: 'Cross-source audit controleert onafhankelijkheid en negeert GDACS-duplicaten vóór zone-activering.'
    }
  ),
  makeScenario(
    's05',
    'S05',
    { en: 'S05 · Collapsed Building Bridge', es: 'S05 · Edificio colapsado', nl: 'S05 · Ingestort gebouw' },
    {
      en: 'Surface phone bridges a trapped person’s BLE beacon; ESP32 Wi-Fi CSI model illustrates wall attenuation (untested physically).',
      es: 'Un móvil en superficie hace de puente BLE para persona atrapada; modelo Wi-Fi CSI tras muros (sin prueba física).',
      nl: 'Toestel bovengronds overbrugt BLE-baken onder puin; Wi-Fi CSI-model achter muren (niet fysiek getest).'
    },
    [-3.7, 40.42],
    [0.12, 0.08],
    2,
    90,
    'EV-10-INST',
    { en: 'Block B14 · Floor 3 Signal (Sim)', es: 'Bloque B14 · Planta 3 (Simulado)', nl: 'Blok B14 · Verdieping 3 (Sim)' },
    { en: 'BLE RSSI + ESP32 CSI Model', es: 'Modelo BLE RSSI + ESP32 CSI', nl: 'BLE RSSI + ESP32 CSI-model' },
    { en: 'Surface Handset BLE Bridge', es: 'Puente BLE desde superficie', nl: 'BLE-brug vanaf oppervlak' },
    { en: 'USAR Rescue Squad (Sim)', es: 'Equipo USAR de rescate (Sim)', nl: 'USAR-reddingsteam (Sim)' },
    { en: 'Send Signed Floor-3 Beacon Order', es: 'Enviar orden firmada a Planta 3', nl: 'Ondertekende bakenopdracht sturen' },
    'relays',
    {
      en: 'Surface handset bridges the trapped BLE beacon and aggregates resident check-ins while keeping silence strictly labeled UNKNOWN.',
      es: 'El móvil en superficie puentea la baliza BLE y agrega respuestas por planta manteniendo el silencio como UNKNOWN.',
      nl: 'Het bovengrondse toestel overbrugt het BLE-baken en houdt stilte strikt gemarkeerd als UNKNOWN.'
    }
  ),
  makeScenario(
    's06',
    'S06',
    { en: 'S06 · Drone Relay & Terrain', es: 'S06 · Rescate con drones', nl: 'S06 · Redding met drones' },
    {
      en: 'Al-Hourani optimal relay altitude over Copernicus DEM GLO-30; telemetry only, no certified C2 flight control.',
      es: 'Altitud óptima de relé Al-Hourani sobre Copernicus DEM GLO-30; solo telemetría, sin control de vuelo C2.',
      nl: 'Optimale Al-Hourani relay-hoogte boven Copernicus DEM; alleen telemetrie, geen C2-vluchtbesturing.'
    },
    [-0.52, 39.46],
    [0.35, 0.22],
    5,
    150,
    'EV-CORE-506',
    { en: 'Shadowed Ravine Isolation (Poyo)', es: 'Barranco en sombra RF (Poyo)', nl: 'RF-schaduwzone (Poyo)' },
    { en: 'Copernicus DEM GLO-30 LoS', es: 'Línea de vista DEM GLO-30', nl: 'Copernicus DEM zichtlijn' },
    { en: 'Airborne Relay Node (Model)', es: 'Nodo relé aéreo (Modelo)', nl: 'Lucht-relayknooppunt (Model)' },
    { en: 'Accredited Drone Operator (Sim)', es: 'Operador dron acreditado (Sim)', nl: 'Bevoegde drone-operator (Sim)' },
    { en: 'Position Temporary Relay Point', es: 'Posicionar punto relé temporal', nl: 'Tijdelijk relaypunt plaatsen' },
    'relays',
    {
      en: 'ITU-R P.526 diffraction over Copernicus DEM identifies terrain shadow and places a simulated relay node to close the partition.',
      es: 'La difracción ITU-R P.526 sobre DEM Copernicus detecta sombra orográfica y propone un nodo relé para cerrar la partición.',
      nl: 'ITU-R P.526-diffractie op Copernicus DEM toont terreinschaduw en plaatst een gesimuleerd relaypunt.'
    }
  ),
  makeScenario(
    's07',
    'S07',
    { en: 'S07 · Multi-Agency Coordination', es: 'S07 · Coordinación multiactor', nl: 'S07 · Multi-actor coördinatie' },
    {
      en: 'Isolated internal channels for fire, police, medical, and civil protection with signed agency trust anchors.',
      es: 'Canales internos aislados para bomberos, policía, sanidad y protección civil con anclas firmadas.',
      nl: 'Gescheiden kanalen voor brandweer, politie en medische diensten met ondertekende ankers.'
    },
    [5.91, 51.98],
    [0.6, 0.35],
    3,
    95,
    'EV-CORE-506',
    { en: 'A12 Arnhem-Ede Multi-Vehicle Event', es: 'Incidente múltiple A12 Arnhem-Ede', nl: 'Meervoudig incident A12 Arnhem-Ede' },
    { en: 'NDW CC0 Traffic Snapshot', es: 'Snapshot tráfico NDW (CC0)', nl: 'NDW CC0-verkeerssnapshot' },
    { en: 'Inter-Agency Signed Bus (Sim)', es: 'Bus firmado interagencia (Sim)', nl: 'Ondertekende inter-agency bus (Sim)' },
    { en: 'Fire + Police + Medical (Sim)', es: 'Bomberos + Policía + Sanidad', nl: 'Brandweer + Politie + Medisch' },
    { en: 'Approve Safe Status Update', es: 'Validar estado «Localizado a salvo»', nl: 'Status «Veilig gelokaliseerd» goedkeuren' },
    'transport',
    {
      en: 'Verified agency credential authorizes updating a person’s status while volunteers remain read-scoped and internal channels stay isolated.',
      es: 'Solo una credencial de organismo verificada puede cambiar el estado a «a salvo»; los canales internos permanecen aislados.',
      nl: 'Alleen geverifieerde diensten mogen statussen bijwerken; interne kanalen blijven strikt gescheiden.'
    }
  ),
  makeScenario(
    's08',
    'S08',
    { en: 'S08 · Regional Power & Net Outage', es: 'S08 · Apagón e Internet caído', nl: 'S08 · Regionale stroom- en netuitval' },
    {
      en: 'Multi-carrier outage benchmark (120 blocks): ARR_REPLAN_V2 with ACK gossip holds 94.2% simulated delivery at 694 mJ.',
      es: 'Apagón multired (120 bloques): ARR_REPLAN_V2 con gossip ACK logra 94,2 % entrega simulada con 694 mJ.',
      nl: 'Regionale uitval (120 blokken): ARR_REPLAN_V2 met ACK-gossip haalt 94,2% bezorging bij 694 mJ.'
    },
    [-3.7, 40.41],
    [3.8, 2.4],
    11,
    360,
    'EV-ARR-V2',
    { en: 'Iberian Corridor Grid Blackout (Sim)', es: 'Apagón corredor ibérico (Sim)', nl: 'Regionale netuitval corridor (Sim)' },
    { en: 'ARR_REPLAN_V2 Telemetry', es: 'Telemetría ARR_REPLAN_V2', nl: 'ARR_REPLAN_V2-telemetrie' },
    { en: 'k-of-n Shards + ACK Gossip', es: 'Fragmentos k-de-n + gossip ACK', nl: 'k-van-n fragmenten + ACK-gossip' },
    { en: 'Resilience Ops Desk (Sim)', es: 'Centro de resiliencia (Sim)', nl: 'Weerbaarheidscentrum (Sim)' },
    { en: 'Enforce Energy Cap (2100 mJ)', es: 'Aplicar cuota energía (2100 mJ)', nl: 'Energieplafond activeren (2100 mJ)' },
    'coverage',
    {
      en: 'Receding-horizon custodian replanning cuts energy use by 84% vs epidemic flooding while holding 94.2% simulated delivery.',
      es: 'La replanificación de custodia reduce el consumo energético un 84 % frente a Epidemic manteniendo 94,2 % de entrega simulada.',
      nl: 'Herplanning verlaagt energieverbruik met 84% versus epidemisch versturen bij 94,2% gesimuleerde bezorging.'
    }
  )
];

export interface TourStep {
  target: 'topbar' | 'left' | 'map' | 'graph' | 'inspector' | 'timeline';
  title: LocalizedText;
  body: LocalizedText;
}

export const GUIDED_TOUR_STEPS: TourStep[] = [
  {
    target: 'topbar',
    title: { en: '1/6 · Scenarios & ⌘K Command Bar', es: '1/6 · Escenarios y barra ⌘K', nl: '1/6 · Scenario’s & ⌘K-balk' },
    body: {
      en: 'Switch across all 8 canonical SENDA scenarios or press ⌘K / Ctrl+K anytime to jump to an incident, toggle views, or export a JSON report.',
      es: 'Cambia entre los 8 escenarios canónicos de SENDA o pulsa ⌘K / Ctrl+K en cualquier momento para saltar a un incidente o exportar un informe JSON.',
      nl: 'Wissel tussen alle 8 canonieke scenario’s of druk op ⌘K / Ctrl+K om direct naar een incident te springen of een JSON-rapport te exporteren.'
    }
  },
  {
    target: 'left',
    title: { en: '2/6 · Layers & Priority Event Queue', es: '2/6 · Capas y cola de eventos', nl: '2/6 · Lagen & gebeurtenissenwachtrij' },
    body: {
      en: 'Toggle 7 map layers and filter the priority-sorted event queue. Real public snapshots (GDACS, DGT, NDW, USGS) are clearly separated from simulated mesh overlays.',
      es: 'Activa o apaga las 7 capas del mapa y filtra la cola ordenada por prioridad. Las capturas reales (GDACS, DGT, NDW, USGS) se distinguen siempre de lo simulado.',
      nl: 'Schakel 7 kaartlagen en filter de wachtrij op prioriteit. Echte snapshots (GDACS, DGT, NDW, USGS) zijn altijd onderscheiden van simulaties.'
    }
  },
  {
    target: 'map',
    title: { en: '3/6 · Central Geospatial Canvas', es: '3/6 · Mapa geoespacial central', nl: '3/6 · Centrale georuimtelijke kaart' },
    body: {
      en: 'Pan, zoom, and select any incident, relay node, or message route. All maps run offline from Natural Earth vector geometry with zero external tracker calls.',
      es: 'Desplaza, haz zoom y pulsa cualquier incidente, nodo relé o ruta. El mapa funciona sin conexión sobre geometría Natural Earth sin rastreadores externos.',
      nl: 'Pan, zoom en selecteer elk incident, relayknooppunt of route. Werkt offline op Natural Earth-vectorgeometrie.'
    }
  },
  {
    target: 'graph',
    title: { en: '4/6 · Correlation Graph', es: '4/6 · Grafo de correlación', nl: '4/6 · Correlatiegraaf' },
    body: {
      en: 'Switch to the Correlation view to inspect how Event <-> Sensor <-> Route <-> Team <-> Decision link together, with a plain-language explanation and EvidenceBadge.',
      es: 'Alterna a la vista de Correlación para ver cómo se enlazan Evento <-> Sensor <-> Ruta <-> Equipo <-> Decisión, con una frase explicativa y su etiqueta de evidencia.',
      nl: 'Bekijk in de correlatiegraaf hoe Gebeurtenis <-> Sensor <-> Route <-> Team <-> Beslissing samenhangen, met uitleg en bewijslabel.'
    }
  },
  {
    target: 'inspector',
    title: { en: '5/6 · Object Inspector & Two-Step Controls', es: '5/6 · Ficha de objeto y control en 2 pasos', nl: '5/6 · Objectinspector & 2-stapsacties' },
    body: {
      en: 'Inspect provenance, relationships, and test simulated controls (Declare Zone, Activate Relay, Assign Team). Every action requires two-step confirmation and writes to the Audit Log.',
      es: 'Consulta la procedencia, relaciones y prueba los controles simulados (declarar zona, activar relé, asignar equipo) con confirmación en dos pasos y registro de auditoría.',
      nl: 'Inspecteer herkomst en test gesimuleerde acties (zone verklaren, relay activeren, team toewijzen) met tweestapsbevestiging en auditlog.'
    }
  },
  {
    target: 'timeline',
    title: { en: '6/6 · Timeline Scrubber & Baseline Comparison', es: '6/6 · Línea de tiempo y comparativa', nl: '6/6 · Tijdlijn & baselinevergelijking' },
    body: {
      en: 'Scrub or press Space to replay the scenario from T+00m to T+90m and compare SENDA multipath arrival against the conventional cellular-only baseline.',
      es: 'Desliza la línea de tiempo o pulsa Espacio para reproducir de T+00m a T+90m y comparar la llegada de SENDA frente a la red móvil convencional.',
      nl: 'Spoel of druk op Spatie om van T+00m tot T+90m af te spelen en SENDA te vergelijken met de mobiele baseline.'
    }
  }
];
