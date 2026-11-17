/**
 * SENDA RoadSafe · Simulador contrafactual del caso de investigación (anonimizado).
 *
 * Cadena: furgoneta inmovilizada en arcén → baliza V16 activada → asistencia solicitada → el taxi se
 * aproxima y frena para detenerse tras la furgoneta → el vehículo posterior no reacciona a tiempo →
 * alcance contra el taxi → el taxi es desplazado contra la furgoneta.
 *
 * NO se conocen velocidades, distancias, tiempos, visibilidad ni equipamiento del caso real. Todos los
 * parámetros se declaran con su procedencia (PARAM_PROVENANCE) y se barren en rangos. Ningún
 * resultado de este simulador es una medida de eficacia real; es un banco de hipótesis.
 *
 * Modelo (1D longitudinal, paso fijo):
 *  - x=0 furgoneta (arcén). Taxi parte de x0_T<0 a v_T, empieza a frenar con a_T para detenerse a
 *    `gapTaxiVan` m detrás de la furgoneta; se asume que el taxi queda (parcialmente) en la trayectoria
 *    del seguidor (`taxiInPath`, HIPÓTESIS del caso: el seguidor impactó al taxi).
 *  - Seguidor a distancia temporal h del taxi, misma velocidad inicial. Percibe la frenada del taxi
 *    cuando (a) el taxi ya frena y (b) está dentro de su visibilidad `sightM`; reacciona tras t_r.
 *    Con aviso digital aceptado ANTES de la frenada del taxi: reacción «esperada» y reducción de velocidad.
 *    Con aviso tardío (dentro de la ventana de distracción): retraso adicional (HIPÓTESIS).
 *  - Impacto: colisión 1D con coeficiente de restitución e; el taxi (frenado al ηₜ·μ·g) se desplaza
 *    d = v'²/(2a); si d > gapTaxiVan hay segundo impacto contra la furgoneta.
 */
import { rng, normal, lognormal, uniform, G, wilson } from './roadsafe-secondary-risk.mjs';

/** Procedencia de cada parámetro: MEASURED (ninguno disponible del caso) | LITERATURE_RANGE | HYPOTHETICAL | UNKNOWN_SWEPT. */
export const PARAM_PROVENANCE = Object.freeze({
  speedKmh: { value: [80, 100], provenance: 'UNKNOWN_SWEPT', note: 'Velocidades del caso desconocidas; se barre 70–120 km/h.' },
  headwayS: { value: [0.8, 2.0], provenance: 'HYPOTHETICAL', note: 'Distancia temporal seguidor-taxi; la DGT recomienda ≥2 s; se supone parte del tráfico por debajo.' },
  reactUnexpectedS: { value: [1.25, 0.35], provenance: 'LITERATURE_RANGE', note: 'Mediana ≈1,25 s ante evento inesperado (Green, 2000, Transportation Human Factors 2(3)); σ log supuesta.' },
  reactExpectedS: { value: [0.75, 0.3], provenance: 'LITERATURE_RANGE', note: 'Mediana ≈0,7–0,75 s cuando el conductor está prevenido (Green, 2000).' },
  mu: { value: [0.7, 0.85], provenance: 'LITERATURE_RANGE', note: 'Adherencia típica asfalto seco; mojado 0,4–0,55. Requiere medida local.' },
  brakeEff: { value: [0.85, 0.95], provenance: 'HYPOTHETICAL', note: 'Fracción de μ·g alcanzada en frenada de emergencia con ABS.' },
  taxiDecelMs2: { value: [3, 5], provenance: 'HYPOTHETICAL', note: 'Frenada de servicio del taxi para detenerse tras la furgoneta.' },
  gapTaxiVanM: { value: [3, 10], provenance: 'HYPOTHETICAL', note: 'Hueco entre taxi detenido y furgoneta.' },
  sightM: { value: 250, provenance: 'UNKNOWN_SWEPT', note: 'Visibilidad efectiva (curva, noche, niebla) desconocida; se barre 60–400 m.' },
  restitution: { value: 0.1, provenance: 'HYPOTHETICAL', note: 'Coeficiente de restitución en alcances a baja-media velocidad.' },
  massKg: { value: { taxi: 1600, follower: 1500 }, provenance: 'HYPOTHETICAL', note: 'Masas típicas de turismo.' },
  taxiPostBrake: { value: 0.6, provenance: 'HYPOTHETICAL', note: 'Fracción de μ·g que frena el taxi tras ser golpeado (pie en freno/inercia).' },
  channelLatencyS: { value: null, provenance: 'UNKNOWN_SWEPT', note: 'Latencia V16→DGT 3.0→navegador no publicada; se barre.' },
  connectedShare: { value: null, provenance: 'UNKNOWN_SWEPT', note: 'Fracción de conductores cuyo navegador muestra eventos DGT 3.0: desconocida.' },
  acceptance: { value: [0.5, 0.9], provenance: 'HYPOTHETICAL', note: 'Probabilidad de que el conductor atienda y actúe sobre el aviso.' },
  speedReduction: { value: [0.0, 0.15], provenance: 'HYPOTHETICAL', note: 'Reducción de velocidad tras aviso aceptado.' },
  lateWarningPenaltyS: { value: [0.3, 0.8], provenance: 'HYPOTHETICAL', note: 'Retraso por distracción si el aviso llega dentro de la ventana crítica.' },
  assistArrivalS: { value: [300, 2400], provenance: 'UNKNOWN_SWEPT', note: 'Tiempo entre la activación de la V16 y la llegada/frenada del taxi: desconocido.' },
  displayRangeM: { value: 1500, provenance: 'HYPOTHETICAL', note: 'Distancia a la que un navegador/app muestra un peligro por delante; depende de cada producto.' },
});

/**
 * Escenarios contrafactuales A–E. Cada canal: { share, latency:[median,σlog], pDeliver, falseAlarmRate }.
 * Los valores de canal son HIPÓTESIS para barrer, no medidas.
 */
export const SCENARIOS = Object.freeze({
  A_NO_DIGITAL: { label: 'A · Sin alertas digitales', channels: [] },
  B_V16_INFORMATIVE: { label: 'B · V16 informativa (sin asumir entrega al conductor)', channels: [], v16DataSent: true },
  C_AUTHORIZED_ROAD_CHANNEL: { label: 'C · Canal vial autorizado con latencia modelada', channels: [{ id: 'DGT30_NAVIGATOR', share: 0.3, latency: [60, 0.8], pDeliver: 0.95 }] },
  D_SENDA_VERIFIED: { label: 'D · SENDA con aviso anticipado y fuentes verificadas', channels: [{ id: 'DGT30_NAVIGATOR', share: 0.3, latency: [60, 0.8], pDeliver: 0.95 }, { id: 'SENDA_APP', share: 0.1, latency: [8, 0.6], pDeliver: 0.9 }], policy: true },
  E_SENDA_DEGRADED: { label: 'E · SENDA con fallos de red, datos erróneos y baja adopción', channels: [{ id: 'DGT30_NAVIGATOR', share: 0.3, latency: [180, 1.0], pDeliver: 0.7 }, { id: 'SENDA_APP', share: 0.01, latency: [30, 1.0], pDeliver: 0.6 }], policy: true, positionErrorRate: 0.15, falseAlarmRate: 0.05 },
});

/** Una realización del caso. Devuelve qué pasó y por qué. */
export function simulateOnce(p, r) {
  const v0 = p.speedKmh / 3.6;
  const aT = p.taxiDecelMs2, gap = p.gapTaxiVanM;
  // Taxi: se detiene en x = -gap; empieza a frenar a d = v²/2a antes.
  const xTaxiStop = -gap, dBrakeT = v0 * v0 / (2 * aT), tBrakeStart = 0; // t=0 inicio de frenada del taxi
  const xTaxi0 = xTaxiStop - dBrakeT;
  const taxiPos = (t) => (t <= 0 ? xTaxi0 + v0 * t : t >= v0 / aT ? xTaxiStop : xTaxi0 + v0 * t - 0.5 * aT * t * t);
  const taxiVel = (t) => (t <= 0 ? v0 : Math.max(0, v0 - aT * t));
  // Seguidor: a h segundos detrás, misma velocidad. Aviso: `warn` = { acceptedAtS (relativo a t=0), late }.
  let vF = v0 * (1 - (p.warned && p.warnLeadS > 0 ? p.speedReduction : 0));
  let xF = xTaxi0 - p.headwayS * v0 - 4.5; // 4,5 m de longitud del taxi
  const aF = p.brakeEff * p.mu * G;
  const tr = p.warned && p.warnLeadS > 0 ? Math.min(p.reactUnexpectedS, p.reactExpectedS) : p.reactUnexpectedS + (p.lateWarning ? p.lateWarningPenaltyS : 0);
  // Percepción: el taxi ya frena (t ≥ 0) y está a ≤ sightM; o el peligro estático (taxi/furgoneta) entra en visibilidad.
  let tPerceive = null, tBrakeF = null, dt = 0.01, t = -Math.max(0, (p.preRollS ?? 0)), impact = null;
  const horizon = 40;
  while (t < horizon) {
    const gapF = taxiPos(t) - 4.5 - xF; // distancia parachoques
    if (tPerceive == null && t >= tBrakeStart && gapF <= p.sightM) tPerceive = t;
    if (tPerceive != null && tBrakeF == null && t >= tPerceive + tr) tBrakeF = t;
    if (gapF <= 0) { impact = { t, vF, vT: taxiVel(t) }; break; }
    if (tBrakeF != null) vF = Math.max(0, vF - aF * dt);
    xF += vF * dt;
    if (vF === 0 && tBrakeF != null) break;
    t += dt;
  }
  if (!impact) return { collision: false, secondary: false, impactKmh: 0, taxiPushKmh: 0, tr, tPerceive };
  // Colisión 1D con restitución e: seguidor (m1,u1) contra taxi (m2,u2).
  const m1 = p.massKg.follower, m2 = p.massKg.taxi, e = p.restitution, u1 = impact.vF, u2 = impact.vT;
  const v2 = (m1 * u1 + m2 * u2 + m1 * e * (u1 - u2)) / (m1 + m2);
  const aPush = p.taxiPostBrake * p.mu * G, push = v2 * v2 / (2 * aPush);
  const taxiAt = taxiPos(impact.t), distToVan = 0 - taxiAt; // del frontal del taxi a la furgoneta
  const secondary = push > distToVan;
  const vSec = secondary ? Math.sqrt(Math.max(0, v2 * v2 - 2 * aPush * distToVan)) : 0;
  return { collision: true, secondary, impactKmh: +((u1 - u2) * 3.6).toFixed(1), taxiPushKmh: +(v2 * 3.6).toFixed(1), secondaryKmh: +(vSec * 3.6).toFixed(1), tr, tPerceive };
}

/** Muestra parámetros de una realización según los rangos declarados y overrides. */
export function sampleParams(r, ov = {}) {
  const P = PARAM_PROVENANCE, pick = (k, def) => (ov[k] !== undefined ? ov[k] : def);
  const out = {
    speedKmh: pick('speedKmh', uniform(r, ...P.speedKmh.value)),
    headwayS: pick('headwayS', uniform(r, ...P.headwayS.value)),
    reactUnexpectedS: lognormal(r, ...(ov.reactUnexpected ?? P.reactUnexpectedS.value)),
    reactExpectedS: ov.placebo ? null : lognormal(r, ...P.reactExpectedS.value),
    mu: pick('mu', uniform(r, ...P.mu.value)),
    brakeEff: uniform(r, ...P.brakeEff.value),
    taxiDecelMs2: uniform(r, ...P.taxiDecelMs2.value),
    gapTaxiVanM: pick('gapTaxiVanM', uniform(r, ...P.gapTaxiVanM.value)),
    sightM: pick('sightM', P.sightM.value),
    restitution: P.restitution.value, massKg: P.massKg.value, taxiPostBrake: P.taxiPostBrake.value,
    speedReduction: uniform(r, ...(ov.speedReductionRange ?? P.speedReduction.value)),
    lateWarningPenaltyS: uniform(r, ...P.lateWarningPenaltyS.value),
    acceptance: uniform(r, ...(ov.acceptanceRange ?? P.acceptance.value)),
  };
  // Placebo (control negativo): el aviso no puede cambiar ni la reacción ni la velocidad.
  if (ov.placebo) { out.reactExpectedS = out.reactUnexpectedS; out.speedReduction = 0; out.lateWarningPenaltyS = 0; }
  return out;
}

/**
 * Experimento pareado (números aleatorios comunes): misma realización física en A–E.
 * Línea temporal: la V16 se activa en t=0; el evento llega al canal tras su latencia; el taxi frena en
 * t = assistArrivalS (desconocido, se muestrea). El seguidor ve el peligro en su pantalla cuando está a
 * `displayRangeM` del lugar SI el evento ya llegó: antelación = min(displayRange/v, assistArrival − latencia).
 * Antelación ≥ `minLeadS` ⇒ útil; en (−tMin, minLead) ⇒ tardía (posible distracción: D/E la suprimen).
 */
export function runExperiment({ n = 3000, seed = 2026, overrides = {}, scenarios = Object.keys(SCENARIOS), assistArrivalS = null, minLeadS = 5, tMinS = 4, displayRangeM = PARAM_PROVENANCE.displayRangeM.value } = {}) {
  const out = {};
  for (const key of scenarios) out[key] = { label: SCENARIOS[key].label, collisions: 0, secondary: 0, impacts: [], leads: [], latencies: [], covered: 0, delivered: 0, falseAlarms: 0, lateSuppressed: 0, lateShown: 0, messages: 0 };
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const base = sampleParams(r, overrides);
    const uChan = Array.from({ length: 4 }, () => [r(), r(), r(), normal(r)]), uAcc = r(), uPos = r(), uFA = r();
    const tArr = assistArrivalS ?? uniform(r, ...PARAM_PROVENANCE.assistArrivalS.value), displayLeadS = displayRangeM / (base.speedKmh / 3.6);
    for (const key of scenarios) {
      const S = SCENARIOS[key], o = out[key];
      let warned = false, lead = null, late = false;
      S.channels.forEach((ch, ci) => {
        const [uShare, uDel] = uChan[ci], z = uChan[ci][3];
        const share = overrides.shareOverride?.[ch.id] ?? ch.share;
        if (uShare >= share) return;
        o.messages++;
        if (uDel >= (overrides.pDeliverOverride?.[ch.id] ?? ch.pDeliver)) return;
        const lat = (overrides.latencyOverride?.[ch.id] ?? ch.latency[0]) * Math.exp(ch.latency[1] * z);
        o.latencies.push(lat); o.delivered++;
        const thisLead = Math.min(displayLeadS, tArr - lat); // antelación respecto a la frenada del taxi
        if (lead == null || thisLead > lead) lead = thisLead;
      });
      if (lead != null) {
        const posWrong = S.positionErrorRate ? uPos < S.positionErrorRate : false;
        if (posWrong) { lead = null; } // aviso ubicado en otro punto/calzada: no ayuda a este conductor
        else if (lead >= minLeadS) { if (uAcc < base.acceptance) { warned = true; o.covered++; o.leads.push(lead); } }
        else if (lead > -tMinS) { if (S.policy) o.lateSuppressed++; else { late = uAcc < base.acceptance; if (late) o.lateShown++; } }
      }
      if (S.falseAlarmRate && uFA < S.falseAlarmRate) o.falseAlarms++;
      const res = simulateOnce({ ...base, warned, warnLeadS: lead ?? 0, lateWarning: late }, r);
      if (res.collision) { o.collisions++; o.impacts.push(res.impactKmh); }
      if (res.secondary) o.secondary++;
    }
  }
  const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
  const summary = {};
  for (const [k, o] of Object.entries(out)) summary[k] = {
    label: o.label, n, pCollision: +(o.collisions / n).toFixed(4), ciCollision: wilson(o.collisions, n), pSecondaryImpact: +(o.secondary / n).toFixed(4), ciSecondary: wilson(o.secondary, n),
    impactKmhP50: q(o.impacts, 0.5), impactKmhP95: q(o.impacts, 0.95), latencyP50: q(o.latencies, 0.5), latencyP95: q(o.latencies, 0.95),
    usefulLeadP50: q(o.leads, 0.5), effectiveCoverage: +(o.covered / n).toFixed(4), deliveredToDevice: +(o.delivered / n).toFixed(4),
    confirmedDisplayAck: 0, // ningún canal modelado devuelve acuse de visualización: no se afirma entrega confirmada
    falseAlarmRate: +(o.falseAlarms / n).toFixed(4), lateWarningsSuppressed: o.lateSuppressed, lateWarningsShown: o.lateShown, messagesPerCase: +(o.messages / n).toFixed(3),
  };
  return { schema: 'senda-roadsafe-accident-experiment/1', seed, n, assistArrivalS: assistArrivalS ?? PARAM_PROVENANCE.assistArrivalS.value, displayRangeM, minLeadS, tMinS, overrides, summary, disclaimer: 'Resultados de simulación con parámetros declarados (PARAM_PROVENANCE). No demuestran reducción real de accidentes.' };
}
