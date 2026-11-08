'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Locale } from './copy';
import {
  ACTIVATIONS,
  ASSETS,
  CALIBRATION_SOURCES,
  CHANNELS,
  CHANNEL_ORDER,
  DEFAULT_ENVIRONMENT,
  ENVIRONMENTS,
  MODEL_VERSION,
  SCENARIOS,
  TRACKS,
  WALL_MATERIALS,
  activeAssets,
  airtimeSecondsFor,
  analyze,
  assetStatus,
  channelActive,
  collectAll,
  computeLinkBudget,
  computeRoutePlan,
  coverageField,
  deliveryProbability,
  distanceM,
  mapDistance,
  nominalMargin,
  statusFor,
  toGeo,
  trackAt,
  trilaterate2D,
  type ActivationSpec,
  type ActivationStatus,
  type ChannelId,
  type EnvironmentId,
  type ScenarioId,
  type Severity,
  type WallMaterialId
} from '../lib/command-surface';
import './command-surface.css';

const es = {
  tag: 'SUPERFICIE D · SENDA MANDO',
  title: 'PANEL DE MANDO MULTICANAL',
  lead:
    'Activaciones, taxonomía, seguimiento de superficie y análisis de enlaces en una sola consola. Escenario sintético y determinista: sin radios, cámaras ni servicios de emergencia conectados.',
  exercise: 'EJERCICIO SINTÉTICO · SIN DATOS PERSONALES · SIN DISPATCH 112',
  scenarioLabel: 'ESCENARIO',
  scenarios: {
    blackout: { name: 'APAGÓN TOTAL', desc: 'Sin backhaul; solo acústico, BLE, LoRa y satélite en ventana.' },
    degraded: { name: 'RED DEGRADADA', desc: 'SMS y Wi-Fi parciales; gateway en modo degradado.' },
    recovery: { name: 'RECUPERACIÓN', desc: 'Celular y gateway restaurados; la malla drena la cola.' }
  },
  environmentNames: {
    OPEN: 'ABIERTO',
    RURAL: 'RURAL',
    SUBURBAN: 'SUBURBANO',
    URBAN: 'URBANO',
    RUBBLE: 'ESCOMBROS'
  },
  kpi: {
    total: 'ACTIVACIONES',
    open: 'ABIERTAS',
    unconfirmed: 'SIN CONFIRMAR',
    triage: 'TRIAJE MEDIANO',
    verified: 'ENTREGAS VERIFICADAS',
    coverage: 'COBERTURA DE MALLA',
    channels: 'CANALES ACTIVOS',
    routed: 'CON RUTA',
    delivery: 'P(3 INTENTOS)',
    of: 'de'
  },
  feed: {
    title: 'ACTIVACIONES',
    lead: 'Cola multicanal priorizada. La lista solo muestra eventos anteriores al reloj de la simulación.',
    channelFilter: 'CANAL',
    statusFilter: 'ESTADO',
    all: 'TODOS',
    empty: 'Sin activaciones con estos filtros.',
    activate: 'ACTIVAR PROTOCOLO',
    activated: 'Protocolo asignado a',
    queued: 'sin ruta; queda en cola store-and-forward',
    notAvailable: 'CANAL NO DISPONIBLE',
    detail: 'INSPECTOR DE ACTIVACIÓN',
    source: 'FUENTE',
    channel: 'CANAL',
    severity: 'GRAVEDAD',
    status: 'ESTADO',
    confidence: 'CONFIANZA',
    bytes: 'PAYLOAD',
    consent: 'CONSENTIMIENTO',
    yes: 'SÍ',
    no: 'NO',
    time: 'T+',
    position: 'POSICIÓN',
    collect: 'EXPORTAR TODO',
    collected: 'JSON descargado',
    brief: 'COPIAR BRIEF',
    copied: 'Brief copiado',
    audit: 'TRAZA DE ACTIVACIÓN',
    auditEmpty: 'Sin órdenes locales todavía.',
    route: 'RUTA',
    target: 'DESTINO',
    eta: 'ETA',
    probability: 'P(3 intentos)',
    noRoute: 'SIN RUTA · EN COLA',
    gatewayDown: 'GATEWAY CAÍDO',
    upTo: 'hasta T+'
  },
  map: {
    title: 'SUPERFICIE DE SEGUIMIENTO',
    lead: 'Activos, cobertura, tracks y ruta calculada. 1 unidad = 10 m.',
    layers: 'CAPAS',
    assets: 'ACTIVOS',
    coverage: 'COBERTURA',
    heat: 'CALOR',
    tracks: 'TRACKS',
    routes: 'RUTAS',
    time: 'RELOJ',
    play: 'REPRODUCIR',
    pause: 'PAUSA',
    reset: 'REINICIAR',
    legend: 'ROJO = P1 · ÁMBAR = P2 · VERDE = P3',
    selected: 'SELECCIÓN',
    fused: 'POSICIÓN FUSIONADA',
    error: 'ERROR',
    lastSeen: 'ÚLTIMO CONTACTO',
    gatewayDown: 'GATEWAY OFFLINE · OBJETIVO ST-02',
    synthetic: 'SUPERFICIE SINTÉTICA',
    scale: '500 m',
    heatLegend: 'CALOR = P(ENLACE) LOCAL',
    gdop: 'GDOP',
    ellipse: 'ELIPSE 95%'
  },
  taxonomy: {
    title: 'TAXONOMÍA Y CANALES',
    lead: 'Matriz de canal, payload máximo, tiempo de aire para 96 B y margen nominal.',
    channel: 'CANAL',
    range: 'ALCANCE',
    rate: 'CAUDAL',
    payload: 'MÁX.',
    airtime: 'AIRE 96 B',
    margin: 'MARGEN',
    active: 'ACTIVO',
    inactive: 'CAÍDO',
    nominal: 'NOMINAL',
    byKind: 'POR TIPO',
    byStatus: 'POR ESTADO',
    bySeverity: 'POR GRAVEDAD'
  },
  calc: {
    title: 'CALCULADORA DE ENLACE',
    lead: 'Presupuesto RF con pérdidas de espacio libre, paredes y capacidad de Shannon.',
    frequency: 'FRECUENCIA (MHz)',
    distance: 'DISTANCIA (m)',
    txPower: 'TX (dBm)',
    txGain: 'GANANCIA TX (dBi)',
    rxGain: 'GANANCIA RX (dBi)',
    sensitivity: 'SENSIBILIDAD (dBm)',
    bandwidth: 'ANCHO DE BANDA (Hz)',
    wall: 'MATERIAL',
    walls: 'PAREDES',
    fspl: 'FSPL',
    wallLoss: 'PÉRDIDA MUROS',
    rxPower: 'RX',
    snr: 'SNR',
    margin: 'MARGEN',
    capacity: 'CAPACIDAD',
    maxRange: 'ALCANCE MÁX.',
    viable: 'ENLACE VIABLE',
    notViable: 'ENLACE NO VIABLE',
    profile: 'PERFIL',
    environment: 'ENTORNO',
    shadowing: 'SOMBRA σ (dB)',
    pathLoss: 'PÉRDIDA MEDIA',
    p90: 'MARGEN P90',
    probability: 'P(ENLACE)',
    model: 'MODELO',
    note: 'Log-distancia + sombra log-normal + clutter; la σ calibra presupuesto, rutas y calor. La elipse es un 95% nominal.'
  },
  analysis: {
    title: 'ANÁLISIS Y TRAZA',
    lead: 'Agregados, exportación y auditoría local de la simulación.',
    collect: 'RECOLECTAR TODO',
    exported: 'JSON exportado',
    routeTitle: 'RUTA MESH',
    routeLead: 'Dijkstra sobre contactos y airtime por canal.',
    hops: 'SALTOS',
    eta: 'ETA',
    confidence: 'CONFIANZA',
    probability: 'P(3 INTENTOS)',
    noRoute: 'No hay ruta con los canales activos. La activación queda en cola.',
    queue: 'EN COLA',
    target: 'DESTINO',
    auditTitle: 'AUDITORÍA LOCAL',
    auditEmpty: 'Sin órdenes.',
    selectedRoute: 'RUTA DE LA ACTIVACIÓN SELECCIONADA',
    byKind: 'TIPOS',
    byStatus: 'ESTADOS',
    bySeverity: 'GRAVEDAD',
    success: 'P(ENLACE)',
    energy: 'ENERGÍA',
    weakest: 'SALTO DÉBIL',
    backup: 'RUTA DE RESPALDO',
    noBackup: 'Sin ruta de respaldo para este primer salto.'
  },
  channelNames: {
    ACOUSTIC: 'ACÚSTICO',
    BLE: 'BLE',
    WIFI: 'WI-FI',
    LORA: 'LORA',
    SMS: 'SMS',
    SAT: 'SATÉLITE',
    CELL: 'CELULAR',
    GATEWAY: 'GATEWAY'
  },
  statusNames: {
    NEW: 'NUEVA',
    TRIAGED: 'TRIAJE',
    ASSIGNED: 'ASIGNADA',
    IN_PROGRESS: 'EN CURSO',
    RESOLVED: 'RESUELTA',
    UNCONFIRMED: 'SIN CONFIRMAR'
  },
  severityNames: { ROJO: 'ROJO', AMARILLO: 'ÁMBAR', VERDE: 'VERDE' },
  kindNames: {
    PERSON_SOS: 'SOS PERSONA',
    CHECKIN: 'CHECK-IN',
    SENSOR_THERMAL: 'SENSOR TÉRMICO',
    SENSOR_SEISMIC: 'SENSOR SÍSMICO',
    CAMERA: 'CÁMARA',
    RADAR: 'RADAR RF',
    DRONE: 'DRON',
    INFRA_POWER: 'ENERGÍA / INFRA'
  },
  wallNames: {
    DRYWALL: 'PLADUR',
    BRICK_25CM: 'LADRILLO 25',
    CONCRETE_30CM: 'HORMIGÓN 30',
    COLLAPSED_RUBBLE: 'ESCOMBROS'
  },
  assetNames: {
    'GW-01': 'Pasarela civil El Tiemblo',
    'ST-02': 'Estación de comunicaciones ST-02',
    'RD-03': 'Radar RF multibanda',
    'CAM-04': 'Cámara vial DGT',
    'WT-05': 'Aerogenerador / nodo LoRa',
    'DR-06': 'Dron de reconocimiento',
    'CAM-07': 'Cámara pública CAM-07',
    'ST-08': 'Estación ST-08'
  },
  disclaimer:
    'Simulación determinista de investigación. No hay radios, cámaras, GPS, datos personales ni dispatch real. Las cifras de alcance y margen son presupuestos de planificación, no mediciones de campo.',
  footer: 'SENDA / OEP · SUPERFICIE DE MANDO · MODELO DETERMINISTA'
};

type Copy = typeof es;

const en: Copy = {
  tag: 'SURFACE D · SENDA COMMAND',
  title: 'MULTICHANNEL COMMAND PANEL',
  lead:
    'Activations, taxonomy, surface tracking and link analysis in one console. Deterministic synthetic scenario: no radios, cameras or emergency services connected.',
  exercise: 'SYNTHETIC EXERCISE · NO PERSONAL DATA · NO 112 DISPATCH',
  scenarioLabel: 'SCENARIO',
  scenarios: {
    blackout: { name: 'TOTAL BLACKOUT', desc: 'No backhaul; acoustic, BLE, LoRa and satellite window only.' },
    degraded: { name: 'DEGRADED NETWORK', desc: 'Partial SMS and Wi-Fi; gateway in degraded mode.' },
    recovery: { name: 'RECOVERY', desc: 'Cellular and gateway restored; the mesh drains the queue.' }
  },
  environmentNames: {
    OPEN: 'OPEN',
    RURAL: 'RURAL',
    SUBURBAN: 'SUBURBAN',
    URBAN: 'URBAN',
    RUBBLE: 'RUBBLE'
  },
  kpi: {
    total: 'ACTIVATIONS',
    open: 'OPEN',
    unconfirmed: 'UNCONFIRMED',
    triage: 'MEDIAN TRIAGE',
    verified: 'VERIFIED DELIVERIES',
    coverage: 'MESH COVERAGE',
    channels: 'ACTIVE CHANNELS',
    routed: 'ROUTED',
    delivery: 'P(3 ATTEMPTS)',
    of: 'of'
  },
  feed: {
    title: 'ACTIVATIONS',
    lead: 'Prioritised multichannel queue. The list only shows events before the simulation clock.',
    channelFilter: 'CHANNEL',
    statusFilter: 'STATUS',
    all: 'ALL',
    empty: 'No activations match these filters.',
    activate: 'ACTIVATE PROTOCOL',
    activated: 'Protocol assigned to',
    queued: 'no route; held in store-and-forward queue',
    notAvailable: 'CHANNEL UNAVAILABLE',
    detail: 'ACTIVATION INSPECTOR',
    source: 'SOURCE',
    channel: 'CHANNEL',
    severity: 'SEVERITY',
    status: 'STATUS',
    confidence: 'CONFIDENCE',
    bytes: 'PAYLOAD',
    consent: 'CONSENT',
    yes: 'YES',
    no: 'NO',
    time: 'T+',
    position: 'POSITION',
    collect: 'EXPORT ALL',
    collected: 'JSON downloaded',
    brief: 'COPY BRIEF',
    copied: 'Brief copied',
    audit: 'ACTIVATION TRACE',
    auditEmpty: 'No local orders yet.',
    route: 'ROUTE',
    target: 'TARGET',
    eta: 'ETA',
    probability: 'P(3 attempts)',
    noRoute: 'NO ROUTE · QUEUED',
    gatewayDown: 'GATEWAY DOWN',
    upTo: 'up to T+'
  },
  map: {
    title: 'TRACKING SURFACE',
    lead: 'Assets, coverage, tracks and computed route. 1 unit = 10 m.',
    layers: 'LAYERS',
    assets: 'ASSETS',
    coverage: 'COVERAGE',
    heat: 'HEAT',
    tracks: 'TRACKS',
    routes: 'ROUTES',
    time: 'CLOCK',
    play: 'PLAY',
    pause: 'PAUSE',
    reset: 'RESET',
    legend: 'RED = P1 · AMBER = P2 · GREEN = P3',
    selected: 'SELECTION',
    fused: 'FUSED POSITION',
    error: 'ERROR',
    lastSeen: 'LAST CONTACT',
    gatewayDown: 'GATEWAY OFFLINE · TARGET ST-02',
    synthetic: 'SYNTHETIC SURFACE',
    scale: '500 m',
    heatLegend: 'HEAT = LOCAL LINK P',
    gdop: 'GDOP',
    ellipse: '95% ELLIPSE'
  },
  taxonomy: {
    title: 'TAXONOMY AND CHANNELS',
    lead: 'Channel matrix, maximum payload, airtime for 96 B and nominal margin.',
    channel: 'CHANNEL',
    range: 'RANGE',
    rate: 'RATE',
    payload: 'MAX.',
    airtime: 'AIR 96 B',
    margin: 'MARGIN',
    active: 'ACTIVE',
    inactive: 'DOWN',
    nominal: 'NOMINAL',
    byKind: 'BY KIND',
    byStatus: 'BY STATUS',
    bySeverity: 'BY SEVERITY'
  },
  calc: {
    title: 'LINK BUDGET CALCULATOR',
    lead: 'RF budget with free-space loss, walls and Shannon capacity.',
    frequency: 'FREQUENCY (MHz)',
    distance: 'DISTANCE (m)',
    txPower: 'TX (dBm)',
    txGain: 'TX GAIN (dBi)',
    rxGain: 'RX GAIN (dBi)',
    sensitivity: 'SENSITIVITY (dBm)',
    bandwidth: 'BANDWIDTH (Hz)',
    wall: 'MATERIAL',
    walls: 'WALLS',
    fspl: 'FSPL',
    wallLoss: 'WALL LOSS',
    rxPower: 'RX',
    snr: 'SNR',
    margin: 'MARGIN',
    capacity: 'CAPACITY',
    maxRange: 'MAX. RANGE',
    viable: 'LINK VIABLE',
    notViable: 'LINK NOT VIABLE',
    profile: 'PROFILE',
    environment: 'ENVIRONMENT',
    shadowing: 'SHADOW σ (dB)',
    pathLoss: 'MEAN PATH LOSS',
    p90: 'P90 MARGIN',
    probability: 'LINK P',
    model: 'MODEL',
    note: 'Log-distance + log-normal shadowing + clutter; σ calibrates budget, routes and heat. The ellipse is a nominal 95% bound.'
  },
  analysis: {
    title: 'ANALYSIS AND TRACE',
    lead: 'Aggregates, export and local simulation audit.',
    collect: 'COLLECT ALL',
    exported: 'JSON exported',
    routeTitle: 'MESH ROUTE',
    routeLead: 'Dijkstra over contacts and per-channel airtime.',
    hops: 'HOPS',
    eta: 'ETA',
    confidence: 'CONFIDENCE',
    probability: 'P(3 ATTEMPTS)',
    noRoute: 'No route with the active channels. The activation stays queued.',
    queue: 'QUEUED',
    target: 'TARGET',
    auditTitle: 'LOCAL AUDIT',
    auditEmpty: 'No orders.',
    selectedRoute: 'SELECTED ACTIVATION ROUTE',
    byKind: 'KINDS',
    byStatus: 'STATUSES',
    bySeverity: 'SEVERITY',
    success: 'LINK P',
    energy: 'ENERGY',
    weakest: 'WEAKEST HOP',
    backup: 'BACKUP ROUTE',
    noBackup: 'No backup route for this first hop.'
  },
  channelNames: {
    ACOUSTIC: 'ACOUSTIC',
    BLE: 'BLE',
    WIFI: 'WI-FI',
    LORA: 'LORA',
    SMS: 'SMS',
    SAT: 'SATELLITE',
    CELL: 'CELLULAR',
    GATEWAY: 'GATEWAY'
  },
  statusNames: {
    NEW: 'NEW',
    TRIAGED: 'TRIAGED',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN PROGRESS',
    RESOLVED: 'RESOLVED',
    UNCONFIRMED: 'UNCONFIRMED'
  },
  severityNames: { ROJO: 'RED', AMARILLO: 'AMBER', VERDE: 'GREEN' },
  kindNames: {
    PERSON_SOS: 'PERSON SOS',
    CHECKIN: 'CHECK-IN',
    SENSOR_THERMAL: 'THERMAL SENSOR',
    SENSOR_SEISMIC: 'SEISMIC SENSOR',
    CAMERA: 'CAMERA',
    RADAR: 'RF RADAR',
    DRONE: 'DRONE',
    INFRA_POWER: 'POWER / INFRA'
  },
  wallNames: {
    DRYWALL: 'DRYWALL',
    BRICK_25CM: 'BRICK 25',
    CONCRETE_30CM: 'CONCRETE 30',
    COLLAPSED_RUBBLE: 'RUBBLE'
  },
  assetNames: {
    'GW-01': 'El Tiemblo civil gateway',
    'ST-02': 'Communications station ST-02',
    'RD-03': 'Multiband RF radar',
    'CAM-04': 'DGT road camera',
    'WT-05': 'Wind turbine / LoRa node',
    'DR-06': 'Reconnaissance drone',
    'CAM-07': 'Public camera CAM-07',
    'ST-08': 'Station ST-08'
  },
  disclaimer:
    'Deterministic research simulation. No radios, cameras, GPS, personal data or real dispatch. Range and margin figures are planning budgets, not field measurements.',
  footer: 'SENDA / OEP · COMMAND SURFACE · DETERMINISTIC MODEL'
};

const nl: Copy = {
  tag: 'OPPERVLAK D · SENDA COMMANDO',
  title: 'MULTIKANAAL COMMANDOPANEEL',
  lead:
    'Activaties, taxonomie, oppervlaktetracking en linkanalyse in één console. Deterministisch synthetisch scenario: geen radio’s, camera’s of hulpdiensten verbonden.',
  exercise: 'SYNTHETISCHE OEFENING · GEEN PERSOONSGEGEVENS · GEEN 112-DISPATCH',
  scenarioLabel: 'SCENARIO',
  scenarios: {
    blackout: { name: 'TOTALE BLACK-OUT', desc: 'Geen backhaul; alleen akoestisch, BLE, LoRa en satellietvenster.' },
    degraded: { name: 'BEPERKT NETWERK', desc: 'Deels SMS en Wi-Fi; gateway in beperkte modus.' },
    recovery: { name: 'HERSTEL', desc: 'Mobiel en gateway hersteld; de mesh werkt de wachtrij af.' }
  },
  environmentNames: {
    OPEN: 'OPEN',
    RURAL: 'LANDELIJK',
    SUBURBAN: 'VOORSTEDELIJK',
    URBAN: 'STEDELIJK',
    RUBBLE: 'PUIN'
  },
  kpi: {
    total: 'ACTIVATIES',
    open: 'OPEN',
    unconfirmed: 'ONBEVESTIGD',
    triage: 'MEDIAAN TRIAGE',
    verified: 'GEVERIFIEERDE LEVERINGEN',
    coverage: 'MESH-DEKKING',
    channels: 'ACTIEVE KANALEN',
    routed: 'MET ROUTE',
    delivery: 'P(3 POGINGEN)',
    of: 'van'
  },
  feed: {
    title: 'ACTIVATIES',
    lead: 'Geprioriteerde multikanaalwachtrij. De lijst toont alleen gebeurtenissen vóór de simulatietijd.',
    channelFilter: 'KANAAL',
    statusFilter: 'STATUS',
    all: 'ALLE',
    empty: 'Geen activaties met deze filters.',
    activate: 'PROTOCOL ACTIVEREN',
    activated: 'Protocol toegewezen aan',
    queued: 'geen route; blijft in store-and-forward-wachtrij',
    notAvailable: 'KANAAL NIET BESCHIKBAAR',
    detail: 'ACTIVATIE-INSPECTEUR',
    source: 'BRON',
    channel: 'KANAAL',
    severity: 'ERNST',
    status: 'STATUS',
    confidence: 'VERTROUWEN',
    bytes: 'PAYLOAD',
    consent: 'TOESTEMMING',
    yes: 'JA',
    no: 'NEE',
    time: 'T+',
    position: 'POSITIE',
    collect: 'ALLES EXPORTEREN',
    collected: 'JSON gedownload',
    brief: 'BRIEF KOPIËREN',
    copied: 'Brief gekopieerd',
    audit: 'ACTIVATIESPOOR',
    auditEmpty: 'Nog geen lokale opdrachten.',
    route: 'ROUTE',
    target: 'DOEL',
    eta: 'ETA',
    probability: 'P(3 pogingen)',
    noRoute: 'GEEN ROUTE · IN WACHTRIJ',
    gatewayDown: 'GATEWAY OFFLINE',
    upTo: 'tot T+'
  },
  map: {
    title: 'TRACKINGOPPERVLAK',
    lead: 'Activa, dekking, tracks en berekende route. 1 eenheid = 10 m.',
    layers: 'LAGEN',
    assets: 'ACTIVA',
    coverage: 'DEKKING',
    heat: 'WARMTE',
    tracks: 'TRACKS',
    routes: 'ROUTES',
    time: 'KLOK',
    play: 'AFSPELEN',
    pause: 'PAUZE',
    reset: 'RESET',
    legend: 'ROOD = P1 · AMBER = P2 · GROEN = P3',
    selected: 'SELECTIE',
    fused: 'GEFUSEERDE POSITIE',
    error: 'FOUT',
    lastSeen: 'LAATSTE CONTACT',
    gatewayDown: 'GATEWAY OFFLINE · DOEL ST-02',
    synthetic: 'SYNTHETISCH OPPERVLAK',
    scale: '500 m',
    heatLegend: 'WARMTE = LOKALE LINK-P',
    gdop: 'GDOP',
    ellipse: '95%-ELLIPS'
  },
  taxonomy: {
    title: 'TAXONOMIE EN KANALEN',
    lead: 'Kanaalmatrix, maximale payload, zendtijd voor 96 B en nominale marge.',
    channel: 'KANAAL',
    range: 'BEREIK',
    rate: 'SNELHEID',
    payload: 'MAX.',
    airtime: 'LUCHT 96 B',
    margin: 'MARGE',
    active: 'ACTIEF',
    inactive: 'UIT',
    nominal: 'NORMAAL',
    byKind: 'PER TYPE',
    byStatus: 'PER STATUS',
    bySeverity: 'PER ERNST'
  },
  calc: {
    title: 'LINKBUDGET-CALCULATOR',
    lead: 'RF-budget met vrije-ruimteverlies, muren en Shannon-capaciteit.',
    frequency: 'FREQUENTIE (MHz)',
    distance: 'AFSTAND (m)',
    txPower: 'TX (dBm)',
    txGain: 'TX-VERSTERKING (dBi)',
    rxGain: 'RX-VERSTERKING (dBi)',
    sensitivity: 'GEVOELIGHEID (dBm)',
    bandwidth: 'BANDBREEDTE (Hz)',
    wall: 'MATERIAAL',
    walls: 'MUREN',
    fspl: 'FSPL',
    wallLoss: 'MUURVERLIES',
    rxPower: 'RX',
    snr: 'SNR',
    margin: 'MARGE',
    capacity: 'CAPACITEIT',
    maxRange: 'MAX. BEREIK',
    viable: 'LINK HAALBAAR',
    notViable: 'LINK NIET HAALBAAR',
    profile: 'PROFIEL',
    environment: 'OMGEVING',
    shadowing: 'SCHADUW σ (dB)',
    pathLoss: 'GEMIDDELD VERLIES',
    p90: 'P90-MARGE',
    probability: 'LINK-P',
    model: 'MODEL',
    note: 'Log-afstand + lognormale schaduw + clutter; σ kalibreert budget, routes en warmtekaart. De ellips is een nominale 95%-grens.'
  },
  analysis: {
    title: 'ANALYSE EN SPOOR',
    lead: 'Aggregaten, export en lokale simulatie-audit.',
    collect: 'ALLES VERZAMELEN',
    exported: 'JSON geëxporteerd',
    routeTitle: 'MESH-ROUTE',
    routeLead: 'Dijkstra over contacten en zendtijd per kanaal.',
    hops: 'HOPS',
    eta: 'ETA',
    confidence: 'VERTROUWEN',
    probability: 'P(3 POGINGEN)',
    noRoute: 'Geen route met de actieve kanalen. De activatie blijft in de wachtrij.',
    queue: 'IN WACHTRIJ',
    target: 'DOEL',
    auditTitle: 'LOKALE AUDIT',
    auditEmpty: 'Geen opdrachten.',
    selectedRoute: 'ROUTE VAN GESELECTEERDE ACTIVATIE',
    byKind: 'TYPES',
    byStatus: 'STATUSSEN',
    bySeverity: 'ERNST',
    success: 'LINK-P',
    energy: 'ENERGIE',
    weakest: 'ZWAKSTE HOP',
    backup: 'RESERVEROUTE',
    noBackup: 'Geen reserveroute voor deze eerste hop.'
  },
  channelNames: {
    ACOUSTIC: 'AKOESTISCH',
    BLE: 'BLE',
    WIFI: 'WI-FI',
    LORA: 'LORA',
    SMS: 'SMS',
    SAT: 'SATELLIET',
    CELL: 'MOBIEL',
    GATEWAY: 'GATEWAY'
  },
  statusNames: {
    NEW: 'NIEUW',
    TRIAGED: 'GETRIAGEERD',
    ASSIGNED: 'TOEGEWEZEN',
    IN_PROGRESS: 'BEZIG',
    RESOLVED: 'OPGELOST',
    UNCONFIRMED: 'ONBEVESTIGD'
  },
  severityNames: { ROJO: 'ROOD', AMARILLO: 'AMBER', VERDE: 'GROEN' },
  kindNames: {
    PERSON_SOS: 'PERSOON SOS',
    CHECKIN: 'CHECK-IN',
    SENSOR_THERMAL: 'THERMISCHE SENSOR',
    SENSOR_SEISMIC: 'SEISMISCHE SENSOR',
    CAMERA: 'CAMERA',
    RADAR: 'RF-RADAR',
    DRONE: 'DRONE',
    INFRA_POWER: 'ENERGIE / INFRA'
  },
  wallNames: {
    DRYWALL: 'GIPSWAND',
    BRICK_25CM: 'BAKSTEEN 25',
    CONCRETE_30CM: 'BETON 30',
    COLLAPSED_RUBBLE: 'PUIN'
  },
  assetNames: {
    'GW-01': 'Civiele gateway El Tiemblo',
    'ST-02': 'Communicatiestation ST-02',
    'RD-03': 'Multiband RF-radar',
    'CAM-04': 'DGT-verkeerscamera',
    'WT-05': 'Windturbine / LoRa-knooppunt',
    'DR-06': 'Verkenningsdrone',
    'CAM-07': 'Publieke camera CAM-07',
    'ST-08': 'Station ST-08'
  },
  disclaimer:
    'Deterministische onderzoekssimulatie. Geen radio’s, camera’s, GPS, persoonsgegevens of echte dispatch. Bereik- en margecijfers zijn planningsbudgetten, geen veldmetingen.',
  footer: 'SENDA / OEP · COMMANDO-OPPERVLAK · DETERMINISTISCH MODEL'
};

const COPY: Record<Locale, Copy> = { es, en, nl };

const LOCALE_TAG: Record<Locale, string> = { es: 'es-ES', en: 'en-GB', nl: 'nl-NL' };

const STATUS_COLOR: Record<ActivationStatus, string> = {
  NEW: '#f8b797',
  TRIAGED: '#fbbf24',
  ASSIGNED: '#91d7e8',
  IN_PROGRESS: '#60a5fa',
  RESOLVED: '#34d399',
  UNCONFIRMED: '#ff5b6e'
};

const SEVERITY_COLOR: Record<Severity, string> = { ROJO: '#ff5b6e', AMARILLO: '#fbbf24', VERDE: '#34d399' };

const ASSET_STATUS_COLOR = { ONLINE: '#34d399', DEGRADED: '#fbbf24', OFFLINE: '#ff5b6e' };

const ASSET_FILL: Record<string, string> = {
  GATEWAY: '#91d7e8',
  STATION: '#60a5fa',
  RADAR: '#fbbf24',
  CAMERA: '#f472b6',
  TURBINE: '#34d399',
  DRONE: '#a78bfa'
};

function coverageColor(probability: number): string {
  if (probability >= 0.8) return '#34d399';
  if (probability >= 0.6) return '#fbbf24';
  if (probability >= 0.35) return '#fb923c';
  return '#ff5b6e';
}

const numberFormats = new Map<string, Intl.NumberFormat>();

function formatNumber(value: number, locale: Locale, digits = 0): string {
  const key = `${locale}-${digits}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_TAG[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
    numberFormats.set(key, formatter);
  }
  return formatter.format(Number.isFinite(value) ? value : 0);
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `T+${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function formatDuration(seconds: number, locale: Locale): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${formatNumber(seconds, locale, 0)} s`;
  return `${Math.floor(seconds / 60)} min ${formatNumber(seconds % 60, locale, 0)} s`;
}

function formatBytes(bytes: number, locale: Locale): string {
  if (!Number.isFinite(bytes) || bytes >= Number.MAX_SAFE_INTEGER) return '∞';
  if (bytes >= 1000000) return `${formatNumber(bytes / 1000000, locale, 1)} MB`;
  if (bytes >= 1000) return `${formatNumber(bytes / 1000, locale, 1)} kB`;
  return `${formatNumber(bytes, locale, 0)} B`;
}

function formatRate(bps: number, locale: Locale): string {
  if (!Number.isFinite(bps)) return '∞';
  if (bps >= 1000000000) return `${formatNumber(bps / 1000000000, locale, 1)} Gbps`;
  if (bps >= 1000000) return `${formatNumber(bps / 1000000, locale, 1)} Mbps`;
  if (bps >= 1000) return `${formatNumber(bps / 1000, locale, 1)} kbps`;
  return `${formatNumber(bps, locale, 0)} bps`;
}

function formatMeters(meters: number, locale: Locale): string {
  if (!Number.isFinite(meters)) return '∞';
  if (meters >= 1000) return `${formatNumber(meters / 1000, locale, meters >= 10000 ? 0 : 1)} km`;
  return `${formatNumber(meters, locale, 0)} m`;
}

function pct(value: number, total: number): number {
  return total <= 0 ? 0 : Math.max(0, Math.min(100, (value / total) * 100));
}

type LayerKey = 'assets' | 'coverage' | 'heat' | 'tracks' | 'routes';

interface AuditEntry {
  id: string;
  at: number;
  target: string;
  action: 'ASSIGNED' | 'QUEUED';
}

interface CalcState {
  channel: ChannelId;
  frequencyMhz: number;
  distanceM: number;
  txPowerDbm: number;
  txGainDbi: number;
  rxGainDbi: number;
  sensitivityDbm: number;
  bandwidthHz: number;
  walls: number;
}

const CALC_PROFILES: Array<{ channel: ChannelId; values: CalcState }> = [
  {
    channel: 'LORA',
    values: { channel: 'LORA', frequencyMhz: 868, distanceM: 3000, txPowerDbm: 14, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -137, bandwidthHz: 125000, walls: 1 }
  },
  {
    channel: 'BLE',
    values: { channel: 'BLE', frequencyMhz: 2400, distanceM: 40, txPowerDbm: 10, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -95, bandwidthHz: 2000000, walls: 1 }
  },
  {
    channel: 'WIFI',
    values: { channel: 'WIFI', frequencyMhz: 2400, distanceM: 120, txPowerDbm: 20, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -85, bandwidthHz: 20000000, walls: 1 }
  },
  {
    channel: 'SMS',
    values: { channel: 'SMS', frequencyMhz: 900, distanceM: 3000, txPowerDbm: 23, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -109, bandwidthHz: 200000, walls: 1 }
  },
  {
    channel: 'SAT',
    values: { channel: 'SAT', frequencyMhz: 1990, distanceM: 550000, txPowerDbm: 23, txGainDbi: 2, rxGainDbi: 2, sensitivityDbm: -120, bandwidthHz: 3600, walls: 0 }
  }
];

function BarGroup({
  title,
  entries,
  total,
  locale
}: {
  title: string;
  entries: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
  locale: Locale;
}) {
  return (
    <div className="cmd-bars">
      <h4>{title}</h4>
      {entries.map(entry => (
        <div className="cmd-bar-row" key={entry.key}>
          <span>{entry.label}</span>
          <div className="cmd-bar-track" aria-hidden="true">
            <i style={{ width: `${Math.max(2, pct(entry.value, total))}%`, background: entry.color }} />
          </div>
          <b>{formatNumber(entry.value, locale)}</b>
        </div>
      ))}
    </div>
  );
}

export default function CommandSurface({ locale }: { locale: Locale }) {
  const t = COPY[locale];
  const [scenario, setScenario] = useState<ScenarioId>('degraded');
  const [environment, setEnvironment] = useState<EnvironmentId>(DEFAULT_ENVIRONMENT);
  const [shadowing, setShadowing] = useState(ENVIRONMENTS[DEFAULT_ENVIRONMENT].shadowingSigmaDb);
  const [time, setTime] = useState(900);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState('ACT-2415');
  const [channelFilter, setChannelFilter] = useState<ChannelId | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ActivationStatus | 'ALL'>('ALL');
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    assets: true,
    coverage: true,
    heat: false,
    tracks: true,
    routes: true
  });
  const [activated, setActivated] = useState<Record<string, number>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [wall, setWall] = useState<WallMaterialId>('BRICK_25CM');
  const [calc, setCalc] = useState<CalcState>(CALC_PROFILES[0].values);

  useEffect(() => {
    if (!playing) return;
    const handle = window.setInterval(() => setTime(current => Math.min(900, current + 6)), 100);
    return () => window.clearInterval(handle);
  }, [playing]);

  useEffect(() => {
    if (playing && time >= 900) setPlaying(false);
  }, [playing, time]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const analysis = useMemo(() => analyze(scenario, time, environment, shadowing), [environment, scenario, shadowing, time]);
  const selected = ACTIVATIONS.find(activation => activation.id === selectedId) ?? ACTIVATIONS[0];
  const selectedStatus = activated[selected.id] ? 'ASSIGNED' : statusFor(selected.baseStatus, scenario);
  const selectedTrack = selected.trackId ? TRACKS.find(track => track.id === selected.trackId) : undefined;
  const selectedPosition = selectedTrack ? trackAt(selectedTrack, time) : { x: selected.x, y: selected.y };
  const selectedGeo = toGeo(selected.x, selected.y);
  const routePlan = useMemo(
    () => computeRoutePlan(selected, scenario, { environment, shadowingSigmaDb: shadowing }),
    [environment, scenario, selected, shadowing]
  );
  const route = routePlan.primary;
  const backup = routePlan.backup;
  const canActivate = selectedStatus === 'NEW' || selectedStatus === 'TRIAGED';
  const activatedAt = activated[selected.id];
  const budget = computeLinkBudget({
    ...calc,
    wallMaterial: wall,
    noiseFigureDb: 6,
    environment,
    shadowingSigmaDb: shadowing,
    maxRangeCapM: CHANNELS[calc.channel].rangeM
  });
  const visible = useMemo(() => ACTIVATIONS.filter(activation => activation.t <= time), [time]);
  const coverageCells = useMemo(
    () => coverageField(scenario, environment, 40, shadowing),
    [environment, scenario, shadowing]
  );
  const filtered = useMemo(
    () =>
      visible
        .filter(activation => channelFilter === 'ALL' || activation.channel === channelFilter)
        .filter(activation => {
          const status = activated[activation.id] ? 'ASSIGNED' : statusFor(activation.baseStatus, scenario);
          return statusFilter === 'ALL' || status === statusFilter;
        })
        .slice()
        .sort((a, b) => b.t - a.t),
    [activated, channelFilter, scenario, statusFilter, visible]
  );

  const fix = useMemo(() => {
    const anchors = activeAssets(scenario)
      .filter(asset => asset.kind !== 'GATEWAY')
      .map(asset => ({ asset, distance: mapDistance(asset, selectedPosition) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((entry, index) => {
        const baseSigma =
          entry.asset.kind === 'STATION'
            ? 0.65
            : entry.asset.kind === 'RADAR'
              ? 0.9
              : entry.asset.kind === 'CAMERA'
                ? 1.1
                : entry.asset.kind === 'TURBINE'
                  ? 1.2
                  : 1.5;
        const sigma = baseSigma * (assetStatus(entry.asset.id, scenario) === 'DEGRADED' ? 1.6 : 1);
        return {
          id: entry.asset.id,
          x: entry.asset.x,
          y: entry.asset.y,
          distance: Math.max(1, entry.distance + [1.4, -1.8, 0.9][index]),
          sigma
        };
      });
    return { ...trilaterate2D(anchors), anchors };
  }, [scenario, selectedPosition]);

  const fusedErrorM = distanceM(fix, selectedPosition);
  const routePoints = route.ok
    ? [
        { x: selected.x, y: selected.y },
        ...route.hops.flatMap(hop => {
          const asset = ASSETS.find(candidate => candidate.id === hop.to);
          return asset ? [{ x: asset.x, y: asset.y }] : [];
        })
      ]
    : [];
  const backupPoints = backup
    ? [
        { x: selected.x, y: selected.y },
        ...backup.hops.flatMap(hop => {
          const asset = ASSETS.find(candidate => candidate.id === hop.to);
          return asset ? [{ x: asset.x, y: asset.y }] : [];
        })
      ]
    : [];
  const routeProbability = route.ok ? deliveryProbability(3, route.successProbability) : 0;

  const kindEntries = (Object.keys(t.kindNames) as Array<keyof typeof t.kindNames>).map(kind => ({
    key: kind,
    label: t.kindNames[kind],
    value: analysis.kindCounts[kind],
    color: kind === 'PERSON_SOS' ? '#ff5b6e' : kind === 'CHECKIN' ? '#34d399' : '#91d7e8'
  }));
  const statusEntries = (Object.keys(t.statusNames) as ActivationStatus[]).map(status => ({
    key: status,
    label: t.statusNames[status],
    value: analysis.statusCounts[status],
    color: STATUS_COLOR[status]
  }));
  const severityEntries = (Object.keys(t.severityNames) as Severity[]).map(severity => ({
    key: severity,
    label: t.severityNames[severity],
    value: analysis.severityCounts[severity],
    color: SEVERITY_COLOR[severity]
  }));

  function effectiveStatus(activation: ActivationSpec): ActivationStatus {
    return activated[activation.id] ? 'ASSIGNED' : statusFor(activation.baseStatus, scenario);
  }

  function changeScenario(next: ScenarioId) {
    setScenario(next);
    setActivated({});
    setAudit([]);
  }

  function changeEnvironment(next: EnvironmentId) {
    setEnvironment(next);
    setShadowing(ENVIRONMENTS[next].shadowingSigmaDb);
  }

  function handleActivate() {
    if (!canActivate) return;
    const nextStatus: AuditEntry['action'] = route.ok ? 'ASSIGNED' : 'QUEUED';
    setActivated(current => ({ ...current, [selected.id]: time }));
    setAudit(current =>
      [
        { id: selected.id, at: time, target: route.ok ? route.targetId ?? '—' : 'STORE-FORWARD', action: nextStatus },
        ...current
      ].slice(0, 12)
    );
    setToast(`${t.feed.activated} ${selected.id} · ${route.ok ? route.targetId : t.feed.queued}`);
  }

  function exportAll() {
    const payload = collectAll(scenario, time, environment, shadowing);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `senda-mando-${scenario}-t${time}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(t.analysis.exported);
  }

  async function copyBrief() {
    const lines = [
      `SENDA MANDO · ${scenario.toUpperCase()} · ${formatTime(time)}`,
      `${selected.id} · ${t.kindNames[selected.kind]} · ${t.channelNames[selected.channel]} · ${t.severityNames[selected.severity]}`,
      `${t.feed.source}: ${selected.source} · ${t.feed.confidence}: ${formatNumber(selected.confidence * 100, locale)}%`,
      `${t.feed.position}: ${selectedGeo.lat.toFixed(5)}, ${selectedGeo.lon.toFixed(5)}`,
      route.ok
        ? `${t.feed.route}: ${route.hops.map(hop => `${hop.from}→${hop.to}/${hop.channel}`).join(' · ')} · ${t.feed.eta}: ${formatDuration(route.etaS, locale)}`
        : `${t.feed.route}: ${t.feed.noRoute}`,
      t.disclaimer
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setToast(t.feed.copied);
    } catch {
      setToast(t.feed.copied);
    }
  }

  function applyProfile(channel: ChannelId) {
    const profile = CALC_PROFILES.find(candidate => candidate.channel === channel);
    if (profile) setCalc(profile.values);
  }

  function updateCalc(key: Exclude<keyof CalcState, 'channel'>, raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setCalc(current => ({ ...current, [key]: value }));
  }

  function updateShadowing(raw: string) {
    const value = Number(raw);
    if (Number.isFinite(value)) setShadowing(value);
  }

  const marginPct = Math.max(0, Math.min(100, ((budget.marginP90Db + 20) / 60) * 100));

  return (
    <section className="cmd" id="mando" data-testid="command-surface" aria-labelledby="cmd-title">
      <div className="cmd-shell">
        <header className="cmd-head">
          <div>
            <p className="eyebrow">{t.tag}</p>
            <h2 id="cmd-title">{t.title}</h2>
            <p className="cmd-lead">{t.lead}</p>
          </div>
          <div className="cmd-head-status">
            <span className="cmd-live"><i />{t.exercise}</span>
            <strong>{formatTime(time)}</strong>
          </div>
        </header>

        <div className="cmd-scenarios" role="group" aria-label={t.scenarioLabel}>
          {(Object.keys(t.scenarios) as ScenarioId[]).map(id => (
            <button
              key={id}
              type="button"
              className={scenario === id ? 'is-active' : ''}
              aria-pressed={scenario === id}
              onClick={() => changeScenario(id)}
              data-testid={`cmd-scenario-${id}`}
            >
              <span>{t.scenarios[id].name}</span>
              <small>{t.scenarios[id].desc}</small>
            </button>
          ))}
        </div>

        <div className="cmd-calibration">
          <div className="cmd-calibration-controls">
            <label>
              {t.calc.environment}
              <select
                value={environment}
                onChange={event => changeEnvironment(event.target.value as EnvironmentId)}
                data-testid="cmd-environment"
              >
                {(Object.keys(ENVIRONMENTS) as EnvironmentId[]).map(id => (
                  <option key={id} value={id}>{t.environmentNames[id]}</option>
                ))}
              </select>
            </label>
            <label>
              {t.calc.shadowing}
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={shadowing}
                onChange={event => updateShadowing(event.target.value)}
                data-testid="cmd-shadowing"
              />
            </label>
          </div>
          <div className="cmd-calibration-model">
            <span>{t.calc.model}</span>
            <strong>{MODEL_VERSION}</strong>
            <small>{t.calc.note}</small>
          </div>
        </div>

        <div className="cmd-kpis">
          <div className="cmd-kpi" data-testid="cmd-kpi-total">
            <span>{t.kpi.total}</span>
            <strong>{formatNumber(analysis.total, locale)}</strong>
            <small>
              {t.kpi.of} {formatNumber(ACTIVATIONS.length, locale)}
            </small>
          </div>
          <div className="cmd-kpi" data-testid="cmd-kpi-open">
            <span>{t.kpi.open}</span>
            <strong>{formatNumber(analysis.open, locale)}</strong>
            <small>{t.kpi.total.toLowerCase()}</small>
          </div>
          <div className="cmd-kpi is-alert" data-testid="cmd-kpi-unconfirmed">
            <span>{t.kpi.unconfirmed}</span>
            <strong>{formatNumber(analysis.unconfirmed, locale)}</strong>
            <small>{t.statusNames.UNCONFIRMED}</small>
          </div>
          <div className="cmd-kpi" data-testid="cmd-kpi-triage">
            <span>{t.kpi.triage}</span>
            <strong>{analysis.medianTriageS === null ? '—' : formatNumber(analysis.medianTriageS, locale, 0)}</strong>
            <small>s</small>
          </div>
          <div className="cmd-kpi is-good" data-testid="cmd-kpi-verified">
            <span>{t.kpi.verified}</span>
            <strong>{formatNumber(analysis.verified, locale)}</strong>
            <small>{t.feed.upTo} {formatTime(time)}</small>
          </div>
          <div className="cmd-kpi" data-testid="cmd-kpi-coverage">
            <span>{t.kpi.coverage}</span>
            <strong>{formatNumber(analysis.coveragePct, locale, 0)}</strong>
            <small>%</small>
          </div>
          <div className="cmd-kpi" data-testid="cmd-kpi-channels">
            <span>{t.kpi.channels}</span>
            <strong>{formatNumber(analysis.activeChannelCount, locale)}</strong>
            <small>/ {formatNumber(CHANNEL_ORDER.length, locale)}</small>
          </div>
          <div className="cmd-kpi is-good" data-testid="cmd-kpi-routed">
            <span>{t.kpi.routed}</span>
            <strong>{formatNumber(analysis.routed, locale)}</strong>
            <small>/ {formatNumber(analysis.total, locale)}</small>
          </div>
          <div className="cmd-kpi" data-testid="cmd-kpi-delivery">
            <span>{t.kpi.delivery}</span>
            <strong>{formatNumber(analysis.meanDeliveryPct, locale, 0)}</strong>
            <small>%</small>
          </div>
        </div>

        <div className="cmd-grid">
          <aside className="cmd-panel cmd-feed" aria-labelledby="cmd-feed-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-feed-title">{t.feed.title}</h3>
                <p>{t.feed.lead}</p>
              </div>
              <button type="button" className="cmd-ghost" onClick={exportAll} data-testid="cmd-export">
                {t.feed.collect} ↓
              </button>
            </div>
            <div className="cmd-filters">
              <label>
                {t.feed.channelFilter}
                <select value={channelFilter} onChange={event => setChannelFilter(event.target.value as ChannelId | 'ALL')}>
                  <option value="ALL">{t.feed.all}</option>
                  {CHANNEL_ORDER.map(channel => (
                    <option key={channel} value={channel}>
                      {t.channelNames[channel]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.feed.statusFilter}
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as ActivationStatus | 'ALL')}>
                  <option value="ALL">{t.feed.all}</option>
                  {Object.keys(t.statusNames).map(status => (
                    <option key={status} value={status}>
                      {t.statusNames[status as ActivationStatus]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="cmd-feed-list" role="list">
              {filtered.length === 0 ? <p className="cmd-empty">{t.feed.empty}</p> : null}
              {filtered.map(activation => {
                const status = effectiveStatus(activation);
                return (
                  <button
                    type="button"
                    role="listitem"
                    key={activation.id}
                    className={`cmd-feed-row ${activation.id === selected.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(activation.id)}
                    aria-pressed={activation.id === selected.id}
                    data-testid={`cmd-activation-${activation.id}`}
                  >
                    <span className="cmd-feed-time">{formatTime(activation.t)}</span>
                    <span className="cmd-feed-main">
                      <i style={{ background: SEVERITY_COLOR[activation.severity] }} />
                      <span>
                        <b>{t.kindNames[activation.kind]}</b>
                        <small>
                          {t.channelNames[activation.channel]} · {activation.source}
                        </small>
                      </span>
                    </span>
                    <span className="cmd-status" style={{ color: STATUS_COLOR[status], borderColor: STATUS_COLOR[status] }}>
                      {t.statusNames[status]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="cmd-detail">
              <div className="cmd-detail-head">
                <h4>{t.feed.detail}</h4>
                <span>{selected.id}</span>
              </div>
              <dl className="cmd-dl">
                <div><dt>{t.feed.time}</dt><dd>{formatTime(selected.t)}</dd></div>
                <div><dt>{t.feed.source}</dt><dd>{selected.source}</dd></div>
                <div><dt>{t.feed.channel}</dt><dd>{t.channelNames[selected.channel]}</dd></div>
                <div><dt>{t.feed.severity}</dt><dd style={{ color: SEVERITY_COLOR[selected.severity] }}>{t.severityNames[selected.severity]}</dd></div>
                <div><dt>{t.feed.status}</dt><dd style={{ color: STATUS_COLOR[selectedStatus] }}>{t.statusNames[selectedStatus]}</dd></div>
                <div><dt>{t.feed.confidence}</dt><dd>{formatNumber(selected.confidence * 100, locale)}%</dd></div>
                <div><dt>{t.feed.bytes}</dt><dd>{formatBytes(selected.bytes, locale)}</dd></div>
                <div><dt>{t.feed.consent}</dt><dd>{selected.consent ? t.feed.yes : t.feed.no}</dd></div>
                <div><dt>{t.feed.position}</dt><dd>{selectedGeo.lat.toFixed(5)}, {selectedGeo.lon.toFixed(5)}</dd></div>
                <div><dt>{t.feed.route}</dt><dd>{route.ok ? `${t.feed.target} ${route.targetId}` : t.feed.noRoute}</dd></div>
              </dl>
              <div className="cmd-detail-actions">
                <button
                  type="button"
                  className="cmd-primary"
                  onClick={handleActivate}
                  disabled={!canActivate}
                  data-testid="cmd-activate"
                >
                  {t.feed.activate} →
                </button>
                <button type="button" className="cmd-ghost" onClick={() => void copyBrief()}>
                  {t.feed.brief}
                </button>
              </div>
              {!channelActive(selected.channel, scenario) ? <p className="cmd-warning">{t.feed.notAvailable}</p> : null}
              {activatedAt !== undefined ? (
                <p className="cmd-ok">
                  {t.feed.activated} {formatTime(activatedAt)} · {route.ok ? route.targetId : t.feed.queued}
                </p>
              ) : null}
            </div>
          </aside>

          <section className="cmd-panel cmd-map" aria-labelledby="cmd-map-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-map-title">{t.map.title}</h3>
                <p>{t.map.lead}</p>
              </div>
              <span className="cmd-map-tag">{t.map.synthetic}</span>
            </div>
            <div className="cmd-map-controls">
              <div className="cmd-layers" role="group" aria-label={t.map.layers}>
                {(Object.keys(layers) as LayerKey[]).map(layer => (
                  <button
                    key={layer}
                    type="button"
                    aria-pressed={layers[layer]}
                    className={layers[layer] ? 'is-on' : ''}
                    onClick={() => setLayers(current => ({ ...current, [layer]: !current[layer] }))}
                  >
                    <i />{t.map[layer]}
                  </button>
                ))}
              </div>
              <div className="cmd-clock">
                <button type="button" onClick={() => {
                  if (!playing && time >= 900) setTime(0);
                  setPlaying(current => !current);
                }}>
                  {playing ? t.map.pause : t.map.play}
                </button>
                <button type="button" onClick={() => { setPlaying(false); setTime(0); }}>
                  {t.map.reset}
                </button>
                <input
                  type="range"
                  min={0}
                  max={900}
                  step={5}
                  value={time}
                  onChange={event => setTime(Number(event.target.value))}
                  aria-label={t.map.time}
                  data-testid="cmd-time"
                />
                <strong>{formatTime(time)}</strong>
              </div>
            </div>
            <div className="cmd-map-stage">
              <svg viewBox="0 0 1000 640" role="img" aria-label={t.map.title} data-testid="cmd-map-svg">
                <defs>
                  <linearGradient id="cmdSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#07131c" />
                    <stop offset="1" stopColor="#040a0f" />
                  </linearGradient>
                  <pattern id="cmdGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#7fb6c8" strokeOpacity=".08" strokeWidth="1" />
                  </pattern>
                  <filter id="cmdGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <rect width="1000" height="640" fill="url(#cmdSky)" />
                <rect width="1000" height="640" fill="url(#cmdGrid)" />
                <path d="M-20 555 C 150 520, 300 590, 470 510 S 780 430, 1030 470" fill="none" stroke="#285066" strokeWidth="18" strokeOpacity=".45" />
                <path d="M-20 555 C 150 520, 300 590, 470 510 S 780 430, 1030 470" fill="none" stroke="#61b7c9" strokeWidth="1.2" strokeOpacity=".4" strokeDasharray="12 10" />
                <path d="M70 640 C 210 500, 420 470, 530 360 S 730 250, 930 260" fill="none" stroke="#36515d" strokeWidth="9" strokeOpacity=".55" />
                <path d="M70 640 C 210 500, 420 470, 530 360 S 730 250, 930 260" fill="none" stroke="#8fbfc9" strokeWidth="1" strokeOpacity=".22" />
                <path d="M30 470 L 210 430 L 360 480 L 510 415 L 700 445 L 980 350 L 1000 640 L 0 640 Z" fill="#0d2531" fillOpacity=".55" stroke="#2b5968" strokeOpacity=".4" />
                <text x="24" y="30" className="cmd-map-label">SECTOR EL TIEMBLO · 10,0 × 6,4 km</text>
                <text x="976" y="30" textAnchor="end" className="cmd-map-label">{t.map.scale}</text>
                <line x1="906" y1="24" x2="976" y2="24" stroke="#91d7e8" strokeOpacity=".55" />
                <line x1="906" y1="20" x2="906" y2="28" stroke="#91d7e8" strokeOpacity=".55" />
                <line x1="976" y1="20" x2="976" y2="28" stroke="#91d7e8" strokeOpacity=".55" />

                {layers.coverage
                  ? activeAssets(scenario).map(asset => (
                      <circle
                        key={`coverage-${asset.id}`}
                        cx={asset.x}
                        cy={asset.y}
                        r={asset.coverageM / 10}
                        fill={ASSET_FILL[asset.kind]}
                        fillOpacity=".045"
                        stroke={ASSET_FILL[asset.kind]}
                        strokeOpacity=".22"
                        strokeDasharray="4 6"
                      />
                    ))
                  : null}

                {layers.heat
                  ? coverageCells.map(cell => (
                      <rect
                        key={`heat-${cell.x}-${cell.y}`}
                        x={cell.x}
                        y={cell.y}
                        width={cell.size}
                        height={cell.size}
                        fill={coverageColor(cell.probability)}
                        fillOpacity={0.05 + cell.probability * 0.2}
                      />
                    ))
                  : null}

                {layers.tracks
                  ? TRACKS.map(track => {
                      const current = trackAt(track, time);
                      const color = track.kind === 'TEAM' ? '#91d7e8' : track.kind === 'DRONE' ? '#a78bfa' : '#ffb4a2';
                      return (
                        <g key={`track-${track.id}`}>
                          <polyline
                            points={track.points.map(point => `${point.x},${point.y}`).join(' ')}
                            fill="none"
                            stroke={color}
                            strokeOpacity=".2"
                            strokeWidth="1.5"
                          />
                          <circle cx={current.x} cy={current.y} r="4.5" fill={color} stroke="#04121a" strokeWidth="1.5" />
                          <text x={current.x + 8} y={current.y + 3} className="cmd-track-label">{track.id}</text>
                        </g>
                      );
                    })
                  : null}

                {layers.assets
                  ? ASSETS.map(asset => {
                      const status = assetStatus(asset.id, scenario);
                      const color = ASSET_STATUS_COLOR[status];
                      return (
                        <g key={asset.id} className="cmd-asset">
                          <circle cx={asset.x} cy={asset.y} r="15" fill="#07131c" stroke={color} strokeOpacity={status === 'OFFLINE' ? '.35' : '.8'} />
                          <rect x={asset.x - 4} y={asset.y - 4} width="8" height="8" fill={ASSET_FILL[asset.kind]} transform={`rotate(45 ${asset.x} ${asset.y})`} opacity={status === 'OFFLINE' ? '.35' : '1'} />
                          <text x={asset.x + 19} y={asset.y + 4} className="cmd-asset-label">{asset.id}</text>
                          <title>{`${asset.id} · ${t.assetNames[asset.id as keyof typeof t.assetNames]} · ${status}`}</title>
                        </g>
                      );
                    })
                  : null}

                {layers.routes && backup && backupPoints.length > 1 ? (
                  <polyline
                    points={backupPoints.map(point => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="1.6"
                    strokeOpacity=".6"
                    strokeDasharray="3 8"
                  />
                ) : null}

                {layers.routes && route.ok ? (
                  <g>
                    <polyline
                      points={routePoints.map(point => `${point.x},${point.y}`).join(' ')}
                      fill="none"
                      stroke="#5eead4"
                      strokeWidth="2.5"
                      strokeDasharray="9 7"
                      filter="url(#cmdGlow)"
                      className="cmd-route-line"
                    />
                    <circle
                      cx={routePoints[routePoints.length - 1]?.x ?? selected.x}
                      cy={routePoints[routePoints.length - 1]?.y ?? selected.y}
                      r="7"
                      fill="#5eead4"
                      filter="url(#cmdGlow)"
                    />
                  </g>
                ) : null}

                {layers.tracks
                  ? fix.anchors.map(anchor => (
                      <line
                        key={`fix-${anchor.id}`}
                        x1={anchor.x}
                        y1={anchor.y}
                        x2={fix.x}
                        y2={fix.y}
                        stroke="#f0abfc"
                        strokeOpacity=".32"
                        strokeDasharray="3 5"
                      />
                    ))
                  : null}
                {layers.tracks ? (
                  <g>
                    <ellipse
                      cx={fix.x}
                      cy={fix.y}
                      rx={Math.max(1, fix.ellipseMajorM / 10)}
                      ry={Math.max(0.5, fix.ellipseMinorM / 10)}
                      transform={`rotate(${fix.angleDeg} ${fix.x} ${fix.y})`}
                      fill="#f0abfc"
                      fillOpacity=".04"
                      stroke="#f0abfc"
                      strokeOpacity=".3"
                      strokeDasharray="2 4"
                    />
                    <circle cx={fix.x} cy={fix.y} r="9" fill="none" stroke="#f0abfc" strokeOpacity=".7" strokeDasharray="3 3" />
                    <circle cx={fix.x} cy={fix.y} r="2.5" fill="#f0abfc" />
                  </g>
                ) : null}

                {visible
                  .filter(activation => activation.id !== selected.id)
                  .map(activation => (
                    <circle
                      key={`dot-${activation.id}`}
                      cx={activation.x}
                      cy={activation.y}
                      r="5"
                      fill={SEVERITY_COLOR[activation.severity]}
                      fillOpacity=".82"
                      stroke="#04121a"
                      strokeWidth="1"
                      className="cmd-activation-dot"
                      onClick={() => setSelectedId(activation.id)}
                      data-testid={`cmd-dot-${activation.id}`}
                    >
                      <title>{`${activation.id} · ${t.kindNames[activation.kind]} · ${t.severityNames[activation.severity]}`}</title>
                    </circle>
                  ))}

                <g className="cmd-selected">
                  <circle cx={selected.x} cy={selected.y} r="22" fill="none" stroke={SEVERITY_COLOR[selected.severity]} strokeOpacity=".35" />
                  <circle cx={selected.x} cy={selected.y} r="12" fill="none" stroke={SEVERITY_COLOR[selected.severity]} strokeOpacity=".9" strokeWidth="2" className="cmd-pulse" />
                  <circle cx={selected.x} cy={selected.y} r="4" fill={SEVERITY_COLOR[selected.severity]} />
                  <text x={selected.x + 16} y={selected.y - 13} className="cmd-selected-label">{selected.id}</text>
                </g>
              </svg>
              <div className="cmd-map-hud">
                <span>{t.map.selected}</span>
                <strong>{selected.id} · {t.kindNames[selected.kind]}</strong>
                <small>{selectedGeo.lat.toFixed(4)}, {selectedGeo.lon.toFixed(4)}</small>
                <small>
                  {t.map.fused}: {fix.x.toFixed(0)}, {fix.y.toFixed(0)} · {t.map.error}: {formatNumber(fusedErrorM, locale)} m · {t.map.gdop}: {formatNumber(fix.gdop, locale, 2)}
                </small>
                <small>
                  {t.map.ellipse}: ± {formatNumber(fix.ellipseMajorM, locale)} m · {t.map.lastSeen}: {formatTime(time)} · {route.ok ? `${t.feed.target} ${route.targetId}` : SCENARIOS[scenario].gatewayOnline ? t.feed.noRoute : t.map.gatewayDown}
                </small>
              </div>
              <div className="cmd-map-legend">{t.map.legend} · {t.map.heatLegend}</div>
            </div>
            <div className="cmd-map-foot">
              <span>{t.map.synthetic}</span>
              <span>{t.map.lead}</span>
            </div>
          </section>

          <aside className="cmd-panel cmd-taxonomy" aria-labelledby="cmd-taxonomy-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-taxonomy-title">{t.taxonomy.title}</h3>
                <p>{t.taxonomy.lead}</p>
              </div>
            </div>
            <div className="cmd-channel-scroll">
              <div className="cmd-channel-table">
                <div className="cmd-channel-head">
                  <span>{t.taxonomy.channel}</span>
                  <span>{t.taxonomy.range}</span>
                  <span>{t.taxonomy.rate}</span>
                  <span>{t.taxonomy.payload}</span>
                  <span>{t.taxonomy.airtime}</span>
                  <span>{t.taxonomy.margin}</span>
                </div>
                {CHANNEL_ORDER.map(channel => {
                  const spec = CHANNELS[channel];
                  const active = channelActive(channel, scenario);
                  const margin = nominalMargin(channel);
                  return (
                    <button
                      key={channel}
                      type="button"
                      className={`cmd-channel-row ${channelFilter === channel ? 'is-selected' : ''} ${active ? '' : 'is-down'}`}
                      onClick={() => setChannelFilter(current => (current === channel ? 'ALL' : channel))}
                      aria-pressed={channelFilter === channel}
                    >
                      <span className="cmd-channel-name">
                        <i style={{ background: spec.color }} />
                        {t.channelNames[channel]}
                        <em>{active ? t.taxonomy.active : t.taxonomy.inactive}</em>
                      </span>
                      <span>{formatMeters(spec.rangeM, locale)}</span>
                      <span>{formatRate(spec.rateBps, locale)}</span>
                      <span>{formatBytes(spec.maxBytes, locale)}</span>
                      <span>{formatNumber(airtimeSecondsFor(channel, 96), locale, 2)} s</span>
                      <span>{margin === null ? '—' : `${formatNumber(margin, locale, 1)} dB`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="cmd-tax-bars">
              <BarGroup title={t.taxonomy.byKind} entries={kindEntries} total={analysis.total} locale={locale} />
              <BarGroup title={t.taxonomy.byStatus} entries={statusEntries} total={analysis.total} locale={locale} />
              <BarGroup title={t.taxonomy.bySeverity} entries={severityEntries} total={analysis.total} locale={locale} />
            </div>
          </aside>
        </div>

        <div className="cmd-bottom">
          <section className="cmd-panel cmd-calc" aria-labelledby="cmd-calc-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-calc-title">{t.calc.title}</h3>
                <p>{t.calc.lead}</p>
              </div>
            </div>
            <div className="cmd-profiles">
              {CALC_PROFILES.map(profile => (
                <button key={profile.channel} type="button" onClick={() => applyProfile(profile.channel)}>
                  {t.channelNames[profile.channel]}
                </button>
              ))}
            </div>
            <div className="cmd-calc-inputs">
              <label>{t.calc.frequency}<input type="number" value={calc.frequencyMhz} onChange={event => updateCalc('frequencyMhz', event.target.value)} /></label>
              <label>{t.calc.distance}<input type="number" value={calc.distanceM} onChange={event => updateCalc('distanceM', event.target.value)} /></label>
              <label>{t.calc.txPower}<input type="number" value={calc.txPowerDbm} onChange={event => updateCalc('txPowerDbm', event.target.value)} /></label>
              <label>{t.calc.txGain}<input type="number" value={calc.txGainDbi} onChange={event => updateCalc('txGainDbi', event.target.value)} /></label>
              <label>{t.calc.rxGain}<input type="number" value={calc.rxGainDbi} onChange={event => updateCalc('rxGainDbi', event.target.value)} /></label>
              <label>{t.calc.sensitivity}<input type="number" value={calc.sensitivityDbm} onChange={event => updateCalc('sensitivityDbm', event.target.value)} /></label>
              <label>{t.calc.bandwidth}<input type="number" value={calc.bandwidthHz} onChange={event => updateCalc('bandwidthHz', event.target.value)} /></label>
              <label>{t.calc.walls}<input type="number" min={0} max={8} value={calc.walls} onChange={event => updateCalc('walls', event.target.value)} /></label>
              <label>
                {t.calc.wall}
                <select value={wall} onChange={event => setWall(event.target.value as WallMaterialId)}>
                  {(Object.keys(WALL_MATERIALS) as WallMaterialId[]).map(material => (
                    <option key={material} value={material}>{t.wallNames[material]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="cmd-calc-results">
              <div><span>{t.calc.fspl}</span><strong>{formatNumber(budget.fsplDb, locale, 1)} dB</strong></div>
              <div><span>{t.calc.pathLoss}</span><strong>{formatNumber(budget.pathLossDb, locale, 1)} dB</strong></div>
              <div><span>{t.calc.wallLoss}</span><strong>{formatNumber(budget.wallLossDb, locale, 1)} dB</strong></div>
              <div><span>{t.calc.rxPower}</span><strong>{formatNumber(budget.receivedDbm, locale, 1)} dBm</strong></div>
              <div><span>{t.calc.snr}</span><strong>{formatNumber(budget.snrDb, locale, 1)} dB</strong></div>
              <div><span>{t.calc.p90}</span><strong>{formatNumber(budget.marginP90Db, locale, 1)} dB</strong></div>
              <div><span>{t.calc.probability}</span><strong>{formatNumber(budget.linkProbability * 100, locale, 0)} %</strong></div>
              <div><span>{t.calc.capacity}</span><strong>{formatRate(budget.capacityBps, locale)}</strong></div>
              <div><span>{t.calc.maxRange}</span><strong>{formatMeters(budget.maxRangeM, locale)}</strong></div>
            </div>
            <div className={`cmd-margin ${budget.viable90 ? 'is-good' : 'is-bad'}`} data-testid="cmd-calc-margin">
              <div>
                <span>{t.calc.p90}</span>
                <strong>{formatNumber(budget.marginP90Db, locale, 1)} dB</strong>
              </div>
              <div className="cmd-margin-track"><i style={{ width: `${marginPct}%` }} /></div>
              <small>{budget.viable90 ? t.calc.viable : t.calc.notViable} · {t.calc.model} {MODEL_VERSION}</small>
            </div>
          </section>

          <section className="cmd-panel cmd-analysis" aria-labelledby="cmd-analysis-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-analysis-title">{t.analysis.title}</h3>
                <p>{t.analysis.lead}</p>
              </div>
              <button type="button" className="cmd-ghost" onClick={exportAll}>
                {t.analysis.collect} ↓
              </button>
            </div>
            <div className="cmd-analysis-bars">
              <BarGroup title={t.analysis.byKind} entries={kindEntries} total={analysis.total} locale={locale} />
              <BarGroup title={t.analysis.byStatus} entries={statusEntries} total={analysis.total} locale={locale} />
              <BarGroup title={t.analysis.bySeverity} entries={severityEntries} total={analysis.total} locale={locale} />
            </div>
            <div className="cmd-audit">
              <h4>{t.analysis.auditTitle}</h4>
              {audit.length === 0 ? <p>{t.analysis.auditEmpty}</p> : null}
              <ol>
                {audit.map(entry => (
                  <li key={`${entry.id}-${entry.at}`}>
                    <span>{formatTime(entry.at)}</span>
                    <b>{entry.id}</b>
                    <span>{entry.action === 'ASSIGNED' ? t.statusNames.ASSIGNED : t.analysis.queue}</span>
                    <span>{entry.target}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="cmd-panel cmd-route" aria-labelledby="cmd-route-title">
            <div className="cmd-panel-head">
              <div>
                <h3 id="cmd-route-title">{t.analysis.routeTitle}</h3>
                <p>{t.analysis.routeLead}</p>
              </div>
            </div>
            <div className="cmd-route-target">
              <span>{t.analysis.selectedRoute}</span>
              <strong>{selected.id}</strong>
            </div>
            {route.ok ? (
              <>
                <div className="cmd-route-stats">
                  <div><span>{t.analysis.target}</span><strong>{route.targetId}</strong></div>
                  <div><span>{t.analysis.eta}</span><strong>{formatDuration(route.etaS, locale)}</strong></div>
                  <div><span>{t.analysis.success}</span><strong>{formatNumber(route.successProbability * 100, locale)}%</strong></div>
                  <div><span>{t.analysis.probability}</span><strong>{formatNumber(routeProbability * 100, locale)}%</strong></div>
                  <div><span>{t.analysis.energy}</span><strong>{formatNumber(route.energy, locale)} u</strong></div>
                </div>
                <ol className="cmd-hops">
                  {route.hops.map((hop, index) => (
                    <li key={`${hop.from}-${hop.to}-${index}`}>
                      <span>{index + 1}</span>
                      <b>{hop.from} → {hop.to}</b>
                      <em>{t.channelNames[hop.channel]}</em>
                      <small>
                        {formatMeters(hop.distanceM, locale)} · {formatDuration(hop.latencyS, locale)} · {formatNumber(hop.probability * 100, locale)}%
                        {hop.pathLossDb > 0 ? ` · ${formatNumber(hop.pathLossDb, locale)} dB` : ''}
                      </small>
                    </li>
                  ))}
                </ol>
                <div className="cmd-route-backup">
                  <span>{t.analysis.backup}</span>
                  {backup ? (
                    <>
                      <strong>{backup.hops.map(hop => `${hop.from}→${hop.to}`).join(' · ')}</strong>
                      <small>{formatNumber(backup.successProbability * 100, locale)}% · {formatNumber(backup.energy, locale)} u</small>
                    </>
                  ) : (
                    <small>{t.analysis.noBackup}</small>
                  )}
                </div>
              </>
            ) : (
              <div className="cmd-route-empty">
                <strong>{t.feed.noRoute}</strong>
                <p>{t.analysis.noRoute}</p>
              </div>
            )}
            <div className="cmd-route-channels">
              {SCENARIOS[scenario].activeChannels.map(channel => (
                <span key={channel} style={{ color: CHANNELS[channel].color, borderColor: CHANNELS[channel].color }}>
                  {t.channelNames[channel]}
                </span>
              ))}
              {!SCENARIOS[scenario].gatewayOnline ? <span className="is-down">{t.feed.gatewayDown}</span> : null}
            </div>
          </section>
        </div>

        <footer className="cmd-foot">
          <p>{t.disclaimer}</p>
          <span>{t.footer}</span>
        </footer>
      </div>
      {toast ? <div className="cmd-toast" role="status">{toast}</div> : null}
    </section>
  );
}
