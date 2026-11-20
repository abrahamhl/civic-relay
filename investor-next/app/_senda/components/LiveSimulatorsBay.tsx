'use client';

import { useState } from 'react';
import {
  Building2,
  Car,
  Compass,
  Cpu,
  ExternalLink,
  Flame,
  Layers,
  Mountain,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Wrench
} from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import { ARCHITECTURAL_RENDERS } from '../data/science';
import type { Locale, LocalizedText } from '../data/types';

type SimAppId = 'fuego3d' | 'edificios' | 'vuelo' | 'llamada' | 'carretera' | 'centro';

interface LiveSimEntry {
  id: SimAppId;
  num: string;
  src: string;
  title: LocalizedText;
  short: LocalizedText;
  badge: string;
  whatYouSimulate: LocalizedText;
  whatWeInvented: LocalizedText;
  tryIn10s: LocalizedText;
  evidenceId: string;
  extras?: Array<{ href: string; label: LocalizedText }>;
}

const LIVE_SIMS: LiveSimEntry[] = [
  {
    id: 'fuego3d',
    num: '01',
    src: '/senda/fuego3d.html',
    title: {
      es: 'Simulador de Incendio Forestal 3D (SENDA-3D · DEM 100 m)',
      en: '3D Wildfire Spread Simulator (SENDA-3D · 100 m DEM)',
      nl: '3D Natuurbrandsimulator (SENDA-3D · 100 m DEM)'
    },
    short: { es: 'Incendio 3D', en: '3D Wildfire', nl: '3D Brand' },
    badge: 'THREE.JS · DEM 100 m · GFS',
    whatYouSimulate: {
      es: 'Propagación de un frente forestal sobre relieve 3D real con modelo de elevación DEM de 100 m, combustible vegetal, humedad y dirección de viento GFS.',
      en: 'Wildfire front propagation across real 3D 100 m DEM elevation terrain driven by vegetation fuel, humidity, and GFS wind vectors.',
      nl: 'Verspreiding van een natuurbrand over echt 3D-reliëf (100 m DEM) met vegetatie, luchtvochtigheid en GFS-wind.'
    },
    whatWeInvented: {
      es: 'Acoplamiento en navegador entre física de frente 3D, probabilidad de llegada por celda y evacuación dinámica cuando las antenas locales caen.',
      en: 'In-browser coupling of 3D fire-front physics, per-cell arrival probabilities, and dynamic off-grid evacuation routing.',
      nl: 'Directe koppeling in de browser tussen 3D-brandfysica, aankomstkansen en offline evacuatieroutes.'
    },
    tryIn10s: {
      es: 'Arrastra el mapa 3D para rotar el valle, cambia la velocidad/dirección del viento y activa la capa de probabilidad de llegada.',
      en: 'Drag the 3D valley to orbit, adjust wind speed/direction, and toggle the arrival probability overlay.',
      nl: 'Draai de 3D-vallei met uw vinger of muis, pas de wind aan en schakel aankomstkansen in.'
    },
    evidenceId: 'EV-CONSOLE-16K',
    extras: [
      { href: '/senda/evacuacion.html', label: { es: 'Rutas de evacuación', en: 'Evacuation router', nl: 'Evacuatieroutes' } },
      { href: '/senda/visor.html', label: { es: 'Visor científico 4D', en: '4D scientific viewer', nl: '4D-viewer' } }
    ]
  },
  {
    id: 'edificios',
    num: '02',
    src: '/senda/edificios.html',
    title: {
      es: 'Gemelo Estructural 3D y Rescate en Escombros',
      en: '3D Structural Building Twin & Rubble Search',
      nl: '3D Gebouwtweeling & Puinredding'
    },
    short: { es: 'Edificio 3D', en: '3D Building', nl: '3D Gebouw' },
    badge: 'THREE.JS · RESCATE · CSI',
    whatYouSimulate: {
      es: 'Inspección planta por planta de un edificio dañado tras seísmo o explosión, visualizando zonas colapsadas, balizas activas y pasillos de rescate.',
      en: 'Floor-by-floor 3D inspection of a quake-damaged building showing collapsed zones, active survivor beacons, and rescue corridors.',
      nl: 'Verdieping-voor-verdieping 3D-inspectie van een beschadigd gebouw met overlevingsbakens en reddingsroutes.'
    },
    whatWeInvented: {
      es: 'Fusión en tiempo real entre gemelo 3D ligero (funciona sin Internet), lectura barométrica de planta y localización bajo escombros.',
      en: 'Real-time fusion of an offline-capable 3D twin, barometric floor estimation, and under-rubble beacon triangulation.',
      nl: 'Realtime fusie van offline 3D-twin, barometrische verdiepingshoogte en bakentriangulatie.'
    },
    tryIn10s: {
      es: 'Rota el edificio en 3D, selecciona una planta afectada y observa cómo se priorizan las balizas con menor margen vital.',
      en: 'Orbit the 3D structure, isolate an affected floor, and inspect beacon triage priority.',
      nl: 'Draai het 3D-gebouw, kies een verdieping en bekijk de prioriteit van noodbakens.'
    },
    evidenceId: 'EV-CORE-506',
    extras: [
      { href: '/senda/barrido.html', label: { es: 'Barrido puerta a puerta', en: 'House-by-house sweep', nl: 'Huis-aan-huis sweep' } },
      { href: '/senda/triaje.html', label: { es: 'Triaje START sin red', en: 'Offline START triage', nl: 'Offline START-triage' } }
    ]
  },
  {
    id: 'vuelo',
    num: '03',
    src: '/senda/vuelo.html',
    title: {
      es: 'Sobrevuelo 3D Terreno Real · Nepal Langtang (DEM 60 m + Sentinel-2)',
      en: '3D Real Terrain Flyover · Langtang Nepal (60 m DEM + Sentinel-2)',
      nl: '3D Terreinvlucht · Langtang Nepal (60 m DEM + Sentinel-2)'
    },
    short: { es: 'Sobrevuelo 3D', en: '3D Terrain', nl: '3D Terrein' },
    badge: 'DEM 60 m · SENTINEL-2 · PRE/POST',
    whatYouSimulate: {
      es: 'Vuelo interactivo sobre datos satelitales Sentinel-2 reales comparando el valle de Langtang antes y después de deslizamientos y crecidas.',
      en: 'Interactive 3D terrain flyover over real Sentinel-2 imagery comparing pre- and post-landslide/flood changes in Langtang.',
      nl: 'Interactieve 3D-vlucht over echte Sentinel-2-beelden vóór en na aardverschuivingen.'
    },
    whatWeInvented: {
      es: 'Detección de cambio satelital empaquetada para inspección 3D sin red en zonas de montaña de Nepal, Indonesia o valles incomunicados.',
      en: 'Satellite change detection packaged for offline 3D inspection in cut-off mountain corridors.',
      nl: 'Satellietveranderingsdetectie verpakt voor offline 3D-inspectie in berggebieden.'
    },
    tryIn10s: {
      es: 'Activa el modo pre/post evento y desliza la cámara sobre el cauce para identificar bloqueos y aldeas aisladas.',
      en: 'Toggle the pre/post event comparison and orbit the river valley to spot blocked crossings.',
      nl: 'Schakel tussen voor/na-beelden en bekijk geblokkeerde valleien in 3D.'
    },
    evidenceId: 'EV-CONSOLE-16K',
    extras: [
      { href: '/senda/aislamiento.html', label: { es: 'DANA Valencia EMSR773', en: 'Valencia DANA EMSR773', nl: 'Valencia EMSR773' } },
      { href: '/senda/agua-nl.html', label: { es: 'Crecidas Países Bajos (RWS)', en: 'Netherlands Water (RWS)', nl: 'Waterstand NL (RWS)' } }
    ]
  },
  {
    id: 'llamada',
    num: '04',
    src: '/senda/llamada.html',
    title: {
      es: 'Módem Acústico MFSK-16 y Llamadas Sin Internet',
      en: 'MFSK-16 Acoustic Sound Modem & Offline Voice Calls',
      nl: 'MFSK-16 Akoestische Modem & Offline Spraak'
    },
    short: { es: 'Módem Sonido', en: 'Sound Modem', nl: 'Geluid Modem' },
    badge: 'WEB AUDIO · MFSK-16 · ZERO-NET',
    whatYouSimulate: {
      es: 'Codificación y decodificación real de paquetes cifrados mediante tonos audibles MFSK-16 entre el altavoz de un móvil y el micrófono de otro.',
      en: 'Real-time encoding and decoding of encrypted emergency packets as audible MFSK-16 tones from one phone speaker to another mic.',
      nl: 'Realtime codering en decodering van versleutelde noodpakketten via MFSK-16 geluidstonen.'
    },
    whatWeInvented: {
      es: 'Cuando fallan incluso Bluetooth y Wi-Fi o los dispositivos son de fabricantes incompatibles, el sonido sirve como puente universal sin permisos de red.',
      en: 'When even Bluetooth and Wi-Fi fail or devices lack shared protocols, sound provides a universal cross-device emergency bridge.',
      nl: 'Zelfs wanneer Bluetooth of Wi-Fi ontbreekt vormt geluid een universele noodbrug.'
    },
    tryIn10s: {
      es: 'Escribe un aviso corto, pulsa emitir señal acústica y observa el espectrograma MFSK-16 decodificando cada byte.',
      en: 'Type a short alert, trigger acoustic emission, and watch the live MFSK-16 spectrogram decode bytes.',
      nl: 'Typ een korte melding, zend het geluid uit en zie de MFSK-16-decodering live.'
    },
    evidenceId: 'EV-OFFLINE-49',
    extras: [
      { href: '/senda/', label: { es: 'Abrir SENDA Campo completo', en: 'Open full SENDA Field', nl: 'Open SENDA Veld' } },
      { href: '/senda/radio.html', label: { es: 'Planificador Radio LoRa', en: 'LoRa Radio Planner', nl: 'LoRa Radioplanner' } }
    ]
  },
  {
    id: 'carretera',
    num: '05',
    src: '/senda/carretera.html',
    title: {
      es: 'Carretera V2I, Balizas V16, DGT/NDW y Prevención de Choques',
      en: 'Highway V2I Guard, V16 Beacons, DGT/NDW & Collision Prevention',
      nl: 'Snelweg V2I, V16-bakens, DGT/NDW & Botsingspreventie'
    },
    short: { es: 'Carretera V2I', en: 'Road V2I', nl: 'Weg V2I' },
    badge: 'DGT · NDW · V16 · DOPPLER',
    whatYouSimulate: {
      es: 'Frenada de emergencia, niebla densa, vehículo en sentido contrario y activación de baliza V16 correlacionados con tráfico oficial DGT y NDW.',
      en: 'Sudden braking, dense fog, wrong-way drivers, and V16 beacons fused with official DGT and NDW highway feeds.',
      nl: 'Noodstoppen, dichte mist, spookrijders en V16-bakens gekoppeld aan DGT en NDW.'
    },
    whatWeInvented: {
      es: 'Aviso preventivo 800 m aguas arriba antes de que el conductor vea el peligro, combinado con conteo local YOLOX sin leer matrículas.',
      en: 'Upstream hazard alerting 800 m before visual contact, paired with plate-free local YOLOX traffic counting.',
      nl: 'Waarschuwing 800 m vooruit vóór visueel contact, met kentekenvrije lokale YOLOX-analyse.'
    },
    tryIn10s: {
      es: 'Dispara un incidente de niebla o frenada brusca y mide el margen extra de detención ganado por los vehículos que se aproximan.',
      en: 'Trigger a fog or hard-braking incident and inspect the extra stopping distance gained upstream.',
      nl: 'Activeer een mist- of remincident en meet de gewonnen remmarge.'
    },
    evidenceId: 'EV-CONSOLE-16K',
    extras: [
      { href: '/senda/via.html', label: { es: 'Seguridad ferroviaria España', en: 'Spain rail safety twin', nl: 'Spoorveiligheid Spanje' } },
      { href: '/senda/dgt.html', label: { es: 'Panel DGT 3.0 / V16', en: 'DGT 3.0 / V16 panel', nl: 'DGT 3.0 / V16 paneel' } }
    ]
  },
  {
    id: 'centro',
    num: '06',
    src: '/senda/centro.html',
    title: {
      es: 'Centro de Coordinación 112 y Atlas Global (16.699 Fuentes)',
      en: '112 Operations Center & Global Multi-Hazard Atlas (16,699 Sources)',
      nl: '112 Coördinatiecentrum & Wereldatlas (16.699 Bronnen)'
    },
    short: { es: 'Centro 112', en: '112 Center', nl: '112 Centrum' },
    badge: '16.699 FUENTES · OSINT · RGPD',
    whatYouSimulate: {
      es: 'Puesto completo de mando civil integrando alertas ciudadanas offline, sismos USGS/EMSC, GDACS, tráfico DGT/NDW y decisiones auditadas.',
      en: 'Complete civil command desk unifying offline citizen beacons, USGS/EMSC quakes, GDACS, DGT/NDW traffic, and audited decisions.',
      nl: 'Volledige civiele meldkamer met offline burger-SOS, USGS/EMSC, GDACS en DGT/NDW.'
    },
    whatWeInvented: {
      es: 'Arquitectura abierta sin bloqueo propietario, transparente en evidencias y complementaria al 112/ES-Alert oficial con k-anonimato estricto.',
      en: 'Open, vendor-free situational fusion with transparent evidence provenance and strict k-anonymity complementing official 112.',
      nl: 'Open, transparante situatie-fusie met strikte k-anonimiteit naast officiële 112-diensten.'
    },
    tryIn10s: {
      es: 'Filtra por tipo de emergencia, abre una alerta en el mapa y comprueba cómo se enlazan las fuentes abiertas verificadas.',
      en: 'Filter hazard layers, click any map incident, and inspect how open verified feeds correlate.',
      nl: 'Filter risicolagen, klik op een incident en bekijk de gekoppelde open bronnen.'
    },
    evidenceId: 'EV-CONSOLE-16K',
    extras: [
      { href: '/senda/atlas.html', label: { es: 'Atlas multi-riesgo', en: 'Multi-hazard atlas', nl: 'Multi-risico atlas' } },
      { href: '/senda/dron.html', label: { es: 'Simulador dron de búsqueda', en: 'Search drone simulator', nl: 'Zoekdrone simulator' } }
    ]
  }
];

export default function LiveSimulatorsBay({
  locale,
  defaultMode = 'simulators'
}: {
  locale: Locale;
  defaultMode?: 'simulators' | 'renders';
}) {
  const [mode, setMode] = useState<'simulators' | 'renders'>(defaultMode);
  const [selectedSim, setSelectedSim] = useState<SimAppId>('fuego3d');
  const [mountedSims, setMountedSims] = useState<Record<string, boolean>>({});
  const [selectedRenderIdx, setSelectedRenderIdx] = useState(0);

  const sim = LIVE_SIMS.find((s) => s.id === selectedSim) ?? LIVE_SIMS[0];
  const activeRender = ARCHITECTURAL_RENDERS[selectedRenderIdx] ?? ARCHITECTURAL_RENDERS[0];
  const isMounted = Boolean(mountedSims[sim.id]);

  const simIcons: Record<SimAppId, typeof Flame> = {
    fuego3d: Flame,
    edificios: Building2,
    vuelo: Mountain,
    llamada: Radio,
    carretera: Car,
    centro: Compass
  };

  const ui = {
    es: {
      eyebrow: 'BAHÍA DE SIMULADORES 3D REALES Y RENDERS DE INGENIERÍA',
      title: 'No te conformes con capturas: abre nuestros 6 simuladores reales y los 7 renders técnicos.',
      lead: 'Cada simulador es código operativo real de SENDA (Three.js 3D, Web Audio MFSK-16, DEM Copernicus, OSINT 16.699). Cárgalo aquí mismo en 1 toque o explora los 7 renders vectoriales de arquitectura.',
      tabSims: '6 Simuladores Reales en Vivo (3D / Campo)',
      tabRenders: '7 Renders Vectoriales de Ingeniería (SVG)',
      whatSim: 'QUÉ ESTÁS SIMULANDO AQUÍ',
      whatInv: 'QUÉ INNOVACIÓN APORTA SENDA',
      try10s: 'PRUÉBALO EN 10 SEGUNDOS',
      mountBtn: 'Iniciar simulador interactivo aquí dentro',
      openFull: 'Abrir a pantalla completa',
      openSvg: 'Abrir SVG a resolución completa',
      readyTag: 'LISTO PARA INTERACTUAR · CARGA BAJO DEMANDA (0 KB EN INICIO)'
    },
    en: {
      eyebrow: 'LIVE 3D SIMULATOR BAY & ENGINEERING RENDER LIGHT-TABLE',
      title: 'Skip static brochures: launch our 6 live working simulators & 7 technical renders.',
      lead: 'Every simulator is real working SENDA code (Three.js 3D, Web Audio MFSK-16, Copernicus DEM, 16,699-source OSINT). Load any engine inline in one tap or inspect all 7 architectural vector renders.',
      tabSims: '6 Live Interactive Simulators (3D / Field)',
      tabRenders: '7 Engineering Vector Renders (SVG)',
      whatSim: 'WHAT YOU ARE SIMULATING',
      whatInv: 'WHAT SENDA INNOVATES HERE',
      try10s: 'TRY IT IN 10 SECONDS',
      mountBtn: 'Launch live simulator inside this deck',
      openFull: 'Open full screen',
      openSvg: 'Open full-resolution SVG',
      readyTag: 'READY ON DEMAND · ZERO INITIAL PAGE WEIGHT'
    },
    nl: {
      eyebrow: 'LIVE 3D-SIMULATOREN & TECHNISCHE RENDERS',
      title: 'Geen statische plaatjes: start onze 6 werkende simulatoren en 7 architectuur-renders.',
      lead: 'Elke simulator is echte werkende SENDA-software (Three.js 3D, Web Audio MFSK-16, Copernicus DEM, OSINT). Start ze direct in de pagina of bekijk de 7 vectorrenders.',
      tabSims: '6 Live Interactieve Simulatoren (3D / Veld)',
      tabRenders: '7 Technische Vectorrenders (SVG)',
      whatSim: 'WAT U HIER SIMULEERT',
      whatInv: 'WAT SENDA HIER INNOVEERT',
      try10s: 'PROBEER HET IN 10 SECONDEN',
      mountBtn: 'Start live simulator in dit venster',
      openFull: 'Open op volledig scherm',
      openSvg: 'Open volledige SVG',
      readyTag: 'DIRECT STARTKLAAR · NUL EXTRA LAADTIJD'
    }
  }[locale];

  return (
    <section className="s-section" data-testid="live-simulators-bay">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Cpu size={15} aria-hidden="true" />
            <span>{ui.eyebrow}</span>
          </p>
          <h2 className="s-h2">{ui.title}</h2>
          <p className="s-lead">{ui.lead}</p>
        </div>

        {/* Mode Switcher: Live 3D Simulators vs 7 Engineering SVG Renders */}
        <div className="s-row" role="tablist" aria-label={ui.eyebrow} style={{ gap: 10 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'simulators'}
            className={mode === 'simulators' ? 's-btn s-btn-primary s-btn-sm' : 's-btn s-btn-secondary s-btn-sm'}
            onClick={() => setMode('simulators')}
            data-testid="bay-mode-simulators"
          >
            <Play size={14} aria-hidden="true" />
            <span>{ui.tabSims}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'renders'}
            className={mode === 'renders' ? 's-btn s-btn-primary s-btn-sm' : 's-btn s-btn-secondary s-btn-sm'}
            onClick={() => setMode('renders')}
            data-testid="bay-mode-renders"
          >
            <Layers size={14} aria-hidden="true" />
            <span>{ui.tabRenders}</span>
          </button>
        </div>

        {mode === 'simulators' ? (
          <div className="s-stack" style={{ gap: 18 }}>
            {/* 6 Simulator Bento Selector (3x2 desktop, 2x3 mobile) */}
            <div className="s-race-tabs" role="tablist" aria-label={ui.tabSims}>
              {LIVE_SIMS.map((entry) => {
                const Icon = simIcons[entry.id];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedSim === entry.id}
                    className="s-innov-tab"
                    onClick={() => setSelectedSim(entry.id)}
                    data-testid={`bay-sim-${entry.id}`}
                  >
                    <span className="s-innov-tab-top">
                      <Icon size={15} aria-hidden="true" />
                      <span className="s-mono">{entry.num}</span>
                    </span>
                    <span className="s-innov-tab-title">{entry.short[locale]}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Simulator Explanatory Frame + Live Embedded Sandbox */}
            <div className="s-innov-panel">
              <div className="s-between" style={{ marginBottom: 14 }}>
                <div>
                  <span className="s-pill s-mono" style={{ color: 'var(--s-accent)', marginBottom: 8 }}>
                    SIMULADOR {sim.num} · {sim.badge}
                  </span>
                  <h3 className="s-h3" style={{ margin: 0 }}>{sim.title[locale]}</h3>
                </div>
                <EvidenceBadge locale={locale} evidenceId={sim.evidenceId} compact />
              </div>

              <div className="s-grid s-grid-3" style={{ gap: 12, marginBottom: 18 }}>
                <div className="s-innov-block is-how">
                  <div className="s-innov-label">
                    <Wrench size={13} aria-hidden="true" />
                    <span>{ui.whatSim}</span>
                  </div>
                  <p>{sim.whatYouSimulate[locale]}</p>
                </div>
                <div className="s-innov-block is-innov">
                  <div className="s-innov-label">
                    <Sparkles size={13} aria-hidden="true" />
                    <span>{ui.whatInv}</span>
                  </div>
                  <p>{sim.whatWeInvented[locale]}</p>
                </div>
                <div className="s-innov-block is-problem">
                  <div className="s-innov-label">
                    <ShieldCheck size={13} aria-hidden="true" />
                    <span>{ui.try10s}</span>
                  </div>
                  <p>{sim.tryIn10s[locale]}</p>
                </div>
              </div>

              {/* Embedded Real App Frame (Instant click-to-boot for 0 cold-load overhead) */}
              <div className="s-bay-viewport">
                {isMounted ? (
                  <iframe
                    key={sim.src}
                    src={sim.src}
                    title={sim.title[locale]}
                    className="s-bay-iframe"
                    loading="lazy"
                    data-testid={`bay-iframe-${sim.id}`}
                  />
                ) : (
                  <div className="s-bay-launcher">
                    <span className="s-pill s-mono" style={{ color: 'var(--s-ok)', borderColor: 'rgba(52,211,153,0.4)' }}>
                      {ui.readyTag}
                    </span>
                    <strong style={{ fontSize: 'clamp(1.05rem, 2vw, 1.35rem)', maxWidth: '40ch', textAlign: 'center' }}>
                      {sim.title[locale]}
                    </strong>
                    <div className="s-row" style={{ justifyContent: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="s-btn s-btn-coral"
                        onClick={() => setMountedSims((prev) => ({ ...prev, [sim.id]: true }))}
                        data-testid={`bay-launch-${sim.id}`}
                      >
                        <Play size={16} aria-hidden="true" />
                        <span>{ui.mountBtn}</span>
                      </button>
                      <a href={sim.src} className="s-btn s-btn-secondary">
                        <span>{ui.openFull}</span>
                        <ExternalLink size={15} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="s-row" style={{ marginTop: 14, gap: 8 }}>
                <a href={sim.src} className="s-btn s-btn-primary s-btn-sm">
                  <span>{ui.openFull}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
                {sim.extras?.map((ex) => (
                  <a key={ex.href} href={ex.href} className="s-btn s-btn-secondary s-btn-sm">
                    <span>{ex.label[locale]}</span>
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Interactive 7-Render Architectural Light-Table */
          <div className="s-stack" style={{ gap: 18 }} data-testid="renders-light-table">
            <div className="s-innov-tabs" role="tablist" aria-label={ui.tabRenders}>
              {ARCHITECTURAL_RENDERS.map((r, idx) => (
                <button
                  key={r.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedRenderIdx === idx}
                  className="s-innov-tab"
                  onClick={() => setSelectedRenderIdx(idx)}
                  data-testid={`render-tab-${r.id}`}
                >
                  <span className="s-innov-tab-top">
                    <Layers size={14} aria-hidden="true" />
                    <span className="s-mono">0{idx + 1}</span>
                  </span>
                  <span className="s-innov-tab-title">{r.title[locale]}</span>
                </button>
              ))}
            </div>

            <div className="s-innov-panel">
              <div className="s-between" style={{ marginBottom: 14 }}>
                <div>
                  <span className="s-pill s-mono" style={{ color: 'var(--s-accent)', marginBottom: 8 }}>
                    RENDER VECTORIAL 0{selectedRenderIdx + 1} / 0{ARCHITECTURAL_RENDERS.length}
                  </span>
                  <h3 className="s-h3" style={{ margin: 0 }}>{activeRender.title[locale]}</h3>
                </div>
                <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" compact />
              </div>

              <div className="s-render-stage">
                <img
                  src={activeRender.src}
                  alt={activeRender.title[locale]}
                  loading="lazy"
                  className="s-render-img"
                />
              </div>

              <div className="s-between" style={{ marginTop: 14, gap: 12 }}>
                <p className="s-small s-muted" style={{ margin: 0, maxWidth: '68ch' }}>
                  {activeRender.caption[locale]}
                </p>
                <a
                  href={activeRender.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="s-btn s-btn-primary s-btn-sm"
                >
                  <span>{ui.openSvg}</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
