'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  Play,
  Radio,
  RotateCcw,
  Satellite,
  ShieldCheck,
  TrainFront,
  Waves,
  Zap
} from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import type { Locale, LocalizedText } from '../data/types';

type CrisisSimId = 'blackout' | 'dana' | 'rail' | 'seismic' | 'wildfire' | 'road-nl';

interface CrisisSimScenario {
  id: CrisisSimId;
  short: LocalizedText;
  title: LocalizedText;
  origin: LocalizedText;
  problem: LocalizedText;
  sendaRoute: LocalizedText;
  breakthrough: LocalizedText;
  sendaMinutes: number;
  legacyMinutes: number;
  shardsRecovered: string;
  energySaved: string;
  hops: Array<{ label: LocalizedText; bearer: string; ms: number }>;
  moduleHref: string;
  moduleLabel: LocalizedText;
  evidenceId: string;
}

const SCENARIOS: CrisisSimScenario[] = [
  {
    id: 'blackout',
    short: { es: 'Apagón Ibérico', en: 'Iberian Blackout', nl: 'Stroomuitval' },
    title: {
      es: 'Apagón ibérico 28-04-2025 · Caída de torres móviles',
      en: 'April 2025 Iberian Blackout · Regional tower battery collapse',
      nl: 'Iberische stroomuitval 2025 · Zendmastuitval'
    },
    origin: { es: 'Familia sin red móvil en barrio urbano', en: 'Offline family in urban outage', nl: 'Gezin zonder mobiel bereik' },
    problem: {
      es: 'La conectividad estable cae del 90 % al 40 % al vaciarse los SAI de las antenas. Los mensajes tradicionales quedan pendientes durante 8 horas.',
      en: 'Stable cellular coverage drops from 90% to 40% as tower backup batteries drain. Traditional messages stall for up to 8 hours.',
      nl: 'Mobiel bereik daalt van 90% naar 40%. Gewone berichten blijven tot 8 uur hangen.'
    },
    sendaRoute: {
      es: 'SENDA sella el mensaje en modo avión → salta por 2 móviles cercanos vía BLE / Wi-Fi Direct → alcanza un terminal con satélite/fibra viva → devuelve ACK firmado en 4 min.',
      en: 'SENDA seals the SOS in airplane mode → hops across 2 nearby phones via BLE / Wi-Fi Direct → exits through a live satellite/fiber peer → returns signed ACK in 4 min.',
      nl: 'SENDA verzegelt het SOS in vliegtuigmodus → springt via BLE/Wi-Fi Direct naar een verbonden toestel → ondertekende ACK in 4 min.'
    },
    breakthrough: {
      es: 'Contact Graph Routing (ARR_REPLAN_V2) logra 94,2 % de entrega ahorrando un 84 % de batería frente a redes mesh epidémicas.',
      en: 'Contact Graph Routing (ARR_REPLAN_V2) delivers 94.2% reliability while using 84% less battery than epidemic mesh flooding.',
      nl: 'Contact Graph Routing (ARR_REPLAN_V2) haalt 94,2% bezorging met 84% minder energieverbruik.'
    },
    sendaMinutes: 4,
    legacyMinutes: 480,
    shardsRecovered: '3 / 5 RS OK',
    energySaved: '-84 % mJ',
    hops: [
      { label: { es: 'Sobre E2EE en Modo Avión', en: 'E2EE Envelope Offline', nl: 'E2EE Offline Envelop' }, bearer: 'PWA + ECDSA', ms: 250 },
      { label: { es: 'Salto BLE / Wi-Fi Direct', en: 'BLE / Wi-Fi Direct Hop', nl: 'BLE / Wi-Fi Direct' }, bearer: 'ARR_REPLAN_V2', ms: 650 },
      { label: { es: 'Puente Vecino Satélite/Red', en: 'Neighbor Sat/Link Bridge', nl: 'Satelliet/Netwerk Brug' }, bearer: '24 B NTN', ms: 1050 },
      { label: { es: 'ACK Firmado + Purga Ciega', en: 'Signed ACK + Blind Purge', nl: 'ACK + Relais wissen' }, bearer: '4 MIN TOTAL', ms: 1450 }
    ],
    moduleHref: '/senda/',
    moduleLabel: { es: 'Abrir SENDA Campo (Modo Avión)', en: 'Open SENDA Field PWA', nl: 'Open SENDA Veld PWA' },
    evidenceId: 'EV-S01-ROUTE'
  },
  {
    id: 'dana',
    short: { es: 'DANA Valencia', en: 'Valencia DANA', nl: 'Valencia DANA' },
    title: {
      es: 'Riadas DANA Valencia (EMSR773) · Aislamiento comarcal',
      en: 'Valencia DANA Flash Floods (EMSR773) · District isolation',
      nl: 'Valencia DANA Overstromingen (EMSR773)'
    },
    origin: { es: 'Vivienda y vehículos atrapados sin cobertura', en: 'Stranded residents & vehicles', nl: 'Ingesloten bewoners & voertuigen' },
    problem: {
      es: 'El agua corta puentes, carreteras y torres móviles a la vez; las alertas oficiales llegan tarde a quienes pierden la celda local.',
      en: 'Floodwater severs bridges, roads, and cell sites simultaneously, leaving isolated zones unreachable.',
      nl: 'Hoogwater snijdt wegen en zendmasten tegelijk af, waardoor buurten geïsoleerd raken.'
    },
    sendaRoute: {
      es: 'Combina avisos locales por malla + mapa Copernicus EMSR773 offline + mulas oportunistas de transporte y vehículos de rescate hasta entregar coordenadas y estado.',
      en: 'Combines local mesh beacons + offline Copernicus EMSR773 flood layers + opportunistic bus/rescue mules to evacuate coordinates.',
      nl: 'Combineert lokale mesh-bakens + offline Copernicus EMSR773-kaartlagen + transport-mules.'
    },
    breakthrough: {
      es: 'Correlación directa con cartografía real EMSR773 y cálculo de zonas aisladas sin depender de Internet.',
      en: 'Direct correlation against real Copernicus EMSR773 flood footprints plus offline isolation modeling.',
      nl: 'Directe correlatie met echte Copernicus EMSR773-overstromingsdata zonder internet.'
    },
    sendaMinutes: 6,
    legacyMinutes: 360,
    shardsRecovered: '4 / 5 RS OK',
    energySaved: '-81 % mJ',
    hops: [
      { label: { es: 'SOS Georreferenciado Offline', en: 'Offline Geo-SOS', nl: 'Offline Geo-SOS' }, bearer: 'GPS + BARO', ms: 250 },
      { label: { es: 'Relevo Vecinal / Bus Mula', en: 'Neighborhood / Mule Relay', nl: 'Buurt- / Bus-relay' }, bearer: 'BLE + LORA', ms: 650 },
      { label: { es: 'Cruce Copernicus EMSR773', en: 'Copernicus EMSR773 Fusion', nl: 'EMSR773 Fusie' }, bearer: 'OSINT 16.699', ms: 1050 },
      { label: { es: 'Aviso Priorizado + ACK', en: 'Prioritized Alert + ACK', nl: 'Geprioriteerde ACK' }, bearer: '6 MIN TOTAL', ms: 1450 }
    ],
    moduleHref: '/senda/aislamiento.html',
    moduleLabel: { es: 'Abrir Simulador DANA Valencia', en: 'Open Valencia DANA Simulator', nl: 'Open Valencia DANA Simulator' },
    evidenceId: 'EV-CONSOLE-16K'
  },
  {
    id: 'rail',
    short: { es: 'Trenes España', en: 'Spain Rail Safety', nl: 'Spoorveiligheid' },
    title: {
      es: 'Seguridad Ferroviaria España · Lecciones de Angrois, Adamuz y Gelida',
      en: 'Spain Rail Safety · Physics braking twin (Angrois / Adamuz / Gelida)',
      nl: 'Spoorveiligheid Spanje · Fysische remtweeling'
    },
    origin: { es: 'Tren de alta velocidad / cercanías en curva o zona de riesgo', en: 'Train approaching hazard curve/zone', nl: 'Trein bij risicokromming' },
    problem: {
      es: 'Si falla una señalización puntual o aparece un obstáculo en vía, cada segundo perdido supera la distancia física de frenado d = v² / 2a.',
      en: 'When trackside signaling degrades or an obstacle appears, every lost second exceeds physical braking distance d = v² / 2a.',
      nl: 'Bij storing of obstakel op het spoor overschrijdt elke verloren seconde de fysieke remweg d = v² / 2a.'
    },
    sendaRoute: {
      es: 'El gemelo ferroviario calcula d = v² / 2a en local, dispara aviso redundante por radio/malla a cabecera y centro y marca el margen de parada con segundos de antelación.',
      en: 'The rail twin computes d = v² / 2a locally, fires redundant radio/mesh alerts to cab and dispatch, and surfaces stopping margin seconds early.',
      nl: 'De spoortweeling berekent d = v² / 2a lokaal en verstuurt redundante mesh-/radiomeldingen.'
    },
    breakthrough: {
      es: 'Física determinista de distancia de frenado + cobertura redundante en túneles y tramos rurales sin depender de una sola red.',
      en: 'Deterministic braking physics paired with redundant tunnel/rural relay coverage.',
      nl: 'Deterministische remfysica gecombineerd met redundante tunnel- en landelijke dekking.'
    },
    sendaMinutes: 1,
    legacyMinutes: 45,
    shardsRecovered: '5 / 5 RS OK',
    energySaved: '< 180 ms',
    hops: [
      { label: { es: 'Cálculo Físico d = v²/2a', en: 'Physics d = v²/2a Calc', nl: 'Fysica d = v²/2a' }, bearer: 'RAIL TWIN', ms: 250 },
      { label: { es: 'Detección Anomalía / Obstáculo', en: 'Hazard / Overspeed Trigger', nl: 'Risicodetectie' }, bearer: 'SENSOR FUSION', ms: 650 },
      { label: { es: 'Alerta Redundante Cabina + Vía', en: 'Redundant Cab + Wayside Alert', nl: 'Cabine-alert' }, bearer: 'LORA + MESH', ms: 1050 },
      { label: { es: 'Confirmación Frenado Seguro', en: 'Safe Braking Margin Confirmed', nl: 'Veilige remmarge' }, bearer: 'MARGEN OK', ms: 1450 }
    ],
    moduleHref: '/senda/via.html',
    moduleLabel: { es: 'Abrir Gemelo Ferroviario en Vivo', en: 'Open Live Rail Twin', nl: 'Open Live Spoortweeling' },
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'seismic',
    short: { es: 'Seísmo Venezuela', en: 'Seismic P-Wave', nl: 'Aardbeving P-golf' },
    title: {
      es: 'Prevención Sísmica Venezuela / España · Onda P y Edificio 3D',
      en: 'Seismic Early Warning · P-Wave detection & 3D Rubble Twin',
      nl: 'Aardbevingsdetectie · P-golf & 3D-gebouw'
    },
    origin: { es: 'Acelerómetros locales + edificio afectado tras sacudida', en: 'Phone accelerometers + collapsed floor', nl: 'Versnellingsmeters + gebouw' },
    problem: {
      es: 'Tras un seísmo grave colapsan las antenas y las personas atrapadas bajo escombros no pueden llamar ni orientar a los rescatistas.',
      en: 'Major earthquakes knock out cell infrastructure while trapped survivors beneath rubble cannot place calls or guide rescuers.',
      nl: 'Zware aardbevingen schakelen zendmasten uit terwijl ingesloten personen geen hulp kunnen bereiken.'
    },
    sendaRoute: {
      es: 'Detecta la onda P primaria (10–35 s antes de la onda S destructiva), activa el gemelo de edificio 3D y combina baliza acústica MFSK-16 + radar Wi-Fi CSI OFDM de 64 subportadoras.',
      en: 'Detects the primary P-wave (10–35 s ahead of destructive S-wave), launches the 3D building twin, and pairs MFSK-16 acoustic beacons with 64-subcarrier Wi-Fi CSI tomography.',
      nl: 'Detecteert de P-golf (10–35 s vóór S-golf), opent de 3D-gebouwtweeling en combineert MFSK-16 geluid met Wi-Fi CSI.'
    },
    breakthrough: {
      es: 'Conecta detección sísmica en el propio móvil, gemelo estructural 3D y modelo analítico ITU-R P.2040 de atenuación a través de muros.',
      en: 'Bridges handset seismic detection, 3D building rescue twin, and ITU-R P.2040 through-wall RF tomography.',
      nl: 'Koppelt mobiele seismische detectie aan 3D-redding en ITU-R P.2040 muurdemping.'
    },
    sendaMinutes: 2,
    legacyMinutes: 420,
    shardsRecovered: '3 / 5 RS OK',
    energySaved: '10–35 s P-Wave',
    hops: [
      { label: { es: 'Detección Onda P + Corroboración', en: 'P-Wave + Multi-Node Quorum', nl: 'P-golf Quorum' }, bearer: 'IMU + USGS/EMSC', ms: 250 },
      { label: { es: 'Baliza Acústica / BLE Bajo Escombros', en: 'Under-Rubble Acoustic/BLE', nl: 'Akoestisch Baken' }, bearer: 'MFSK-16 + BLE', ms: 650 },
      { label: { es: 'Tomografía Wi-Fi CSI + Edificio 3D', en: 'Wi-Fi CSI + 3D Building Twin', nl: 'Wi-Fi CSI + 3D' }, bearer: '64 OFDM', ms: 1050 },
      { label: { es: 'Posición de Planta + ACK Rescate', en: 'Floor Pin + Rescue ACK', nl: 'Verdieping + ACK' }, bearer: '2 MIN TOTAL', ms: 1450 }
    ],
    moduleHref: '/senda/edificios.html',
    moduleLabel: { es: 'Abrir Edificio 3D y Escombros', en: 'Open 3D Building & Rubble Twin', nl: 'Open 3D Gebouw & Puin' },
    evidenceId: 'EV-CORE-506'
  },
  {
    id: 'wildfire',
    short: { es: 'Incendio 3D', en: '3D Wildfire', nl: '3D Natuurbrand' },
    title: {
      es: 'Incendio Forestal 3D (El Tiemblo / Sierra) · Evacuación sin red',
      en: '3D Wildfire Spread (SENDA-3D) · Dynamic off-grid evacuation',
      nl: '3D Natuurbrand (SENDA-3D) · Offline evacuatie'
    },
    origin: { es: 'Torre N-403 quemada · frente de fuego empujado por viento', en: 'Burned N-403 cell tower · wind-driven front', nl: 'Uitgevallen zendmast · vuurfront' },
    problem: {
      es: 'El fuego destruye los repetidores de montaña y cambia de dirección en minutos; un mapa estático envía vehículos hacia carreteras ya cortadas por humo.',
      en: 'Wildfires burn mountain repeaters and shift direction in minutes; static maps route cars straight into smoke-blocked roads.',
      nl: 'Vuur schakelt bergmasten uit en draait binnen minuten van richting.'
    },
    sendaRoute: {
      es: 'Simula propagación 3D sobre relieve DEM real (100 m) + viento GFS + cámaras DGT N-403 y recalcula rutas de evacuación enviándolas por malla y satélite.',
      en: 'Simulates 3D spread over real 100 m DEM + GFS wind + DGT road cameras, recalculating safe evacuation corridors over mesh and satellite.',
      nl: 'Simuleert 3D-verspreiding over 100 m DEM + GFS-wind en berekent veilige evacuatieroutes.'
    },
    breakthrough: {
      es: 'Física de propagación 3D interactiva ejecutada directamente en el navegador junto a la red de avisos sin cobertura.',
      en: 'Interactive 3D wildfire physics running directly in the browser paired with off-grid evacuation alerts.',
      nl: 'Interactieve 3D-brandfysica direct in de browser gekoppeld aan offline evacuatie.'
    },
    sendaMinutes: 3,
    legacyMinutes: 240,
    shardsRecovered: '4 / 5 RS OK',
    energySaved: 'DEM 100 m 3D',
    hops: [
      { label: { es: 'Torre N-403 Fuera de Servicio', en: 'N-403 Tower Offline', nl: 'N-403 Mast Uit' }, bearer: 'SENDA-3D', ms: 250 },
      { label: { es: 'Cálculo Frente 3D + Viento GFS', en: '3D Front + GFS Wind Model', nl: '3D Front + Wind' }, bearer: 'DEM 100m', ms: 650 },
      { label: { es: 'Cruce Cámaras DGT + Conos FOV', en: 'DGT Camera + FOV Fusion', nl: 'DGT FOV Fusie' }, bearer: 'OSINT CCTV', ms: 1050 },
      { label: { es: 'Ruta Segura + ACK Evacuación', en: 'Safe Route + Evac ACK', nl: 'Veilige Route' }, bearer: '3 MIN TOTAL', ms: 1450 }
    ],
    moduleHref: '/senda/fuego3d.html',
    moduleLabel: { es: 'Abrir Simulador de Incendio 3D', en: 'Open 3D Wildfire Simulator', nl: 'Open 3D Brand Simulator' },
    evidenceId: 'EV-CONSOLE-16K'
  },
  {
    id: 'road-nl',
    short: { es: 'Carretera A-12 / DGT', en: 'Road V2I / NDW', nl: 'A12 / NDW Weg' },
    title: {
      es: 'Carretera DGT / NDW A-12 · Balizas V16, Doppler V2I y YOLOX',
      en: 'Highway DGT / NDW A-12 · V16 Beacons, V2I Doppler & YOLOX',
      nl: 'Snelweg A12 / NDW · V16, V2I Doppler & YOLOX'
    },
    origin: { es: 'Vehículo averiado con niebla densa y visibilidad < 30 m', en: 'Stopped vehicle in dense fog (< 30 m visibility)', nl: 'Stilstaand voertuig in dichte mist' },
    problem: {
      es: 'A 120 km/h en niebla densa el conductor ve el obstáculo cuando ya no tiene distancia de frenado, provocando choques en cadena.',
      en: 'At 120 km/h in dense fog, oncoming drivers see a stopped hazard past their braking distance, triggering pile-ups.',
      nl: 'Bij 120 km/u in dichte mist ziet verkeer stilstaande voertuigen te laat.'
    },
    sendaRoute: {
      es: 'Fusiona baliza V16, tráfico oficial DGT/NDW, alerta V2I directa entre coches y conteo local YOLOX sin guardar matrículas para avisar 800 m antes.',
      en: 'Fuses V16 beacons, official DGT/NDW feeds, direct V2I car-to-car warnings, and local plate-free YOLOX detection 800 m upstream.',
      nl: 'Fuseert V16-bakens, DGT/NDW-data, directe V2I-waarschuwingen en kentekenvrije YOLOX-detectie.'
    },
    breakthrough: {
      es: 'Alerta preventiva sub-segundo sin nube y visión artificial vial respetuosa al 100 % con el RGPD (0 matrículas, 0 vídeo guardado).',
      en: 'Sub-second cloud-free hazard alert paired with 100% GDPR-safe vision (zero plates, zero stored footage).',
      nl: 'Sub-seconde waarschuwing zonder cloud plus 100% AVG-veilige verkeersvisie.'
    },
    sendaMinutes: 1,
    legacyMinutes: 25,
    shardsRecovered: '800 m AVISO',
    energySaved: '0 MATRÍCULAS',
    hops: [
      { label: { es: 'Frenada / Baliza V16 Detectada', en: 'Hard Brake / V16 Trigger', nl: 'Noodstop / V16' }, bearer: 'IMU + V16', ms: 250 },
      { label: { es: 'Fusión DGT / NDW + YOLOX Local', en: 'DGT / NDW + Local YOLOX', nl: 'NDW + YOLOX' }, bearer: 'NO LPR / RGPD', ms: 650 },
      { label: { es: 'Difusión V2I 800 m Aguas Arriba', en: 'V2I Broadcast 800 m Upstream', nl: 'V2I 800 m Vooruit' }, bearer: 'BLE + DOPPLER', ms: 1050 },
      { label: { es: 'Frenado Progresivo Confirmado', en: 'Safe Deceleration Confirmed', nl: 'Veilig Afremmen' }, bearer: '< 1 s LATENCIA', ms: 1450 }
    ],
    moduleHref: '/senda/carretera.html',
    moduleLabel: { es: 'Abrir Simulador de Carretera V2I', en: 'Open Road V2I Simulator', nl: 'Open Weg V2I Simulator' },
    evidenceId: 'EV-CONSOLE-16K'
  }
];

export default function LivePacketRaceSim({ locale }: { locale: Locale }) {
  const [selectedId, setSelectedId] = useState<CrisisSimId>('blackout');
  const [outagePct, setOutagePct] = useState(95);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('done');
  const [completedHops, setCompletedHops] = useState<number>(4);
  const timersRef = useRef<number[]>([]);

  const scenario = SCENARIOS.find((s) => s.id === selectedId) ?? SCENARIOS[0];

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const runSimulation = (targetScenario: CrisisSimScenario = scenario) => {
    clearTimers();
    setPhase('running');
    setCompletedHops(0);
    targetScenario.hops.forEach((hop, idx) => {
      const id = window.setTimeout(() => {
        setCompletedHops(idx + 1);
        if (idx === targetScenario.hops.length - 1) {
          setPhase('done');
        }
      }, hop.ms);
      timersRef.current.push(id);
    });
  };

  const selectScenario = (id: CrisisSimId) => {
    setSelectedId(id);
    const next = SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
    runSimulation(next);
  };

  const legacyWait = Math.round(scenario.legacyMinutes * (outagePct / 100));
  const sendaDelivery = outagePct >= 95 ? scenario.sendaMinutes : Math.max(1, Math.round(scenario.sendaMinutes * 0.85));

  const icons: Record<CrisisSimId, typeof Zap> = {
    blackout: Zap,
    dana: Waves,
    rail: TrainFront,
    seismic: Activity,
    wildfire: Flame,
    'road-nl': Radio
  };

  const ui = {
    es: {
      eyebrow: 'SIMULADOR INTERACTIVO DE PRUEBA · ENTIÉNDELO EN 15 SEGUNDOS',
      title: 'Elige una emergencia real, corta la red móvil y comprueba qué ocurre.',
      lead: 'Pulsa cualquiera de los 6 casos reales que inspiraron SENDA, ajusta el % de torres caídas y lanza un SOS de prueba para ver la diferencia en vivo entre la red tradicional y nuestro enrutamiento multicanal.',
      outageLabel: 'Nivel de colapso de red móvil simulado',
      launchBtn: 'Lanzar SOS de prueba ahora',
      replayBtn: 'Repetir simulación en vivo',
      runningBtn: 'Simulando saltos en vivo...',
      legacyCol: 'RED MÓVIL TRADICIONAL (WhatsApp / Llamadas)',
      sendaCol: 'MOTOR SENDA MULTICANAL (Sin Red + Satélite + OSINT)',
      legacyStatus: 'SIN CONEXIÓN · 0 % ACK',
      sendaStatusRun: 'BUSCANDO CAMINOS PARALELOS...',
      sendaStatusDone: 'ACK FIRMADO CONFIRMADO',
      waitPrefix: 'Espera estimada sin cobertura:',
      sendaPrefix: 'Entrega SENDA verificada:',
      whatHappens: 'CÓMO RESUELVE SENDA ESTE CASO',
      newValue: 'INNOVACIÓN CLAVE QUE APORTAMOS'
    },
    en: {
      eyebrow: 'HANDS-ON INTERACTIVE SIMULATOR · UNDERSTAND IN 15 SECONDS',
      title: 'Pick a real disaster, cut cellular towers, and watch both networks race.',
      lead: 'Tap any of the 6 real-world crises that inspired SENDA, drag the cellular outage slider, and fire a test SOS to see traditional apps versus SENDA multipath routing live.',
      outageLabel: 'Simulated cellular network outage level',
      launchBtn: 'Launch test SOS now',
      replayBtn: 'Replay live race',
      runningBtn: 'Simulating multipath hops...',
      legacyCol: 'CONVENTIONAL CELLULAR (Cloud Apps / Calls)',
      sendaCol: 'SENDA MULTIPATH ENGINE (Offline Mesh + Satellite + OSINT)',
      legacyStatus: 'NO SIGNAL · 0% ACK',
      sendaStatusRun: 'RACING PARALLEL CARRIERS...',
      sendaStatusDone: 'SIGNED ACK CONFIRMED',
      waitPrefix: 'Estimated wait without signal:',
      sendaPrefix: 'SENDA multipath delivery:',
      whatHappens: 'HOW SENDA SOLVES THIS CASE',
      newValue: 'BREAKTHROUGH INNOVATION'
    },
    nl: {
      eyebrow: 'INTERACTIEVE TESTSIMULATOR · BEGRIJP HET IN 15 SECONDEN',
      title: 'Kies een echte crisis, schakel zendmasten uit en zie het verschil live.',
      lead: 'Selecteer een van de 6 praktijkscenario’s, stel het uitvalpercentage in en vuur een test-SOS af om reguliere apps direct met SENDA te vergelijken.',
      outageLabel: 'Gesimuleerde mobiele netwerkuitval',
      launchBtn: 'Start test-SOS nu',
      replayBtn: 'Herhaal live simulatie',
      runningBtn: 'Parallelle paden simuleren...',
      legacyCol: 'REGULIER MOBIEL NETWERK (Cloud-apps / Bellen)',
      sendaCol: 'SENDA MULTIPATH ENGINE (Offline Mesh + Satelliet + OSINT)',
      legacyStatus: 'GEEN BEREIK · 0% ACK',
      sendaStatusRun: 'PARALLELLE KANALEN ZOEKEN...',
      sendaStatusDone: 'ONDERTEKENDE ACK BEVESTIGD',
      waitPrefix: 'Geschatte wachttijd zonder bereik:',
      sendaPrefix: 'SENDA bezorgtijd:',
      whatHappens: 'HOE SENDA DIT OPLOST',
      newValue: 'BELANGRIJKSTE INNOVATIE'
    }
  }[locale];

  return (
    <section className="s-section s-sunk" data-testid="live-packet-race-sim">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Satellite size={15} aria-hidden="true" />
            <span>{ui.eyebrow}</span>
          </p>
          <h2 className="s-h2">{ui.title}</h2>
          <p className="s-lead">{ui.lead}</p>
        </div>

        {/* 6 Real-World Crisis Selector Pills (3x2 desktop, 2x3 mobile) */}
        <div className="s-race-tabs" role="tablist" aria-label={ui.title}>
          {SCENARIOS.map((sc) => {
            const Icon = icons[sc.id];
            return (
              <button
                key={sc.id}
                type="button"
                role="tab"
                aria-selected={sc.id === selectedId}
                className="s-innov-tab"
                onClick={() => selectScenario(sc.id)}
                data-testid={`race-tab-${sc.id}`}
              >
                <span className="s-innov-tab-top">
                  <Icon size={15} aria-hidden="true" />
                  <span className="s-mono">{sc.sendaMinutes} MIN</span>
                </span>
                <span className="s-innov-tab-title">{sc.short[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Interactive Controls Bar */}
        <div className="s-race-controls">
          <div style={{ flex: '1 1 260px' }}>
            <div className="s-between" style={{ marginBottom: 6 }}>
              <label htmlFor="s-outage-slider" className="s-small" style={{ fontWeight: 600 }}>
                {ui.outageLabel}
              </label>
              <strong className="s-mono" style={{ color: outagePct >= 80 ? 'var(--s-coral)' : 'var(--s-accent)' }}>
                {outagePct} % OFF
              </strong>
            </div>
            <input
              id="s-outage-slider"
              type="range"
              min={40}
              max={100}
              step={5}
              value={outagePct}
              onChange={(e) => setOutagePct(Number(e.target.value))}
              className="s-range-input"
              data-testid="race-outage-slider"
            />
          </div>

          <button
            type="button"
            className="s-btn s-btn-coral"
            onClick={() => runSimulation(scenario)}
            disabled={phase === 'running'}
            data-testid="race-launch-btn"
          >
            {phase === 'running' ? (
              <Activity size={16} aria-hidden="true" />
            ) : phase === 'done' ? (
              <RotateCcw size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            <span>
              {phase === 'running' ? ui.runningBtn : phase === 'done' ? ui.replayBtn : ui.launchBtn}
            </span>
          </button>
        </div>

        {/* Live Side-by-Side Comparison Arena */}
        <div className="s-race-arena">
          {/* LEFT: Conventional Network Failure */}
          <div className="s-race-card is-legacy">
            <div className="s-between">
              <span className="s-mono s-micro" style={{ color: '#fda4af', fontWeight: 700 }}>
                {ui.legacyCol}
              </span>
              <span className="s-pill s-mono" style={{ color: '#fda4af', borderColor: 'rgba(255,107,74,0.4)' }}>
                <AlertTriangle size={12} aria-hidden="true" />
                <span>{ui.legacyStatus}</span>
              </span>
            </div>

            <div className="s-race-track">
              <div className="s-race-node is-dead">SOS</div>
              <div className="s-race-wire is-broken" />
              <div className="s-race-node is-dead">4G/5G X</div>
              <div className="s-race-wire is-broken" />
              <div className="s-race-node is-dead">0 % ACK</div>
            </div>

            <p className="s-small s-muted" style={{ margin: 0 }}>{scenario.problem[locale]}</p>

            <div className="s-race-stat-bar is-dead">
              <span>{ui.waitPrefix}</span>
              <strong className="s-num">~{legacyWait} min</strong>
            </div>
          </div>

          {/* RIGHT: SENDA Multipath Live Hop Pipeline */}
          <div className="s-race-card is-senda">
            <div className="s-between">
              <span className="s-mono s-micro" style={{ color: 'var(--s-accent)', fontWeight: 700 }}>
                {ui.sendaCol}
              </span>
              <span
                className="s-pill s-mono"
                style={{
                  color: phase === 'done' ? 'var(--s-ok)' : 'var(--s-accent)',
                  borderColor: phase === 'done' ? 'rgba(52,211,153,0.45)' : 'rgba(56,189,248,0.45)'
                }}
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                <span>{phase === 'done' ? ui.sendaStatusDone : ui.sendaStatusRun}</span>
              </span>
            </div>

            {/* 4 Live Animated Hop Nodes */}
            <ol className="s-race-hops">
              {scenario.hops.map((hop, idx) => {
                const done = idx < completedHops;
                const active = phase === 'running' && idx === completedHops;
                return (
                  <li key={hop.bearer} className={`s-race-hop${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}>
                    <span className="s-race-hop-num s-mono">0{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: 13.5 }}>{hop.label[locale]}</strong>
                      <span className="s-micro s-mono s-faint">{hop.bearer}</span>
                    </div>
                    <span className="s-mono s-micro" style={{ color: done ? 'var(--s-ok)' : 'var(--s-text-3)', fontWeight: 700 }}>
                      {done ? 'OK' : active ? '...' : 'WAIT'}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="s-race-stat-bar is-ok">
              <span>{ui.sendaPrefix}</span>
              <strong className="s-num">
                {sendaDelivery} min · {scenario.shardsRecovered} · {scenario.energySaved}
              </strong>
            </div>
          </div>
        </div>

        {/* Crystal-clear explanation & direct module launch */}
        <div className="s-innov-panel">
          <div className="s-between" style={{ marginBottom: 12 }}>
            <h3 className="s-h3" style={{ margin: 0 }}>{scenario.title[locale]}</h3>
            <EvidenceBadge locale={locale} evidenceId={scenario.evidenceId} compact />
          </div>
          <div className="s-grid s-grid-2" style={{ gap: 14 }}>
            <div className="s-innov-block is-how">
              <div className="s-innov-label">
                <Radio size={13} aria-hidden="true" />
                <span>{ui.whatHappens}</span>
              </div>
              <p>{scenario.sendaRoute[locale]}</p>
            </div>
            <div className="s-innov-block is-innov">
              <div className="s-innov-label">
                <ShieldCheck size={13} aria-hidden="true" />
                <span>{ui.newValue}</span>
              </div>
              <p>{scenario.breakthrough[locale]}</p>
            </div>
          </div>
          <div className="s-row" style={{ marginTop: 16 }}>
            <a href={scenario.moduleHref} className="s-btn s-btn-primary s-btn-sm">
              <span>{scenario.moduleLabel[locale]}</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
