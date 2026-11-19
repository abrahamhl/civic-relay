'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  betaPdf,
  betaQuantile,
  binomialCcdf,
  dtnDelivery,
  emptyLedger,
  erasureDelivery,
  exportLedger,
  recordObservation,
  recommendBearer,
  rssiRanging,
  seirRK45,
  summarizePosteriors,
  tallyLedger,
  verifyPriorsIntegrity,
} from '../lib/precision-lab.mjs';
import { mulberry32 } from '../lib/function-lab.mjs';
import type { Ledger } from '../lib/precision-lab.mjs';
import type { Locale } from './copy';
import priors from '../public/data/inference-priors.v1.json';
import './precision-lab.css';

const LEDGER_KEY = 'senda.precision.ledger.v1';

type Copy = {
  eyebrow: string;
  title: string;
  summary: string;
  integrityTitle: string;
  integrityBody: string;
  verified: string;
  mismatch: string;
  checking: string;
  digest: string;
  ledgerTitle: string;
  ledgerBody: string;
  recordSuccess: string;
  recordFailure: string;
  exportLedger: string;
  resetLedger: string;
  storedLocally: string;
  recommendation: string;
  posteriorTitle: string;
  posteriorBody: string;
  bearer: string;
  prior: string;
  observed: string;
  mean: string;
  credible: string;
  predictive: string;
  thompsonNote: string;
  erasureTitle: string;
  erasureBody: string;
  delivery: string;
  overhead: string;
  redundancy: string;
  expectedShards: string;
  shardsNeeded: string;
  shardsSent: string;
  dtnTitle: string;
  dtnBody: string;
  byDeadline: string;
  expectedDelay: string;
  medianDelay: string;
  tail90: string;
  copyCost: string;
  rangingTitle: string;
  rangingBody: string;
  distance: string;
  sigma: string;
  relative: string;
  variance: string;
  seirTitle: string;
  seirBody: string;
  r0: string;
  peak: string;
  peakDay: string;
  attack: string;
  steps: string;
  massError: string;
  tolerances: string;
  days: string;
  offlineNote: string;
  disclaimer: string;
  labels: {
    success: string;
    failure: string;
    k: string;
    n: string;
    perShard: string;
    contactRate: string;
    copies: string;
    horizon: string;
    rssi: string;
    pathLoss: string;
    sigmaDb: string;
    contacts: string;
    beta: string;
    infectiousDays: string;
    population: string;
    latencyDays: string;
  };
};

const words: Record<Locale, Copy> = {
  en: {
    eyebrow: 'PRECISION & INFERENCE LAB / EXACT MATH, OFFLINE BY CONSTRUCTION',
    title: 'FROM GUESS TO CALIBRATED POSTERIOR.',
    summary: 'Five closed-form or adaptive numerical models behind the offline stack: Bayesian bearer reliability, exact erasure tails, delay-tolerant delivery, RSSI ranging bounds and a SEIR epidemic integrated with error control. Everything runs in this browser; the priors database is sealed and the observation ledger stays on your device.',
    integrityTitle: 'SEALED PRIORS DATABASE',
    integrityBody: 'The packaged JSON is canonicalised (sorted keys, no whitespace, integrity field excluded) and hashed with SHA-256 in your browser. Any drift in build or transit breaks the seal.',
    verified: 'SEAL VERIFIED',
    mismatch: 'SEAL MISMATCH',
    checking: 'VERIFYING',
    digest: 'SHA-256',
    ledgerTitle: 'LOCAL INFERENCE LEDGER',
    ledgerBody: 'Each observation narrows the Beta posterior for a bearer. Nothing leaves the device; export it to carry the evidence to another field phone.',
    recordSuccess: '+ success',
    recordFailure: '+ failure',
    exportLedger: 'Export ledger',
    resetLedger: 'Reset',
    storedLocally: 'stored in this browser',
    recommendation: 'Thompson recommendation',
    posteriorTitle: 'BEARER RELIABILITY · BETA-BINOMIAL',
    posteriorBody: 'A conjugate Beta prior over each bearer’s success probability is updated with observed successes and failures. The curve is the exact posterior density; the band is the 95% credible interval.',
    bearer: 'Bearer',
    prior: 'Prior Beta',
    observed: 'Observed',
    mean: 'Posterior mean',
    credible: '95% credible',
    predictive: 'Next-success predictive',
    thompsonNote: 'One deterministic Thompson sample per bearer, seeded by the ledger length; the highest sample is proposed for the next transmission.',
    erasureTitle: 'ERASURE DELIVERY · EXACT TAIL',
    erasureBody: 'A message is split into n shards; any k reconstruct it (Cauchy matrix over GF(2^8)). The probability of at least k arrivals is the exact binomial tail, not a simulation.',
    delivery: 'P(reconstruct)',
    overhead: 'Air overhead',
    redundancy: 'Parity fraction',
    expectedShards: 'Expected arrivals',
    shardsNeeded: 'k needed',
    shardsSent: 'n sent',
    dtnTitle: 'DTN DELAY · EXPONENTIAL CONTACT',
    dtnBody: 'With independent relay copies and Poisson contacts at rate λ, the first delivery time is exponential with rate copies·λ. The curve is the exact CDF; the marker is your deadline.',
    byDeadline: 'P(delivery ≤ deadline)',
    expectedDelay: 'Expected delay',
    medianDelay: 'Median',
    tail90: '90th percentile',
    copyCost: 'Replicas',
    rangingTitle: 'RSSI RANGING · CRAMÉR-RAO BOUND',
    rangingBody: 'Log-distance path loss inverted exactly, with the Cramér-Rao lower bound on range error under Gaussian RSSI noise. It shows why RSSI alone cannot promise metre accuracy.',
    distance: 'Estimated range',
    sigma: '1σ range error',
    relative: 'Relative 1σ',
    variance: 'CRLB variance',
    seirTitle: 'SEIR EPIDEMIC · RK45 ADAPTIVE',
    seirBody: 'A latent compartment E is integrated with the Dormand-Prince 5(4) pair and per-step error control. The panel reports mass conservation and the accepted step count, not just pretty curves.',
    r0: 'R₀',
    peak: 'Peak infectious',
    peakDay: 'Peak day',
    attack: 'Final attack rate',
    steps: 'Accepted steps',
    massError: 'Max mass error',
    tolerances: 'Tolerances',
    days: 'days',
    offlineNote: 'No network request is made by this section: priors are bundled, all maths runs in the client and the ledger persists in localStorage. It keeps working with the network disabled.',
    disclaimer: 'The priors are declared exercise ranges, not field measurements. Local observations calibrate them but do not replace trials. A real claim needs trial data.',
    labels: {
      success: 'successes', failure: 'failures', k: 'data shards k', n: 'total shards n', perShard: 'shard success p',
      contactRate: 'contact rate λ (1/h)', copies: 'replicas', horizon: 'deadline (h)', rssi: 'measured RSSI (dBm)',
      pathLoss: 'path-loss exponent', sigmaDb: 'RSSI noise σ (dB)', contacts: 'contacts per day', beta: 'transmission β',
      infectiousDays: 'infectious days', population: 'population', latencyDays: 'latency (days)',
    },
  },
  es: {
    eyebrow: 'LABORATORIO DE PRECISIÓN E INFERENCIA / MATEMÁTICA EXACTA, OFFLINE POR CONSTRUCCIÓN',
    title: 'DE LA SUPOSICIÓN A LA POSTERIOR CALIBRADA.',
    summary: 'Cinco modelos cerrados o numéricos adaptativos detrás de la capa offline: fiabilidad bayesiana de portadores, colas exactas de borrado, entrega tolerante a retardos, cotas de rango por RSSI y una epidemia SEIR integrada con control de error. Todo corre en este navegador; la base de priors va sellada y el libro de observaciones se queda en tu dispositivo.',
    integrityTitle: 'BASE DE PRIORS SELLADA',
    integrityBody: 'El JSON empaquetado se canonicaliza (claves ordenadas, sin espacios, campo integrity excluido) y se hashea con SHA-256 en tu navegador. Cualquier deriva en build o tránsito rompe el sello.',
    verified: 'SELLO VERIFICADO',
    mismatch: 'SELLO ROTO',
    checking: 'VERIFICANDO',
    digest: 'SHA-256',
    ledgerTitle: 'LIBRO LOCAL DE INFERENCIA',
    ledgerBody: 'Cada observación estrecha la posterior Beta de un portador. Nada sale del dispositivo; expórtalo para llevar la evidencia a otro teléfono de campo.',
    recordSuccess: '+ éxito',
    recordFailure: '+ fallo',
    exportLedger: 'Exportar libro',
    resetLedger: 'Reiniciar',
    storedLocally: 'guardado en este navegador',
    recommendation: 'Recomendación Thompson',
    posteriorTitle: 'FIABILIDAD DEL PORTADOR · BETA-BINOMIAL',
    posteriorBody: 'Un prior Beta conjugado sobre la probabilidad de éxito de cada portador se actualiza con éxitos y fallos observados. La curva es la densidad posterior exacta; la banda es el intervalo creíble del 95%.',
    bearer: 'Portador',
    prior: 'Prior Beta',
    observed: 'Observado',
    mean: 'Media posterior',
    credible: '95% creíble',
    predictive: 'Predictiva de próximo éxito',
    thompsonNote: 'Una muestra Thompson determinista por portador, sembrada con la longitud del libro; la muestra mayor se propone para la próxima transmisión.',
    erasureTitle: 'ENTREGA CON BORRADO · COLA EXACTA',
    erasureBody: 'El mensaje se trocea en n fragmentos; cualesquiera k lo reconstruyen (matriz de Cauchy sobre GF(2^8)). La probabilidad de que lleguen al menos k es la cola binomial exacta, no una simulación.',
    delivery: 'P(reconstruir)',
    overhead: 'Sobrecarga aérea',
    redundancy: 'Fracción de paridad',
    expectedShards: 'Llegadas esperadas',
    shardsNeeded: 'k necesarios',
    shardsSent: 'n enviados',
    dtnTitle: 'RETARDO DTN · CONTACTO EXPONENCIAL',
    dtnBody: 'Con copias de retransmisión independientes y contactos Poisson de tasa λ, el tiempo hasta la primera entrega es exponencial de tasa copias·λ. La curva es la CDF exacta; el marcador es tu plazo.',
    byDeadline: 'P(entrega ≤ plazo)',
    expectedDelay: 'Retardo esperado',
    medianDelay: 'Mediana',
    tail90: 'Percentil 90',
    copyCost: 'Réplicas',
    rangingTitle: 'RANGO RSSI · COTA DE CRAMÉR-RAO',
    rangingBody: 'Pérdida log-distancia invertida de forma exacta, con la cota inferior de Cramér-Rao del error de distancia bajo ruido gaussiano en RSSI. Explica por qué el RSSI solo no puede prometer precisión métrica.',
    distance: 'Rango estimado',
    sigma: 'Error 1σ de rango',
    relative: '1σ relativo',
    variance: 'Varianza CRLB',
    seirTitle: 'EPIDEMIA SEIR · RK45 ADAPTATIVO',
    seirBody: 'El compartimento latente E se integra con el par Dormand-Prince 5(4) y control de error por paso. El panel informa conservación de masa y pasos aceptados, no solo curvas bonitas.',
    r0: 'R₀',
    peak: 'Infecciosos máximos',
    peakDay: 'Día del pico',
    attack: 'Tasa de ataque final',
    steps: 'Pasos aceptados',
    massError: 'Error máx. de masa',
    tolerances: 'Tolerancias',
    days: 'días',
    offlineNote: 'Esta sección no hace ninguna petición de red: los priors van empaquetados, toda la matemática corre en el cliente y el libro persiste en localStorage. Sigue funcionando con la red desactivada.',
    disclaimer: 'Los priors son rangos de ejercicio declarados, no mediciones de campo. Las observaciones locales los calibran pero no sustituyen ensayos. Una afirmación real exige datos de ensayo.',
    labels: {
      success: 'éxitos', failure: 'fallos', k: 'fragmentos de datos k', n: 'fragmentos totales n', perShard: 'éxito por fragmento p',
      contactRate: 'tasa de contacto λ (1/h)', copies: 'réplicas', horizon: 'plazo (h)', rssi: 'RSSI medido (dBm)',
      pathLoss: 'exponente de pérdida', sigmaDb: 'ruido RSSI σ (dB)', contacts: 'contactos por día', beta: 'transmisión β',
      infectiousDays: 'días infecciosos', population: 'población', latencyDays: 'latencia (días)',
    },
  },
  nl: {
    eyebrow: 'PRECISIE- EN INFERENTIELAB / EXACTE WISKUNDE, OFFLINE ONTWORPEN',
    title: 'VAN GOK NAAR GEKALIBREERDE POSTERIOR.',
    summary: 'Vijf gesloten of adaptief-numerieke modellen achter de offline-stack: Bayesiaanse betrouwbaarheid per drager, exacte erasure-staarten, delay-tolerante levering, RSSI-afstandsgrenzen en een SEIR-epidemie met foutcontrole. Alles draait in deze browser; de priors-database is verzegeld en het observatielogboek blijft op je toestel.',
    integrityTitle: 'VERZEGELDE PRIORS-DATABASE',
    integrityBody: 'De meegeleverde JSON wordt gecanonicaliseerd (gesorteerde sleutels, geen witruimte, integrity-veld uitgesloten) en in je browser met SHA-256 gehasht. Elke afwijking in build of transport breekt het zegel.',
    verified: 'ZEGEL GEVERIFIEERD',
    mismatch: 'ZEGEL GEBROKEN',
    checking: 'VERIFIËREN',
    digest: 'SHA-256',
    ledgerTitle: 'LOKAAL INFERENTIELOGBOEK',
    ledgerBody: 'Elke observatie vernauwt de Beta-posterior van een drager. Niets verlaat het toestel; exporteer het om het bewijs naar een andere veldtelefoon te brengen.',
    recordSuccess: '+ succes',
    recordFailure: '+ fout',
    exportLedger: 'Logboek exporteren',
    resetLedger: 'Herstellen',
    storedLocally: 'opgeslagen in deze browser',
    recommendation: 'Thompson-advies',
    posteriorTitle: 'DRAGERBETROUWBAARHEID · BETA-BINOMIAAL',
    posteriorBody: 'Een conjugaat Beta-prior op de succeskans van elke drager wordt bijgewerkt met waargenomen successen en fouten. De curve is de exacte posterior-dichtheid; de band is het 95%-geloofwaardigheidsinterval.',
    bearer: 'Drager',
    prior: 'Prior Beta',
    observed: 'Waargenomen',
    mean: 'Posterior-gemiddelde',
    credible: '95% geloofwaardig',
    predictive: 'Voorspelling volgende succes',
    thompsonNote: 'Eén deterministische Thompson-steekproef per drager, geseed met de logboeklengte; de hoogste steekproef wordt voorgesteld voor de volgende uitzending.',
    erasureTitle: 'LEVERING MET ERASURE · EXACTE STAART',
    erasureBody: 'Een bericht wordt in n fragmenten gesplitst; elke k ervan reconstrueert het (Cauchy-matrix over GF(2^8)). De kans op minstens k aankomsten is de exacte binomiale staart, geen simulatie.',
    delivery: 'P(reconstructie)',
    overhead: 'Lucht-overhead',
    redundancy: 'Pariteitsfractie',
    expectedShards: 'Verwachte aankomsten',
    shardsNeeded: 'k nodig',
    shardsSent: 'n verzonden',
    dtnTitle: 'DTN-VERTRAGING · EXPONENTIEEL CONTACT',
    dtnBody: 'Met onafhankelijke relay-kopieën en Poisson-contacten met snelheid λ is de tijd tot eerste levering exponentieel met snelheid kopieën·λ. De curve is de exacte CDF; de marker is je deadline.',
    byDeadline: 'P(levering ≤ deadline)',
    expectedDelay: 'Verwachte vertraging',
    medianDelay: 'Mediaan',
    tail90: '90e percentiel',
    copyCost: 'Replica’s',
    rangingTitle: 'RSSI-AFSTAND · CRAMÉR-RAO-GRENS',
    rangingBody: 'Log-afstandspadverlies exact geïnverteerd, met de Cramér-Rao-ondergrens op de afstandsfout bij Gaussische RSSI-ruis. Het toont waarom RSSI alleen geen meternauwkeurigheid kan beloven.',
    distance: 'Geschatte afstand',
    sigma: '1σ afstandsfout',
    relative: 'Relatieve 1σ',
    variance: 'CRLB-variantie',
    seirTitle: 'SEIR-EPIDEMIE · ADAPTIEVE RK45',
    seirBody: 'Het latente compartiment E wordt geïntegreerd met het Dormand-Prince 5(4)-paar en foutcontrole per stap. Het paneel meldt massabehoud en het aantal geaccepteerde stappen, niet alleen mooie curven.',
    r0: 'R₀',
    peak: 'Piek infectieus',
    peakDay: 'Piekdag',
    attack: 'Uiteindelijke aanvalsgraad',
    steps: 'Geaccepteerde stappen',
    massError: 'Max. massafout',
    tolerances: 'Toleranties',
    days: 'dagen',
    offlineNote: 'Deze sectie doet geen netwerkverzoek: priors zijn meegebundeld, alle wiskunde draait in de client en het logboek staat in localStorage. Het blijft werken met het netwerk uitgeschakeld.',
    disclaimer: 'De priors zijn verklaarde oefenbereiken, geen veldmetingen. Lokale observaties kalibreren ze maar vervangen geen proeven. Een echte claim vereist proefdata.',
    labels: {
      success: 'successen', failure: 'fouten', k: 'datasementen k', n: 'totale segmenten n', perShard: 'succes per segment p',
      contactRate: 'contactratio λ (1/u)', copies: 'replica’s', horizon: 'deadline (u)', rssi: 'gemeten RSSI (dBm)',
      pathLoss: 'padverlies-exponent', sigmaDb: 'RSSI-ruis σ (dB)', contacts: 'contacten per dag', beta: 'transmissie β',
      infectiousDays: 'infectieuze dagen', population: 'populatie', latencyDays: 'latenz (dagen)',
    },
  },
};

const intl = (locale: Locale) => (locale === 'es' ? 'es-ES' : locale === 'nl' ? 'nl-NL' : 'en-GB');

function fmtNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(digits);
  if (abs === 0) return '0';
  if (abs < 1e-4) return value.toExponential(2);
  return value.toFixed(Math.min(6, digits + 2));
}

function pct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 0.999995) return '> 99.9995%';
  return `${(value * 100).toFixed(value > 0.99 ? 3 : 2)}%`;
}

type Point = { x: number; y: number };
type Series = { points: Point[]; color: string; fill?: string; width?: number; dash?: boolean };

function Plot({
  series,
  markers = [],
  xDomain,
  yDomain,
  xTicks = 5,
  yTicks = 4,
  xUnit,
  yUnit,
  ariaLabel,
  height = 190,
  showMetrics = false,
}: {
  series: Series[];
  markers?: number[];
  xDomain: [number, number];
  yDomain?: [number, number];
  xTicks?: number;
  yTicks?: number;
  xUnit?: string;
  yUnit?: string;
  ariaLabel: string;
  height?: number;
  showMetrics?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [metrics, setMetrics] = useState({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const cssWidth = parent.clientWidth;
      if (cssWidth <= 0) return;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const backingWidth = Math.round(cssWidth * dpr);
      const backingHeight = Math.round(height * dpr);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = cssWidth;
      const h = height;
      const margin = { left: 46, right: 12, top: 14, bottom: 28 };
      const iw = w - margin.left - margin.right;
      const ih = h - margin.top - margin.bottom;
      const [x0, x1] = xDomain;
      let maxY = 0;
      for (const line of series) for (const p of line.points) if (p.y > maxY) maxY = p.y;
      const [y0, y1] = yDomain ?? [0, maxY > 0 ? maxY * 1.08 : 1];
      const sx = (x: number) => margin.left + ((x - x0) / (x1 - x0)) * iw;
      const sy = (y: number) => margin.top + ih - ((y - y0) / (y1 - y0)) * ih;
      const clampY = (y: number) => Math.max(y0, Math.min(y1, y));

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#061018';
      ctx.fillRect(0, 0, w, h);
      ctx.font = '9px ui-monospace, SFMono-Regular, Consolas, monospace';
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#1b3542';
      for (let i = 0; i <= xTicks; i += 1) {
        const x = x0 + ((x1 - x0) * i) / xTicks;
        const px = Math.round(sx(x)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, margin.top);
        ctx.lineTo(px, margin.top + ih);
        ctx.stroke();
      }
      for (let i = 0; i <= yTicks; i += 1) {
        const y = y0 + ((y1 - y0) * i) / yTicks;
        const py = Math.round(sy(y)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(margin.left, py);
        ctx.lineTo(margin.left + iw, py);
        ctx.stroke();
      }
      ctx.strokeStyle = '#33505c';
      ctx.strokeRect(margin.left + 0.5, margin.top + 0.5, iw, ih);
      ctx.fillStyle = '#8fb0bd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= xTicks; i += 1) {
        const x = x0 + ((x1 - x0) * i) / xTicks;
        ctx.fillText(fmtNumber(x), sx(x), margin.top + ih + 8);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= yTicks; i += 1) {
        const y = y0 + ((y1 - y0) * i) / yTicks;
        ctx.fillText(fmtNumber(y), margin.left - 6, sy(y));
      }
      if (yUnit) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#6f8f9c';
        ctx.fillText(yUnit, margin.left + 2, 2);
      }
      if (xUnit) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#6f8f9c';
        ctx.fillText(xUnit, margin.left + iw, h - 2);
      }
      for (const line of series) {
        if (line.points.length === 0) continue;
        if (line.fill) {
          ctx.beginPath();
          ctx.moveTo(sx(line.points[0].x), sy(clampY(line.points[0].y)));
          for (const p of line.points.slice(1)) ctx.lineTo(sx(p.x), sy(clampY(p.y)));
          ctx.lineTo(sx(line.points[line.points.length - 1].x), sy(y0));
          ctx.lineTo(sx(line.points[0].x), sy(y0));
          ctx.closePath();
          ctx.fillStyle = line.fill;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(sx(line.points[0].x), sy(clampY(line.points[0].y)));
        for (const p of line.points.slice(1)) ctx.lineTo(sx(p.x), sy(clampY(p.y)));
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.width ?? 1.8;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.setLineDash(line.dash ? [5, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = '#f0c46c';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      for (const marker of markers) {
        if (marker < x0 || marker > x1) continue;
        const px = Math.round(sx(marker)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, margin.top);
        ctx.lineTo(px, margin.top + ih);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      setMetrics((prev) => {
        if (prev.width === backingWidth && prev.height === backingHeight && prev.dpr === dpr) return prev;
        return { width: backingWidth, height: backingHeight, dpr };
      });
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(draw);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(parent);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [series, markers, xDomain, yDomain, xTicks, yTicks, xUnit, yUnit, height]);

  return (
    <div className="pl-plot">
      <canvas ref={canvasRef} className="pl-canvas" style={{ height }} role="img" aria-label={ariaLabel} />
      {showMetrics ? (
        <span className="pl-render-note">
          {metrics.width > 0
            ? `CANVAS ${metrics.width} × ${metrics.height} px · DPR ${metrics.dpr.toFixed(2)} · EXACT AXIS TRANSFORM`
            : 'CANVAS INITIALISING'}
        </span>
      ) : null}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}) {
  return (
    <label className="pl-slider">
      <span>
        <span>{label}</span>
        <strong>{display}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={`pl-stat${tone ? ` pl-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function PrecisionLab({ locale }: { locale: Locale }) {
  const w = words[locale];
  const numberLocale = intl(locale);

  const [ledger, setLedger] = useState<Ledger>(() => emptyLedger());
  const [hydrated, setHydrated] = useState(false);
  const [seal, setSeal] = useState<{ status: 'checking' | 'ok' | 'fail'; digest: string }>({
    status: 'checking',
    digest: '',
  });
  const [bearerId, setBearerId] = useState<string>('MESHTASTIC');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LEDGER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { version?: number; observations?: unknown };
        if (parsed.version === 1 && Array.isArray(parsed.observations)) {
          setLedger({ version: 1, observations: parsed.observations as Ledger['observations'] });
        }
      }
    } catch {
      /* storage unavailable or corrupt: start empty */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch {
      /* quota or privacy mode: keep in memory */
    }
  }, [ledger, hydrated]);

  useEffect(() => {
    let alive = true;
    verifyPriorsIntegrity(priors)
      .then((result) => {
        if (alive) setSeal({ status: result.ok ? 'ok' : 'fail', digest: result.actual });
      })
      .catch(() => {
        if (alive) setSeal({ status: 'fail', digest: '' });
      });
    return () => {
      alive = false;
    };
  }, []);

  const posteriors = useMemo(() => summarizePosteriors(priors, ledger), [ledger]);
  const selected = useMemo(
    () => posteriors.find((row) => row.id === bearerId) ?? posteriors[0],
    [posteriors, bearerId],
  );
  const recommendation = useMemo(
    () => recommendBearer(posteriors, mulberry32(ledger.observations.length + 7)),
    [posteriors, ledger.observations.length],
  );
  const totals = useMemo(() => tallyLedger(ledger), [ledger]);

  const posteriorChart = useMemo(() => {
    const a = selected.posterior.alpha;
    const b = selected.posterior.beta;
    const lo = Math.max(1e-4, betaQuantile(0.0005, a, b));
    const hi = Math.min(1 - 1e-4, betaQuantile(0.9995, a, b));
    const points: Point[] = [];
    for (let i = 0; i <= 180; i += 1) {
      const x = lo + ((hi - lo) * i) / 180;
      points.push({ x, y: betaPdf(x, a, b) });
    }
    return [{ points, color: '#7ee8db', fill: 'rgba(126,232,219,.16)' }];
  }, [selected]);

  const [k, setK] = useState<number>(priors.erasure.k);
  const [n, setN] = useState<number>(priors.erasure.n);
  const [perShard, setPerShard] = useState<number>(0.6);
  const erasure = useMemo(() => erasureDelivery({ k, n, perShard }), [k, n, perShard]);
  const erasureChart = useMemo(() => {
    const points: Point[] = [];
    for (let i = 0; i <= 120; i += 1) {
      const p = 0.2 + (0.79 * i) / 120;
      points.push({ x: p, y: binomialCcdf(k, n, p) });
    }
    return [{ points, color: '#7ee8db', fill: 'rgba(126,232,219,.12)' }];
  }, [k, n]);

  const [contactRate, setContactRate] = useState<number>(priors.dtn.contactRatePerHour);
  const [copies, setCopies] = useState<number>(priors.dtn.copies);
  const [horizon, setHorizon] = useState<number>(12);
  const dtn = useMemo(
    () => dtnDelivery({ contactRatePerHour: contactRate, copies, horizonHours: horizon }),
    [contactRate, copies, horizon],
  );
  const dtnChart = useMemo(() => {
    const maxHours = Math.max(48, horizon * 1.5);
    const rate = contactRate * copies;
    const points: Point[] = [];
    for (let i = 0; i <= 140; i += 1) {
      const t = (maxHours * i) / 140;
      points.push({ x: t, y: 1 - Math.exp(-rate * t) });
    }
    return [{ points, color: '#7ee8db', fill: 'rgba(126,232,219,.12)' }];
  }, [contactRate, copies, horizon]);

  const [rssi, setRssi] = useState<number>(priors.ranging.rssiDbm);
  const [pathLossExponent, setPathLossExponent] = useState<number>(priors.ranging.pathLossExponent);
  const [sigmaDb, setSigmaDb] = useState<number>(priors.ranging.sigmaDb);
  const ranging = useMemo(
    () => rssiRanging({
      txPowerDbm: priors.ranging.txPowerDbm,
      rssiDbm: rssi,
      pathLossExponent,
      sigmaDb,
      referenceDistanceM: priors.ranging.referenceDistanceM,
      referenceLossDb: priors.ranging.referenceLossDb,
    }),
    [rssi, pathLossExponent, sigmaDb],
  );
  const rangingChart = useMemo(() => {
    const points: Point[] = [];
    for (let i = 0; i <= 120; i += 1) {
      const d = (250 * i) / 120;
      points.push({ x: d, y: (Math.LN10 * sigmaDb * d) / (10 * pathLossExponent) });
    }
    return [{ points, color: '#e0846c', fill: 'rgba(224,132,108,.12)' }];
  }, [sigmaDb, pathLossExponent]);

  const [contacts, setContacts] = useState<number>(priors.epidemic.contactsPerDay);
  const [beta, setBeta] = useState<number>(priors.epidemic.beta);
  const [infectiousDays, setInfectiousDays] = useState<number>(priors.epidemic.infectiousDays);
  const seir = useMemo(
    () => seirRK45({
      population: priors.epidemic.population,
      contactsPerDay: contacts,
      beta,
      latencyDays: priors.epidemic.latencyDays,
      infectiousDays,
      days: priors.epidemic.days,
    }),
    [contacts, beta, infectiousDays],
  );
  const seirChart = useMemo(() => {
    const infectious = seir.series.map((point) => ({ x: point.day, y: point.infectious }));
    const exposed = seir.series.map((point) => ({ x: point.day, y: point.exposed }));
    return [
      { points: infectious, color: '#e0846c', fill: 'rgba(224,132,108,.18)' },
      { points: exposed, color: '#7ee8db', width: 1.4 },
    ];
  }, [seir]);

  const record = useCallback(
    (kind: 'success' | 'failure') => {
      setLedger((current) => recordObservation(current, {
        bearer: selected.id,
        successes: kind === 'success' ? 1 : 0,
        failures: kind === 'failure' ? 1 : 0,
      }));
    },
    [selected.id],
  );

  const onExport = useCallback(() => {
    const blob = new Blob([exportLedger(ledger)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `senda-inference-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [ledger]);

  const onReset = useCallback(() => {
    setLedger(emptyLedger());
    try {
      window.localStorage.removeItem(LEDGER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const observedTotal = ledger.observations.length;
  const recommendations = recommendation
    ? `${recommendation.id} · ${recommendation.sample.toFixed(4)}`
    : '—';

  return (
    <section id="precision-lab" className="pl-lab">
      <div className="pl-inner">
        <div className="pl-intro">
          <p className="pl-eyebrow">{w.eyebrow}</p>
          <h2>{w.title}</h2>
          <p className="pl-summary">{w.summary}</p>
        </div>

        <div className="pl-seal">
          <div>
            <h3>{w.integrityTitle}</h3>
            <p>{w.integrityBody}</p>
            <p className="pl-digest">
              {w.digest}: <code>{seal.digest || '…'}</code>
            </p>
          </div>
          <b className={`pl-badge pl-badge-${seal.status}`}>
            {seal.status === 'ok' ? w.verified : seal.status === 'fail' ? w.mismatch : w.checking}
          </b>
        </div>

        <div className="pl-grid">
          <article className="pl-card pl-wide">
            <div className="pl-card-head">
              <div>
                <h3>{w.posteriorTitle}</h3>
                <p>{w.posteriorBody}</p>
              </div>
              <div className="pl-ledger">
                <strong>{observedTotal}</strong>
                <span>{w.storedLocally}</span>
              </div>
            </div>
            <div className="pl-controls-row">
              <label className="pl-select">
                <span>{w.bearer}</span>
                <select value={selected.id} onChange={(event) => setBearerId(event.target.value)}>
                  {posteriors.map((row) => (
                    <option key={row.id} value={row.id}>{row.label}</option>
                  ))}
                </select>
              </label>
              <div className="pl-actions">
                <button type="button" onClick={() => record('success')} disabled={!hydrated}>{w.recordSuccess}</button>
                <button type="button" onClick={() => record('failure')} disabled={!hydrated}>{w.recordFailure}</button>
                <button type="button" onClick={onExport} disabled={observedTotal === 0}>{w.exportLedger}</button>
                <button type="button" onClick={onReset} disabled={observedTotal === 0}>{w.resetLedger}</button>
              </div>
            </div>
            <div className="pl-posterior-grid">
              <div>
                <Plot
                  series={posteriorChart}
                  markers={[selected.posterior.mean, ...selected.posterior.ci95]}
                  xDomain={[0, 1]}
                  yDomain={[0, Math.max(...posteriorChart[0].points.map((p) => p.y)) * 1.08]}
                  xUnit="success probability"
                  yUnit="density"
                  ariaLabel={`${w.posteriorTitle}: ${selected.label}`}
                  showMetrics
                />
              </div>
              <div className="pl-stat-grid">
                <Stat label={w.prior} value={`α ${selected.prior.alpha} · β ${selected.prior.beta}`} />
                <Stat label={w.observed} value={`${selected.successes} / ${selected.failures}`} />
                <Stat label={w.mean} value={selected.posterior.mean.toPrecision(4)} tone="good" />
                <Stat label={w.credible} value={`${selected.posterior.ci95[0].toFixed(3)} – ${selected.posterior.ci95[1].toFixed(3)}`} />
                <Stat label={w.predictive} value={pct(selected.posterior.predictive)} />
                <Stat label={w.recommendation} value={recommendations} />
              </div>
            </div>
            <p className="pl-note">{w.thompsonNote}</p>
          </article>

          <article className="pl-card">
            <h3>{w.erasureTitle}</h3>
            <p>{w.erasureBody}</p>
            <Plot
              series={erasureChart}
              markers={[perShard]}
              xDomain={[0.2, 0.99]}
              yDomain={[0, 1.02]}
              xUnit="shard success p"
              yUnit="P(reconstruct)"
              ariaLabel={w.erasureTitle}
            />
            <div className="pl-split">
              <div>
                <Slider label={w.labels.k} value={k} min={2} max={16} step={1} display={String(k)} onChange={(value) => {
                  setK(value);
                  setN((current) => Math.max(current, value));
                }} />
                <Slider label={w.labels.n} value={n} min={k} max={24} step={1} display={String(n)} onChange={setN} />
              </div>
              <div>
                <Slider label={w.labels.perShard} value={perShard} min={0.2} max={0.99} step={0.01} display={pct(perShard)} onChange={setPerShard} />
              </div>
            </div>
            <div className="pl-stat-grid">
              <Stat label={w.delivery} value={pct(erasure.probability)} tone={erasure.probability > 0.99 ? 'good' : 'warn'} />
              <Stat label={w.overhead} value={`${erasure.overhead.toFixed(2)}×`} />
              <Stat label={w.redundancy} value={pct(erasure.redundancy)} />
              <Stat label={w.shardsNeeded} value={String(erasure.shardsNeeded)} />
              <Stat label={w.shardsSent} value={String(erasure.shardsSent)} />
              <Stat label={w.expectedShards} value={fmtNumber(erasure.expectedReceived, 2)} />
            </div>
          </article>

          <article className="pl-card">
            <h3>{w.dtnTitle}</h3>
            <p>{w.dtnBody}</p>
            <Plot
              series={dtnChart}
              markers={[horizon]}
              xDomain={[0, Math.max(48, horizon * 1.5)]}
              yDomain={[0, 1.02]}
              xUnit="hours"
              yUnit="P(delivered)"
              ariaLabel={w.dtnTitle}
            />
            <div className="pl-split">
              <div>
                <Slider label={w.labels.contactRate} value={contactRate} min={0.02} max={1} step={0.01} display={contactRate.toFixed(2)} onChange={setContactRate} />
                <Slider label={w.labels.copies} value={copies} min={1} max={6} step={1} display={String(copies)} onChange={setCopies} />
              </div>
              <div>
                <Slider label={w.labels.horizon} value={horizon} min={0} max={48} step={1} display={String(horizon)} onChange={setHorizon} />
              </div>
            </div>
            <div className="pl-stat-grid">
              <Stat label={w.byDeadline} value={pct(dtn.probability)} tone={dtn.probability > 0.95 ? 'good' : 'warn'} />
              <Stat label={w.expectedDelay} value={`${dtn.expectedDelayHours.toFixed(2)} h`} />
              <Stat label={w.medianDelay} value={`${dtn.p50.toFixed(2)} h`} />
              <Stat label={w.tail90} value={`${dtn.p90.toFixed(2)} h`} />
              <Stat label={w.copyCost} value={`${dtn.copyCost}×`} />
              <Stat label="λ·copies" value={`${dtn.ratePerHour.toFixed(2)} /h`} />
            </div>
          </article>

          <article className="pl-card">
            <h3>{w.rangingTitle}</h3>
            <p>{w.rangingBody}</p>
            <Plot
              series={rangingChart}
              markers={[Math.min(250, ranging.distanceM)]}
              xDomain={[0, 250]}
              xUnit="metres"
              yUnit="1σ range error (m)"
              ariaLabel={w.rangingTitle}
            />
            <div className="pl-split">
              <div>
                <Slider label={w.labels.rssi} value={rssi} min={-110} max={-40} step={1} display={`${rssi} dBm`} onChange={setRssi} />
                <Slider label={w.labels.sigmaDb} value={sigmaDb} min={2} max={12} step={0.5} display={`${sigmaDb.toFixed(1)} dB`} onChange={setSigmaDb} />
              </div>
              <div>
                <Slider label={w.labels.pathLoss} value={pathLossExponent} min={2} max={4} step={0.1} display={pathLossExponent.toFixed(1)} onChange={setPathLossExponent} />
              </div>
            </div>
            <div className="pl-stat-grid">
              <Stat label={w.distance} value={`${fmtNumber(ranging.distanceM)} m`} tone="good" />
              <Stat label={w.sigma} value={`± ${fmtNumber(ranging.sigmaM)} m`} />
              <Stat label={w.relative} value={pct(ranging.relativeSigma)} tone={ranging.relativeSigma < 0.3 ? 'good' : 'warn'} />
              <Stat label={w.variance} value={`${fmtNumber(ranging.varianceM2)} m²`} />
              <Stat label="PL" value={`${fmtNumber(ranging.pathLossDb)} dB`} />
              <Stat label="d₀" value={`${priors.ranging.referenceDistanceM} m`} />
            </div>
          </article>

          <article className="pl-card pl-wide">
            <h3>{w.seirTitle}</h3>
            <p>{w.seirBody}</p>
            <div className="pl-seir-grid">
              <div>
                <Plot
                  series={seirChart}
                  xDomain={[0, priors.epidemic.days]}
                  xUnit={w.days}
                  yUnit="people"
                  ariaLabel={w.seirTitle}
                  height={220}
                />
                <span className="pl-legend"><i className="pl-dot-i" />infectious <i className="pl-dot-e" />exposed</span>
              </div>
              <div>
                <div className="pl-stat-grid">
                  <Stat label={w.r0} value={seir.r0.toFixed(2)} tone={seir.r0 > 1 ? 'warn' : 'good'} />
                  <Stat label={w.peak} value={fmtNumber(seir.peakInfectious, 1)} />
                  <Stat label={w.peakDay} value={`${seir.peakDay} ${w.days}`} />
                  <Stat label={w.attack} value={pct(seir.attackRate)} />
                  <Stat label={w.steps} value={seir.steps.toLocaleString(numberLocale)} />
                  <Stat label={w.massError} value={seir.maxConservationError < 1e-9 ? '< 1e-9' : seir.maxConservationError.toExponential(1)} tone="good" />
                </div>
                <p className="pl-note">
                  {w.tolerances}: rtol {seir.tolerances.rtol.toExponential(0)} · atol {seir.tolerances.atol.toExponential(0)} · DP5(4)
                </p>
                <Slider label={w.labels.contacts} value={contacts} min={2} max={16} step={1} display={String(contacts)} onChange={setContacts} />
                <Slider label={w.labels.beta} value={beta} min={0.05} max={0.5} step={0.01} display={beta.toFixed(2)} onChange={setBeta} />
                <Slider label={w.labels.infectiousDays} value={infectiousDays} min={2} max={10} step={0.5} display={infectiousDays.toFixed(1)} onChange={setInfectiousDays} />
                <p className="pl-note">{w.labels.latencyDays}: {priors.epidemic.latencyDays} · {w.labels.population}: {priors.epidemic.population}</p>
              </div>
            </div>
          </article>
        </div>

        <div className="pl-ledger-bar">
          <div>
            <h3>{w.ledgerTitle}</h3>
            <p>{w.ledgerBody}</p>
          </div>
          <div className="pl-ledger-stats">
            <span>{observedTotal} {w.storedLocally}</span>
            <span>
              {Object.entries(totals).map(([id, tally]) => `${id}: ${tally.successes}/${tally.failures}`).join(' · ') || '—'}
            </span>
          </div>
        </div>

        <p className="pl-offline">{w.offlineNote}</p>
        <p className="pl-disclaimer">{w.disclaimer}</p>
      </div>
    </section>
  );
}
