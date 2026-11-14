'use client';
import { useMemo, useState } from 'react';
import {
  alertPropagation,
  coverageEntropy,
  deliveryMonteCarlo,
  energyBudget,
  functionScorecard,
  kalmanFilter1D,
  makeDemoGraph,
  paretoRoutes,
} from '../lib/function-lab.mjs';
import type { Locale } from './copy';
import './function-lab.css';

type PanelId = 'alert' | 'routing' | 'delivery' | 'coverage' | 'energy' | 'tracking' | 'crypto';

const words = {
  en: {
    eyebrow: 'INTERACTIVE FUNCTION LAB / EVERY PILLAR, ONE BY ONE',
    title: 'THE MODEL, OPENED. EACH FUNCTION, TESTABLE.',
    summary: 'Seven independent panels. Move the inputs and watch the mathematics respond. Everything is a model over synthetic data except the signature panel, which runs real WebCrypto in your browser.',
    tabs: {
      alert: 'Alert spread', routing: 'Adaptive routing', delivery: 'Delivery probability',
      coverage: 'Sensor coverage', energy: 'Energy budget', tracking: 'Node tracking', crypto: 'Signature integrity',
    },
    alert: {
      title: 'ALERT DIFFUSION · COMPARTMENTAL MODEL',
      body: 'Awareness behaves like a contagion: informed nodes relay to synthetic contacts. R0 = contacts × beta / gamma. Above 1 the alert percolates; below 1 it dies out.',
      labels: ['Virtual population', 'Contacts per node', 'Transmission β', 'Recovery γ', 'Steps'],
      r0: 'Basic reproduction R₀', peak: 'Peak informed', attack: 'Final attack rate', cumulative: 'Cumulative informed',
    },
    routing: {
      title: 'ADAPTIVE ROUTING · PARETO FRONTIER',
      body: 'No single "best" route: we keep every path that is not beaten on both energy and latency. The frontier is the real trade-off an operator chooses from.',
      cheapest: 'Lowest energy', fastest: 'Lowest latency', options: 'Pareto-optimal paths', path: 'Path', energy: 'Energy', latency: 'Latency',
    },
    delivery: {
      title: 'DELIVERY · RETRY BACKOFF',
      body: 'Each attempt succeeds independently with probability p. The closed form for k attempts is 1 − (1−p)ᵏ. Monte Carlo re-derives it from seeded trials so you can see the sampling error.',
      labels: ['Success per attempt', 'Attempts', 'Monte Carlo trials'],
      closed: 'Closed form', mc: 'Monte Carlo', err: 'Standard error', ci: '95% interval', attempts: 'Mean attempts', expected: 'Expected attempts (1/p)',
    },
    coverage: {
      title: 'SENSOR COVERAGE · SEARCH-SPACE REDUCTION',
      body: 'Each sensor covers a wedge of the field. The union shrinks the blind area; the search-space reduction in bits is log₂(1 / blind fraction).',
      labels: ['Sensors', 'Half-angle (degrees)', 'Range (km)', 'Field radius (km)'],
      covered: 'Covered fraction', blind: 'Blind fraction', bits: 'Search reduction (bits)',
    },
    energy: {
      title: 'ENERGY BUDGET · DUTY CYCLE',
      body: 'Sleep dominates. Average power = tx·duty + sleep·(1−duty). Runtime = battery / average power. This is how a node survives an outage.',
      labels: ['Battery (Wh)', 'TX seconds', 'TX power (W)', 'Sleep power (W)', 'Interval (s)', 'Target (h)'],
      duty: 'Duty cycle', avg: 'Average power', runtime: 'Runtime (h)', messages: 'Messages possible', margin: 'Margin vs target', met: 'Target met', missed: 'Target missed',
    },
    tracking: {
      title: 'NODE TRACKING · KALMAN FILTER 1-D',
      body: 'A constant-velocity tracker fuses a noisy position stream with its own prediction. The gain tells you how much it trusts each new measurement.',
      labels: ['Process noise q', 'Measurement noise r'],
      estimate: 'Final estimate', velocity: 'Estimated velocity', gain: 'Final Kalman gain', raw: 'Raw measurement', filtered: 'Filtered estimate', truth: 'Synthetic truth',
    },
    crypto: {
      title: 'SIGNATURE INTEGRITY · REAL WEBCRYPTO',
      body: 'This panel is not a model: your browser generates a P-256 key pair, signs a message with ECDSA and verifies it. Tamper with the message and verification must fail.',
      generate: 'Generate key & sign', verify: 'Verify signature', sign: 'Sign', tamper: 'Tamper with message', status: 'Status',
      idle: 'Idle — generate a signature to begin.', signed: 'Signed. Verify to confirm integrity.', verified: 'Verified: signature matches.', failed: 'Rejected: signature does not match.', unsupported: 'WebCrypto unavailable in this context.', pub: 'Public key (JWK, truncated)', sig: 'Signature (bytes)',
    },
    scorecard: 'FUNCTION SCORECARD', model: 'MODEL', real: 'REAL IN BROWSER', notimpl: 'NOT IMPLEMENTED',
    disclaimer: 'Panels 1–6 are deterministic models over synthetic numbers with stated assumptions. Panel 7 is a real browser cryptographic operation. None of this is an operational emergency service, a validated sensor measurement, or an SOS/112 connection.'
  },
  es: {
    eyebrow: 'LABORATORIO INTERACTIVO / CADA PILAR, UNO A UNO',
    title: 'EL MODELO, ABIERTO. CADA FUNCIÓN, COMPROBABLE.',
    summary: 'Siete paneles independientes. Mueve las entradas y observa responder a la matemática. Todo es un modelo sobre datos sintéticos salvo la firma, que ejecuta WebCrypto real en tu navegador.',
    tabs: {
      alert: 'Difusión de alerta', routing: 'Enrutamiento adaptativo', delivery: 'Probabilidad de entrega',
      coverage: 'Cobertura de sensores', energy: 'Presupuesto de energía', tracking: 'Seguimiento de nodo', crypto: 'Integridad de firma',
    },
    alert: {
      title: 'DIFUSIÓN DE ALERTA · MODELO COMPARTIMENTAL',
      body: 'La información se propaga como un contagio: los nodos informados retransmiten a contactos sintéticos. R₀ = contactos × beta / gamma. Por encima de 1 la alerta percola; por debajo se extingue.',
      labels: ['Población virtual', 'Contactos por nodo', 'Transmisión β', 'Recuperación γ', 'Pasos'],
      r0: 'Reproducción básica R₀', peak: 'Pico de informados', attack: 'Tasa de ataque final', cumulative: 'Informados acumulados',
    },
    routing: {
      title: 'ENRUTAMIENTO ADAPTATIVO · FRONTERA DE PARETO',
      body: 'No hay una única ruta «mejor»: conservamos toda ruta que no sea superada a la vez en energía y latencia. La frontera es el compromiso real que elige un operador.',
      cheapest: 'Mínima energía', fastest: 'Mínima latencia', options: 'Rutas óptimas de Pareto', path: 'Ruta', energy: 'Energía', latency: 'Latencia',
    },
    delivery: {
      title: 'ENTREGA · REINTENTOS ESCALONADOS',
      body: 'Cada intento acierta de forma independiente con probabilidad p. La forma cerrada para k intentos es 1 − (1−p)ᵏ. Monte Carlo la re-deriva con semilla para que veas el error de muestreo.',
      labels: ['Éxito por intento', 'Intentos', 'Ensayos Monte Carlo'],
      closed: 'Forma cerrada', mc: 'Monte Carlo', err: 'Error estándar', ci: 'Intervalo 95%', attempts: 'Intentos medios', expected: 'Intentos esperados (1/p)',
    },
    coverage: {
      title: 'COBERTURA DE SENSORES · REDUCCIÓN DEL ESPACIO DE BÚSQUEDA',
      body: 'Cada sensor cubre una cuña del campo. La unión encoge el área ciega; la reducción del espacio de búsqueda en bits es log₂(1 / fracción ciega).',
      labels: ['Sensores', 'Semiángulo (grados)', 'Alcance (km)', 'Radio del campo (km)'],
      covered: 'Fracción cubierta', blind: 'Fracción ciega', bits: 'Reducción de búsqueda (bits)',
    },
    energy: {
      title: 'PRESUPUESTO DE ENERGÍA · CICLO DE TRABAJO',
      body: 'El reposo domina. Potencia media = tx·ciclo + reposo·(1−ciclo). Autonomía = batería / potencia media. Así sobrevive un nodo a un apagón.',
      labels: ['Batería (Wh)', 'Segundos TX', 'Potencia TX (W)', 'Potencia reposo (W)', 'Intervalo (s)', 'Objetivo (h)'],
      duty: 'Ciclo de trabajo', avg: 'Potencia media', runtime: 'Autonomía (h)', messages: 'Mensajes posibles', margin: 'Margen vs objetivo', met: 'Objetivo cumplido', missed: 'Objetivo no cumplido',
    },
    tracking: {
      title: 'SEGUIMIENTO DE NODO · FILTRO DE KALMAN 1-D',
      body: 'Un rastreador de velocidad constante fusiona una posición ruidosa con su propia predicción. La ganancia indica cuánto confía en cada medición nueva.',
      labels: ['Ruido de proceso q', 'Ruido de medición r'],
      estimate: 'Estimación final', velocity: 'Velocidad estimada', gain: 'Ganancia final', raw: 'Medición cruda', filtered: 'Estimación filtrada', truth: 'Verdad sintética',
    },
    crypto: {
      title: 'INTEGRIDAD DE FIRMA · WEBCRYPTO REAL',
      body: 'Este panel no es un modelo: tu navegador genera un par de claves P-256, firma un mensaje con ECDSA y lo verifica. Manipula el mensaje y la verificación debe fallar.',
      generate: 'Generar clave y firmar', verify: 'Verificar firma', sign: 'Firmar', tamper: 'Manipular mensaje', status: 'Estado',
      idle: 'En reposo — genera una firma para empezar.', signed: 'Firmado. Verifica para confirmar la integridad.', verified: 'Verificado: la firma coincide.', failed: 'Rechazado: la firma no coincide.', unsupported: 'WebCrypto no disponible en este contexto.', pub: 'Clave pública (JWK, truncada)', sig: 'Firma (bytes)',
    },
    scorecard: 'TARJETA DE FUNCIONES', model: 'MODELO', real: 'REAL EN NAVEGADOR', notimpl: 'NO IMPLEMENTADO',
    disclaimer: 'Los paneles 1–6 son modelos deterministas sobre números sintéticos con hipótesis declaradas. El panel 7 es una operación criptográfica real del navegador. Nada de esto es un servicio de emergencias operativo, una medición validada de sensores ni una conexión SOS/112.'
  },
  nl: {
    eyebrow: 'INTERACTIEF FUNCTIELAB / ELKE PIJLER, ÉÉN VOOR ÉÉN',
    title: 'HET MODEL, OPENGELEGD. ELKE FUNCTIE, TESTBAAR.',
    summary: 'Zeven onafhankelijke panelen. Beweeg de invoer en zie de wiskunde reageren. Alles is een model op synthetische data, behalve de handtekening: die draait echte WebCrypto in je browser.',
    tabs: {
      alert: 'Alarmverspreiding', routing: 'Adaptieve routering', delivery: 'Afleverkans',
      coverage: 'Sensordekking', energy: 'Energiebudget', tracking: 'Nodetracking', crypto: 'Handtekeningintegriteit',
    },
    alert: {
      title: 'ALARMVERSPREIDING · COMPARTIMENTEEL MODEL',
      body: 'Informatie verspreidt zich als een besmetting: geïnformeerde nodes geven door aan synthetische contacten. R₀ = contacten × beta / gamma. Boven 1 percoleert het alarm; eronder dooft het uit.',
      labels: ['Virtuele populatie', 'Contacten per node', 'Transmissie β', 'Herstel γ', 'Stappen'],
      r0: 'Basisreproductie R₀', peak: 'Piek geïnformeerden', attack: 'Eindaanvalsgraad', cumulative: 'Cumulatief geïnformeerden',
    },
    routing: {
      title: 'ADAPTIEVE ROUTERING · PARETO-FRONTIER',
      body: 'Er is geen enkele «beste» route: we bewaren elk pad dat niet op zowel energie als latentie wordt verslagen. De frontier is de echte afweging die een operator kiest.',
      cheapest: 'Laagste energie', fastest: 'Laagste latentie', options: 'Pareto-optimale paden', path: 'Pad', energy: 'Energie', latency: 'Latentie',
    },
    delivery: {
      title: 'AFLEVERING · HERHAALPOGINGEN',
      body: 'Elke poging slaagt onafhankelijk met kans p. De gesloten vorm voor k pogingen is 1 − (1−p)ᵏ. Monte Carlo leidt dit opnieuw af met een seed, zodat je de steekproeffout ziet.',
      labels: ['Succes per poging', 'Pogingen', 'Monte Carlo-proeven'],
      closed: 'Gesloten vorm', mc: 'Monte Carlo', err: 'Standaardfout', ci: '95%-interval', attempts: 'Gemiddelde pogingen', expected: 'Verwachte pogingen (1/p)',
    },
    coverage: {
      title: 'SENSORDEKKING · REDUCTIE VAN DE ZOEKRUIMTE',
      body: 'Elke sensor dekt een wig van het veld. De unie verkleint het blinde gebied; de reductie van de zoekruimte in bits is log₂(1 / blinde fractie).',
      labels: ['Sensoren', 'Halve hoek (graden)', 'Bereik (km)', 'Veldstraal (km)'],
      covered: 'Bedekt deel', blind: 'Blind deel', bits: 'Zoekreductie (bits)',
    },
    energy: {
      title: 'ENERGIEBUDGET · DUTY CYCLE',
      body: 'Slaap domineert. Gemiddeld vermogen = tx·duty + slaap·(1−duty). Looptijd = batterij / gemiddeld vermogen. Zo overleeft een node een storing.',
      labels: ['Batterij (Wh)', 'TX-seconden', 'TX-vermogen (W)', 'Slaapvermogen (W)', 'Interval (s)', 'Doel (h)'],
      duty: 'Duty cycle', avg: 'Gemiddeld vermogen', runtime: 'Looptijd (h)', messages: 'Mogelijke berichten', margin: 'Marge vs doel', met: 'Doel gehaald', missed: 'Doel niet gehaald',
    },
    tracking: {
      title: 'NODETRACKING · KALMANFILTER 1-D',
      body: 'Een tracker met constante snelheid combineert een ruisige positie met zijn eigen voorspelling. De gain toont hoeveel hij elke nieuwe meting vertrouwt.',
      labels: ['Procesruis q', 'Metingruis r'],
      estimate: 'Eindschatting', velocity: 'Geschatte snelheid', gain: 'Laatste Kalman-gain', raw: 'Ruwe meting', filtered: 'Gefilterde schatting', truth: 'Synthetische waarheid',
    },
    crypto: {
      title: 'HANDTEKENINGINTEGRITEIT · ECHTE WEBCRYPTO',
      body: 'Dit paneel is geen model: je browser maakt een P-256-sleutelpaar, ondertekent een bericht met ECDSA en verifieert het. Wijzig het bericht en verificatie moet falen.',
      generate: 'Sleutel maken en ondertekenen', verify: 'Handtekening verifiëren', sign: 'Ondertekenen', tamper: 'Bericht wijzigen', status: 'Status',
      idle: 'Inactief — maak een handtekening om te beginnen.', signed: 'Ondertekend. Verifieer om integriteit te bevestigen.', verified: 'Geverifieerd: handtekening klopt.', failed: 'Afgewezen: handtekening klopt niet.', unsupported: 'WebCrypto niet beschikbaar in deze context.', pub: 'Publieke sleutel (JWK, ingekort)', sig: 'Handtekening (bytes)',
    },
    scorecard: 'FUNCTIEKAART', model: 'MODEL', real: 'ECHT IN BROWSER', notimpl: 'NIET GEÏMPLEMENTEERD',
    disclaimer: 'Panelen 1–6 zijn deterministische modellen op synthetische getallen met genoemde aannames. Paneel 7 is een echte browserbewerking. Niets hiervan is een operationele nooddienst, een gevalideerde sensormeting of een SOS/112-verbinding.'
  }
} as const;

type PanelCopy<K extends keyof typeof words.en> = (typeof words)[Locale][K];

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}
function pct(value: number): string { return `${fmt(value * 100, 1)}%`; }

function Slider({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; suffix?: string;
}) {
  return <label className="fl-slider">
    <span>{label}<strong>{value}{suffix || ''}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))} />
  </label>;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  return <div className={`fl-stat${tone ? ` fl-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

export default function FunctionLab({ locale }: { locale: Locale }) {
  const w = words[locale];
  const [panel, setPanel] = useState<PanelId>('alert');
  const tabs = Object.keys(w.tabs) as PanelId[];

  return <section className="fl-lab" id="function-lab" aria-labelledby="fl-title">
    <div className="container">
      <div className="fl-intro">
        <p className="eyebrow">{w.eyebrow}</p>
        <h2 id="fl-title">{w.title}</h2>
        <p>{w.summary}</p>
      </div>
      <div className="fl-tabs" role="tablist" aria-label={w.title}>
        {tabs.map((id) => <button key={id} role="tab" type="button"
          aria-selected={panel === id} aria-controls={`fl-panel-${id}`} id={`fl-tab-${id}`}
          className={panel === id ? 'fl-active' : ''} onClick={() => setPanel(id)}>
          {w.tabs[id]}
        </button>)}
      </div>
      <div className="fl-panel-wrap">
        {panel === 'alert' && <AlertPanel w={w.alert} />}
        {panel === 'routing' && <RoutingPanel w={w.routing} />}
        {panel === 'delivery' && <DeliveryPanel w={w.delivery} />}
        {panel === 'coverage' && <CoveragePanel w={w.coverage} />}
        {panel === 'energy' && <EnergyPanel w={w.energy} />}
        {panel === 'tracking' && <TrackingPanel w={w.tracking} />}
        {panel === 'crypto' && <CryptoPanel w={w.crypto} />}
      </div>
      <div className="fl-scorecard">
        <h3>{w.scorecard}</h3>
        <div className="fl-score-grid">
          {functionScorecard().map((row) => <div key={row.id} className={`fl-score fl-status-${row.status.toLowerCase()}`}>
            <strong>{row.label}</strong>
            <span>{row.model}</span>
            <b>{row.status === 'MODELO' ? w.model : row.status === 'REAL_EN_NAVEGADOR' ? w.real : w.notimpl}</b>
          </div>)}
        </div>
      </div>
      <p className="fl-disclaimer">{w.disclaimer}</p>
    </div>
  </section>;
}

// Panel 1 — alert propagation with an SVG stacked-area chart.
function AlertPanel({ w }: { w: PanelCopy<'alert'> }) {
  const [population, setPopulation] = useState(400);
  const [contacts, setContacts] = useState(6);
  const [beta, setBeta] = useState(0.2);
  const [gamma, setGamma] = useState(0.3);
  const [steps, setSteps] = useState(30);
  const result = useMemo(() => alertPropagation({ population, contacts, beta, gamma, steps, seed: 20261106 }),
    [population, contacts, beta, gamma, steps]);
  const maxY = population;
  const width = 560;
  const height = 220;
  const points = result.series;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * width;
  const y = (v: number) => height - (v / maxY) * height;
  const line = (key: 'susceptible' | 'informed' | 'recovered' | 'cumulativeInformed') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  return <div className="fl-panel" id="fl-panel-alert" role="tabpanel" aria-labelledby="fl-tab-alert">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <Slider label={w.labels[0]} value={population} min={50} max={1000} step={10} onChange={setPopulation} />
      <Slider label={w.labels[1]} value={contacts} min={0} max={20} step={1} onChange={setContacts} />
      <Slider label={w.labels[2]} value={beta} min={0.01} max={0.6} step={0.01} onChange={setBeta} />
      <Slider label={w.labels[3]} value={gamma} min={0.05} max={1} step={0.05} onChange={setGamma} />
      <Slider label={w.labels[4]} value={steps} min={5} max={60} step={1} onChange={setSteps} />
    </div>
    <div className="fl-output">
      <svg viewBox={`0 0 ${width} ${height}`} className="fl-chart" role="img" aria-label={w.title}>
        <line x1="0" y1={height} x2={width} y2={height} className="fl-axis" />
        <path d={`${line('susceptible')} L${width},${height} L0,${height} Z`} className="fl-area-s" />
        <path d={`${line('informed')} L${width},${height} L0,${height} Z`} className="fl-area-i" />
        <path d={`${line('recovered')} L${width},${height} L0,${height} Z`} className="fl-area-r" />
        <path d={line('cumulativeInformed')} className="fl-line" />
      </svg>
      <div className="fl-legend"><span className="fl-s">S</span><span className="fl-i">I</span><span className="fl-r">R</span></div>
      <div className="fl-stat-grid">
        <Stat label={w.r0} value={fmt(result.r0)} tone={result.r0 >= 1 ? 'good' : 'bad'} />
        <Stat label={w.peak} value={Math.round(result.peakInformed)} />
        <Stat label={w.attack} value={pct(result.attackRate)} />
        <Stat label={w.cumulative} value={Math.round(result.finalCumulative)} />
      </div>
    </div>
  </div>;
}

// Panel 2 — Pareto routes over the demo graph.
function RoutingPanel({ w }: { w: PanelCopy<'routing'> }) {
  const graph = useMemo(() => makeDemoGraph(), []);
  const frontier = useMemo(() => paretoRoutes(graph, 'ORIGIN', 'RELAY'), [graph]);
  const cheapest = frontier.reduce((a, b) => (a.energy <= b.energy ? a : b), frontier[0]);
  const fastest = frontier.reduce((a, b) => (a.latencyMs <= b.latencyMs ? a : b), frontier[0]);

  return <div className="fl-panel" id="fl-panel-routing" role="tabpanel" aria-labelledby="fl-tab-routing">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <div className="fl-route-svg-wrap">
        <svg viewBox="0 0 340 260" className="fl-route-svg" role="img" aria-label={w.title}>
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#4f8599" /></marker></defs>
          {[
            ['ORIGIN', 40, 130], ['BLE_1', 120, 70], ['BLE_2', 200, 40], ['WIFI_1', 120, 190],
            ['WIFI_2', 220, 210], ['GATEWAY', 40, 230], ['RELAY', 300, 130],
          ].map(([id, cx, cy]) => <g key={String(id)}>
            <circle cx={Number(cx)} cy={Number(cy)} r="20" className="fl-node" />
            <text x={Number(cx)} y={Number(cy) + 3} textAnchor="middle" className="fl-node-label">{String(id).slice(0, 6)}</text>
          </g>)}
          {[
            ['ORIGIN', 'BLE_1'], ['ORIGIN', 'WIFI_1'], ['ORIGIN', 'GATEWAY'], ['BLE_1', 'BLE_2'],
            ['BLE_1', 'WIFI_1'], ['BLE_2', 'RELAY'], ['WIFI_1', 'WIFI_2'], ['WIFI_1', 'RELAY'],
            ['WIFI_2', 'RELAY'], ['GATEWAY', 'RELAY'],
          ].map(([a, b]) => {
            const coords: Record<string, [number, number]> = { ORIGIN: [40, 130], BLE_1: [120, 70], BLE_2: [200, 40], WIFI_1: [120, 190], WIFI_2: [220, 210], GATEWAY: [40, 230], RELAY: [300, 130] };
            const [x1, y1] = coords[a]; const [x2, y2] = coords[b];
            return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className="fl-edge" markerEnd="url(#arrow)" />;
          })}
        </svg>
      </div>
    </div>
    <div className="fl-output">
      <div className="fl-stat-grid">
        <Stat label={w.options} value={frontier.length} />
        <Stat label={w.cheapest} value={`${fmt(cheapest.energy, 1)} E`} />
        <Stat label={w.fastest} value={`${fmt(fastest.latencyMs, 0)} ms`} />
      </div>
      <table className="fl-table">
        <thead><tr><th>{w.path}</th><th>{w.energy}</th><th>{w.latency}</th></tr></thead>
        <tbody>{frontier.map((route) => <tr key={route.path.join('>')}>
          <td>{route.path.join(' → ')}</td><td>{fmt(route.energy, 1)}</td><td>{fmt(route.latencyMs, 0)} ms</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

// Panel 3 — delivery probability Monte Carlo.
function DeliveryPanel({ w }: { w: PanelCopy<'delivery'> }) {
  const [perAttempt, setPerAttempt] = useState(0.3);
  const [attempts, setAttempts] = useState(5);
  const [trials, setTrials] = useState(20000);
  const result = useMemo(() => deliveryMonteCarlo({ perAttempt, attempts, trials, seed: 99 }),
    [perAttempt, attempts, trials]);
  const curve = useMemo(() => Array.from({ length: 20 }, (_, i) => {
    const k = i + 1;
    return { k, p: 1 - Math.pow(1 - perAttempt, k) };
  }), [perAttempt]);
  const width = 560; const height = 200;
  const x = (i: number) => (i / 19) * width;
  const y = (p: number) => height - p * height;

  return <div className="fl-panel" id="fl-panel-delivery" role="tabpanel" aria-labelledby="fl-tab-delivery">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <Slider label={w.labels[0]} value={perAttempt} min={0.05} max={1} step={0.05} onChange={setPerAttempt} />
      <Slider label={w.labels[1]} value={attempts} min={1} max={20} step={1} onChange={setAttempts} />
      <Slider label={w.labels[2]} value={trials} min={1000} max={50000} step={1000} onChange={setTrials} />
    </div>
    <div className="fl-output">
      <svg viewBox={`0 0 ${width} ${height}`} className="fl-chart" role="img" aria-label={w.title}>
        <line x1="0" y1={height} x2={width} y2={height} className="fl-axis" />
        <path d={`M0,${height} ${curve.map((pt, i) => `L${x(i)},${y(pt.p)}`).join(' ')} L${width},${height} Z`} className="fl-area-i" />
        <path d={curve.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(pt.p)}`).join(' ')} className="fl-line" />
        <line x1={x(attempts - 1)} y1="0" x2={x(attempts - 1)} y2={height} className="fl-marker" />
      </svg>
      <div className="fl-stat-grid">
        <Stat label={w.closed} value={pct(result.closedForm)} />
        <Stat label={w.mc} value={pct(result.probability)} />
        <Stat label={w.err} value={fmt(result.stdErr * 100, 2) + '%'} />
        <Stat label={w.ci} value={`${fmt(result.ci95[0] * 100, 1)}–${fmt(result.ci95[1] * 100, 1)}%`} />
        <Stat label={w.attempts} value={fmt(result.meanAttempts)} />
        <Stat label={w.expected} value={fmt(result.expectedAttemptsClosedForm)} />
      </div>
    </div>
  </div>;
}

// Panel 4 — sensor coverage with a radar-style SVG.
function CoveragePanel({ w }: { w: PanelCopy<'coverage'> }) {
  const [sensorCount, setSensorCount] = useState(8);
  const [halfAngleDeg, setHalfAngleDeg] = useState(35);
  const [rangeKm, setRangeKm] = useState(4);
  const [fieldRadiusKm, setFieldRadiusKm] = useState(10);
  const result = useMemo(() => coverageEntropy({ sensorCount, halfAngleDeg, rangeKm, fieldRadiusKm }),
    [sensorCount, halfAngleDeg, rangeKm, fieldRadiusKm]);
  const size = 260; const c = size / 2;
  const scale = (c - 8) / fieldRadiusKm;
  const sensors = Array.from({ length: sensorCount }, (_, i) => {
    const angle = (i / sensorCount) * Math.PI * 2;
    return { x: c + Math.cos(angle) * 6, y: c + Math.sin(angle) * 6, dir: angle };
  });

  return <div className="fl-panel" id="fl-panel-coverage" role="tabpanel" aria-labelledby="fl-tab-coverage">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <Slider label={w.labels[0]} value={sensorCount} min={1} max={24} step={1} onChange={setSensorCount} />
      <Slider label={w.labels[1]} value={halfAngleDeg} min={5} max={180} step={5} onChange={setHalfAngleDeg} />
      <Slider label={w.labels[2]} value={rangeKm} min={1} max={10} step={0.5} onChange={setRangeKm} />
      <Slider label={w.labels[3]} value={fieldRadiusKm} min={5} max={20} step={1} onChange={setFieldRadiusKm} />
    </div>
    <div className="fl-output">
      <svg viewBox={`0 0 ${size} ${size}`} className="fl-radar" role="img" aria-label={w.title}>
        <circle cx={c} cy={c} r={fieldRadiusKm * scale} className="fl-field" />
        {sensors.map((s, i) => {
          const a0 = s.dir - (halfAngleDeg * Math.PI) / 360;
          const a1 = s.dir + (halfAngleDeg * Math.PI) / 360;
          const r = Math.min(rangeKm, fieldRadiusKm) * scale;
          const x0 = c + Math.cos(a0) * r; const y0 = c + Math.sin(a0) * r;
          const x1 = c + Math.cos(a1) * r; const y1 = c + Math.sin(a1) * r;
          return <path key={i} d={`M${c},${c} L${x0},${y0} A${r},${r} 0 0,1 ${x1},${y1} Z`} className="fl-wedge" />;
        })}
        {sensors.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r="3" className="fl-sensor" />)}
      </svg>
      <div className="fl-stat-grid">
        <Stat label={w.covered} value={pct(result.coveredFraction)} />
        <Stat label={w.blind} value={pct(result.blindFraction)} tone={result.blindFraction > 0.5 ? 'bad' : 'good'} />
        <Stat label={w.bits} value={fmt(result.searchSpaceReductionBits, 2)} />
      </div>
    </div>
  </div>;
}

// Panel 5 — energy budget.
function EnergyPanel({ w }: { w: PanelCopy<'energy'> }) {
  const [batteryWh, setBatteryWh] = useState(20);
  const [txSeconds, setTxSeconds] = useState(3);
  const [txPowerW, setTxPowerW] = useState(2);
  const [sleepPowerW, setSleepPowerW] = useState(0.02);
  const [intervalS, setIntervalS] = useState(60);
  const [targetHours, setTargetHours] = useState(72);
  const result = useMemo(() => energyBudget({ batteryWh, txSeconds, txPowerW, sleepPowerW, intervalS, targetHours }),
    [batteryWh, txSeconds, txPowerW, sleepPowerW, intervalS, targetHours]);

  return <div className="fl-panel" id="fl-panel-energy" role="tabpanel" aria-labelledby="fl-tab-energy">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <Slider label={w.labels[0]} value={batteryWh} min={1} max={100} step={1} onChange={setBatteryWh} />
      <Slider label={w.labels[1]} value={txSeconds} min={1} max={Math.max(1, intervalS)} step={1} onChange={(v) => setTxSeconds(Math.min(v, intervalS))} />
      <Slider label={w.labels[2]} value={txPowerW} min={0.1} max={5} step={0.1} onChange={setTxPowerW} />
      <Slider label={w.labels[3]} value={sleepPowerW} min={0.001} max={0.5} step={0.001} onChange={setSleepPowerW} />
      <Slider label={w.labels[4]} value={intervalS} min={10} max={300} step={5} onChange={(v) => { setIntervalS(v); if (txSeconds > v) setTxSeconds(v); }} />
      <Slider label={w.labels[5]} value={targetHours} min={1} max={336} step={1} onChange={setTargetHours} />
    </div>
    <div className="fl-output">
      <div className="fl-battery"><div className="fl-battery-fill" style={{ width: `${Math.min(100, (result.runtimeHours / targetHours) * 100)}%`, background: result.targetMet ? '#57c7bd' : '#e0846c' }} /></div>
      <div className="fl-stat-grid">
        <Stat label={w.duty} value={pct(result.dutyCycle)} />
        <Stat label={w.avg} value={fmt(result.avgPowerW, 4) + ' W'} />
        <Stat label={w.runtime} value={fmt(result.runtimeHours, 1)} />
        <Stat label={w.messages} value={result.messages.toLocaleString()} />
        <Stat label={w.margin} value={`${result.marginHours >= 0 ? '+' : ''}${fmt(result.marginHours, 1)} h`} tone={result.targetMet ? 'good' : 'bad'} />
        <Stat label={w.met} value={result.targetMet ? `✓ ${w.met}` : `✗ ${w.missed}`} tone={result.targetMet ? 'good' : 'bad'} />
      </div>
    </div>
  </div>;
}

// Panel 6 — Kalman filter.
function TrackingPanel({ w }: { w: PanelCopy<'tracking'> }) {
  const [q, setQ] = useState(1);
  const [r, setR] = useState(4);
  const truth = useMemo(() => Array.from({ length: 30 }, (_, i) => i * 2), []);
  const noise = useMemo(() => [0.4, -0.7, 0.2, 0.9, -0.3, 0.1, -0.5, 0.6, -0.1, 0.3, 0.2, -0.4, 0.5, -0.2, 0.1, 0.7, -0.6, 0.3, -0.1, 0.4, 0.2, -0.3, 0.5, -0.4, 0.1, 0.6, -0.2, 0.3, -0.5, 0.2], []);
  const measurements = useMemo(() => truth.map((v, i) => v + noise[i]), [truth, noise]);
  const result = useMemo(() => kalmanFilter1D({ points: measurements, q, r, start: 0, startVelocity: 0 }), [measurements, q, r]);
  const width = 560; const height = 220;
  const x = (i: number) => (i / (truth.length - 1)) * width;
  const y = (v: number) => height - (v / 60) * height;
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const finalRaw = measurements[measurements.length - 1];
  const finalEst = result.trace[result.trace.length - 1];
  const finalTruth = truth[truth.length - 1];

  return <div className="fl-panel" id="fl-panel-tracking" role="tabpanel" aria-labelledby="fl-tab-tracking">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <Slider label={w.labels[0]} value={q} min={0.01} max={5} step={0.01} onChange={setQ} />
      <Slider label={w.labels[1]} value={r} min={0.5} max={20} step={0.5} onChange={setR} />
      <div className="fl-legend fl-legend-lines">
        <span className="fl-l-truth">{w.truth}</span><span className="fl-l-raw">{w.raw}</span><span className="fl-l-filtered">{w.filtered}</span>
      </div>
    </div>
    <div className="fl-output">
      <svg viewBox={`0 0 ${width} ${height}`} className="fl-chart" role="img" aria-label={w.title}>
        <line x1="0" y1={height} x2={width} y2={height} className="fl-axis" />
        <path d={line(truth)} className="fl-line-truth" />
        <path d={line(measurements)} className="fl-line-raw" />
        <path d={line(result.trace.map((t) => t.estimate))} className="fl-line" />
      </svg>
      <div className="fl-stat-grid">
        <Stat label={w.estimate} value={fmt(finalEst.estimate)} />
        <Stat label={w.velocity} value={fmt(result.finalVelocity, 3)} />
        <Stat label={w.gain} value={fmt(finalEst.gain, 3)} />
        <Stat label={w.raw} value={fmt(finalRaw)} />
        <Stat label={w.filtered} value={fmt(finalEst.estimate)} />
        <Stat label={w.truth} value={fmt(finalTruth)} />
      </div>
    </div>
  </div>;
}

// Panel 7 — real WebCrypto ECDSA. This is the only panel that is not a model.
function CryptoPanel({ w }: { w: PanelCopy<'crypto'> }) {
  const [status, setStatus] = useState<'idle' | 'signed' | 'verified' | 'failed' | 'unsupported'>('idle');
  const [message, setMessage] = useState('SENDA synthetic alert · EXERCISE_ONLY');
  const [pub, setPub] = useState('');
  const [sig, setSig] = useState(0);
  const [keyPair, setKeyPair] = useState<CryptoKeyPair | null>(null);
  const [signature, setSignature] = useState<ArrayBuffer | null>(null);

  const encoder = new TextEncoder();
  const generate = async () => {
    if (typeof crypto === 'undefined' || !crypto.subtle) { setStatus('unsupported'); return; }
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const body = encoder.encode(message);
    const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, body);
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
    setKeyPair(pair); setSignature(sigBuf); setSig(sigBuf.byteLength);
    setPub(`${jwk.x?.slice(0, 18)}…${jwk.y?.slice(-12)}`);
    setStatus('signed');
  };
  const verify = async () => {
    if (!keyPair || !signature) return;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.publicKey, signature, encoder.encode(message));
    setStatus(ok ? 'verified' : 'failed');
  };
  const tamper = () => { setMessage((m) => `${m} · TAMPERED`); setStatus(signature ? 'signed' : 'idle'); };

  const messages = { idle: w.idle, signed: w.signed, verified: w.verified, failed: w.failed, unsupported: w.unsupported };
  return <div className="fl-panel" id="fl-panel-crypto" role="tabpanel" aria-labelledby="fl-tab-crypto">
    <div className="fl-controls">
      <h3>{w.title}</h3><p>{w.body}</p>
      <label className="fl-textarea"><span>{w.status}</span>
        <textarea value={message} onChange={(e) => { setMessage(e.currentTarget.value); setStatus(signature ? 'signed' : 'idle'); }} rows={3} />
      </label>
      <div className="fl-tools">
        <button type="button" onClick={() => { void generate(); }}>{w.generate}</button>
        <button type="button" onClick={() => { void verify(); }} disabled={!signature}>{w.verify}</button>
        <button type="button" onClick={tamper}>{w.tamper}</button>
      </div>
    </div>
    <div className="fl-output">
      <p className={`fl-crypto-status fl-${status}`} aria-live="polite">{messages[status]}</p>
      {pub && <p className="fl-kv"><span>{w.pub}</span><code>{pub}</code></p>}
      {sig > 0 && <p className="fl-kv"><span>{w.sig}</span><code>{sig} bytes</code></p>}
      <p className="fl-note">ECDSA · P-256 · SHA-256 · crypto.subtle</p>
    </div>
  </div>;
}
