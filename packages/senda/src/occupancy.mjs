/**
 * SENDA · Motor determinista de fusión de evidencias: ¿en qué vivienda es probable que haya
 * una persona sin localizar como «a salvo»? La PRIORIDAD de rescate pondera esa probabilidad
 * por el riesgo de la zona (daño EMS-98 de la planta, humo, agua…).
 *
 * No «ve» a través de las paredes. Combina, con reglas de Bayes explícitas y auditables,
 * todo lo que sí se puede medir alrededor de una persona:
 *   - RESPONSE   su propia respuesta a una alerta («estoy atrapado en la planta 3 B»);
 *   - PHONE_RF   la posición de SU teléfono (baliza BLE trilaterada, Wi-Fi RTT, barómetro);
 *   - BODY_RF    el cuerpo detectado por radio sin teléfono (Wi-Fi CSI, `through-wall.mjs`);
 *   - ACOUSTIC   golpes o voz captados por los micrófonos de los equipos de rescate;
 *   - THERMAL    un punto caliente de una cámara térmica real (ve a través del humo, no de muros);
 *   - SEARCH     una búsqueda sin hallazgo (la ausencia de detección también es evidencia).
 *
 * Modelo (dos niveles, para no contar dos veces la misma señal):
 *  1. Por PERSONA registrada: una distribución sobre viviendas del edificio + «fuera».
 *     Prior: en casa con `pHome`. Si su teléfono emite y no responde, se mezcla: con
 *     probabilidad ρ (`phoneWithOwner`) la persona está junto a su teléfono. Una respuesta
 *     «a salvo» o «fuera» la retira del cálculo; «atrapado» la sitúa donde dice.
 *  2. Por CELDA (vivienda): P(al menos una persona que necesita rescate) =
 *     1 − (1 − u)·Π(1 − Lᵢ(celda)), con u = ocupantes no registrados (adopción < 100 %).
 *     Las detecciones sin identidad (CSI, sonido, térmica, búsqueda negativa) multiplican
 *     las odds por su razón de verosimilitud LR = Pd/Pfa (o (1−Pd)/(1−Pfa) si no detectan),
 *     ponderada por la cobertura geométrica del sensor sobre la celda.
 *
 * Honestidad numérica:
 *  - Cada parámetro tiene un valor central y un rango [bajo, alto]. El motor recalcula con
 *    las esquinas del rango y publica el INTERVALO [lo, hi] junto al valor central.
 *  - «≥ 98 %» solo se muestra si el límite INFERIOR supera 0,98 y lo sostienen al menos dos
 *    FAMILIAS de evidencia independientes. Una sola fuente nunca basta (las señales de un
 *    mismo teléfono están correlacionadas y Bayes ingenuo las sobrestimaría).
 *  - Los parámetros por defecto son HIPÓTESIS documentadas hasta la calibración de campo.
 *  - Nadie se declara víctima: el resultado es una prioridad de búsqueda, no un diagnóstico.
 */
import { FLOOR_HEIGHT_M } from './building-twin.mjs';

export const EVIDENCE_FAMILIES = Object.freeze({
  RESPONSE: 'Respuesta de la persona',
  PHONE_RF: 'Señal de su teléfono (BLE · Wi-Fi RTT · barómetro)',
  BODY_RF: 'Cuerpo detectado por radio (Wi-Fi CSI)',
  ACOUSTIC: 'Sonido (golpes o voz)',
  THERMAL: 'Cámara térmica real',
  SEARCH: 'Búsqueda sin hallazgo',
});

/** [central, mínimo, máximo]. Todos son hipótesis hasta calibrar con pilotos (ver docs/architecture/MOTOR_FUSION_EVIDENCIAS.md). */
export const DEFAULT_PARAMS = Object.freeze({
  pHome: [0.75, 0.6, 0.9],
  phoneWithOwner: [0.7, 0.45, 0.9],
  unregisteredPerCell: [0.2, 0.08, 0.35],
  responseReliability: [0.97, 0.9, 0.995],
  sensors: Object.freeze({
    BODY_RF: { pd: [0.8, 0.6, 0.9], pfa: [0.05, 0.02, 0.1] },
    ACOUSTIC: { pd: [0.6, 0.4, 0.8], pfa: [0.08, 0.04, 0.15] },
    THERMAL: { pd: [0.85, 0.7, 0.95], pfa: [0.05, 0.02, 0.1] },
    SEARCH: { pd: [0.7, 0.5, 0.85], pfa: [0.02, 0.01, 0.05] },
  }),
  baroSigmaM: 3,
});

const UNIT_XY = Object.freeze({ A: [-1, 1], B: [1, 1], C: [-1, -1], D: [1, -1] });
const clamp01 = (x) => Math.min(1 - 1e-9, Math.max(1e-9, x));
const odds = (p) => clamp01(p) / (1 - clamp01(p));
const fromOdds = (o) => o / (1 + o);

/** Celdas (viviendas) de un edificio preparado: cuadrantes A=NO, B=NE, C=SO, D=SE como `unitOf`. */
export function cellsFromBuilding(building) {
  const { minX, maxX, minY, maxY } = building.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const hx = (maxX - minX) / 4, hy = (maxY - minY) / 4;
  const units = building.unitsPerFloor > 1 ? ['A', 'B', 'C', 'D'] : ['A'];
  const cells = [];
  for (let f = 0; f < building.levels; f++) for (const u of units) {
    const [sx, sy] = units.length > 1 ? UNIT_XY[u] : [0, 0];
    cells.push({ id: `${f}${u}`, floor: f, unit: u, center: { x: cx + sx * hx, y: cy + sy * hy, z: f * FLOOR_HEIGHT_M + 1.2 }, halfM: Math.max(hx, hy) });
  }
  return cells;
}

/** Peso de cobertura de un sensor sobre una celda: 1 dentro de 0,6·r, 0 más allá de 1,2·r. */
export function coverage(at, radiusM, cell) {
  const d = Math.hypot(cell.center.x - at.x, cell.center.y - at.y, cell.center.z - at.z);
  return Math.max(0, Math.min(1, (1.2 * radiusM - d) / (0.6 * radiusM)));
}

/** Distribución de la posición de un teléfono sobre las celdas (gaussiana anisótropa; el barómetro afina la altura). */
function phoneDistribution(fix, cells, baroSigmaM) {
  const sxy = Math.max(1, fix.errorM ?? 3), sz = fix.baroZ != null ? baroSigmaM : Math.max(1.5, fix.errorM ?? 3);
  const z = fix.baroZ ?? fix.z;
  const w = cells.map((c) => Math.exp(-((c.center.x - fix.x) ** 2 + (c.center.y - fix.y) ** 2) / (2 * sxy * sxy) - ((c.center.z - z) ** 2) / (2 * sz * sz)));
  const s = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / s);
}

/** Pd/Pfa de una evidencia: [central, mínimo, máximo] (valores propios de la evidencia si los trae). */
function sensorRange(e, params) {
  const fam = params.sensors[e.family];
  const r = (own, arr) => (own != null ? [own, own, own] : arr);
  return { pd: r(e.pd, fam.pd), pfa: r(e.pfa, fam.pfa) };
}
/** Elección de Pd/Pfa que da la cota inferior/superior (la posterior crece con Pd si detecta y con Pfa si no). */
function pickSensor(rg, detected, mode) {
  if (mode === 'mid') return { pd: rg.pd[0], pfa: rg.pfa[0] };
  const up = (mode === 'hi') === detected;
  return { pd: up ? rg.pd[2] : rg.pd[1], pfa: up ? rg.pfa[1] : rg.pfa[2] };
}

/**
 * Un cálculo con un juego concreto de parámetros escalares y de sensores.
 * Sensores: modelo «OR ruidoso» P(detecta) = 1 − (1−Pfa)·Π(1 − Pd·wⱼ·ocupadaⱼ) sobre las
 * celdas cubiertas; para cada celda se usa la verosimilitud MARGINAL (las vecinas con su
 * probabilidad actual), así una detección compartida por varias celdas no se cuenta varias veces.
 */
function evaluate(cells, persons, cellEvidence, p, sensorPick, record = null) {
  const idx = new Map(cells.map((c, i) => [c.id, i]));
  const L = [];
  for (const per of persons) {
    if (per.status === 'SAFE' || per.status === 'AWAY') { L.push(null); continue; }
    const prior = new Array(cells.length).fill(0);
    if (idx.has(per.homeCell)) prior[idx.get(per.homeCell)] = p.pHome;
    let dist = prior;
    if ((per.status === 'TRAPPED' || per.status === 'NEED_HELP') && idx.has(per.reportedCell ?? per.homeCell)) {
      const at = idx.get(per.reportedCell ?? per.homeCell);
      dist = prior.map((x, i) => (1 - p.responseReliability) * x + (i === at ? p.responseReliability : 0));
    } else if (per.phoneFix) {
      const g = phoneDistribution(per.phoneFix, cells, p.baroSigmaM);
      dist = prior.map((x, i) => p.phoneWithOwner * g[i] + (1 - p.phoneWithOwner) * x);
    }
    L.push(dist);
  }
  const P = cells.map((c, i) => { let none = 1 - p.unregisteredPerCell; for (const d of L) if (d) none *= 1 - d[i]; return 1 - none; });
  cellEvidence.forEach((e, k) => {
    const { pd, pfa } = sensorPick(e, k);
    const w = cells.map((c) => coverage(e.at, e.radiusM, c));
    const factor = w.map((wj, j) => 1 - pd * wj * P[j]);
    const all = factor.reduce((a, b) => a * b, 1);
    const upd = P.map((pc, c) => {
      if (w[c] <= 0) return pc;
      const rest = all / Math.max(1e-12, factor[c]);
      const d1 = 1 - (1 - pfa) * (1 - pd * w[c]) * rest, d0 = 1 - (1 - pfa) * rest;
      const lr = e.detected ? d1 / Math.max(1e-12, d0) : (1 - d1) / Math.max(1e-12, 1 - d0);
      if (record) record.push({ k, c, lr });
      return fromOdds(odds(pc) * lr);
    });
    for (let c = 0; c < P.length; c++) P[c] = upd[c];
  });
  return P;
}

const corners = (ranges) => ranges.reduce((acc, [k, r]) => acc.flatMap((a) => [{ ...a, [k]: r[1] }, { ...a, [k]: r[2] }]), [{}]);

/**
 * Fusiona todas las evidencias de un edificio.
 * @param {object} input
 * @param {Array} input.cells        de `cellsFromBuilding`
 * @param {Array} input.persons      [{id, homeCell, status?: 'SAFE'|'AWAY'|'TRAPPED'|'NEED_HELP', reportedCell?, phoneFix?: {x,y,z,errorM,baroZ?}}]
 * @param {Array} input.cellEvidence [{family:'BODY_RF'|'ACOUSTIC'|'THERMAL'|'SEARCH', at:{x,y,z}, radiusM, detected:boolean, pd?, pfa?, label?}]
 * @param {Object<string,number>} [input.cellRisk] riesgo 0–1 por celda (p. ej. daño EMS-98 de la planta); prioridad = P(presencia)·riesgo
 */
export function fuseOccupancy({ cells, persons = [], cellEvidence = [], cellRisk = null }, paramsIn = {}) {
  const params = { ...DEFAULT_PARAMS, ...paramsIn, sensors: { ...DEFAULT_PARAMS.sensors, ...(paramsIn.sensors ?? {}) } };
  const scalarKeys = ['pHome', 'phoneWithOwner', 'unregisteredPerCell', 'responseReliability'];
  const mid = Object.fromEntries(scalarKeys.map((k) => [k, params[k][0]])); mid.baroSigmaM = params.baroSigmaM;
  const ranges = cellEvidence.map((e) => sensorRange(e, params));
  const lrLog = [];
  const pMid = evaluate(cells, persons, cellEvidence, mid, (e, k) => pickSensor(ranges[k], e.detected, 'mid'), lrLog);
  let pLo = pMid.slice(), pHi = pMid.slice();
  for (const corner of corners(scalarKeys.map((k) => [k, params[k]]))) {
    const pc = { ...corner, baroSigmaM: params.baroSigmaM };
    const lo = evaluate(cells, persons, cellEvidence, pc, (e, k) => pickSensor(ranges[k], e.detected, 'lo'));
    const hi = evaluate(cells, persons, cellEvidence, pc, (e, k) => pickSensor(ranges[k], e.detected, 'hi'));
    pLo = pLo.map((x, i) => Math.min(x, lo[i])); pHi = pHi.map((x, i) => Math.max(x, hi[i]));
  }

  // Traza explicable por celda y familias que la sostienen.
  const out = cells.map((c, i) => {
    const trace = [], families = new Set();
    for (const per of persons) {
      if (per.status === 'SAFE' || per.status === 'AWAY') continue;
      if ((per.status === 'TRAPPED' || per.status === 'NEED_HELP') && (per.reportedCell ?? per.homeCell) === c.id) {
        families.add('RESPONSE'); trace.push({ family: 'RESPONSE', text: `${per.id} respondió «${per.status === 'TRAPPED' ? 'atrapado' : 'necesito ayuda'}» en ${c.id}` });
      } else if (per.phoneFix && !per.status) {
        const g = phoneDistribution(per.phoneFix, cells, params.baroSigmaM)[i];
        if (g >= 0.25) { families.add('PHONE_RF'); trace.push({ family: 'PHONE_RF', text: `Teléfono de ${per.id} sin respuesta: ${Math.round(g * 100)} % de su señal cae aquí${per.phoneFix.baroZ != null ? ' (altura por barómetro)' : ''}` }); }
      } else if (!per.status && per.homeCell === c.id) trace.push({ family: 'PRIOR', text: `${per.id} vive aquí y no ha respondido (en casa ≈ ${Math.round(mid.pHome * 100)} %)` });
    }
    cellEvidence.forEach((e, k) => {
      const w = coverage(e.at, e.radiusM, c); if (w < 0.05) return;
      const lr = lrLog.find((r) => r.k === k && r.c === i)?.lr ?? 1;
      const db = 10 * Math.log10(lr) || 0;
      if (e.detected && w >= 0.5) families.add(e.family);
      trace.push({ family: e.family, text: `${e.label ?? EVIDENCE_FAMILIES[e.family]} · ${e.detected ? 'detecta' : 'no detecta'} · cobertura ${Math.round(w * 100)} %`, db: Math.round(db * 10) / 10 });
    });
    const p = pMid[i], lo = pLo[i], hi = pHi[i];
    const confirmed = families.has('RESPONSE');
    const cls = confirmed ? 'CONFIRMADO_POR_RESPUESTA' : lo >= 0.9 ? 'MUY_PROBABLE' : p >= 0.6 ? 'PROBABLE' : p >= 0.25 ? 'POSIBLE' : 'IMPROBABLE';
    const risk = cellRisk ? (cellRisk[c.id] ?? 0) : 1;
    return { ...c, p, lo, hi, cls, risk, priority: p * risk, families: [...families], corroborated: families.size, badge98: lo >= 0.98 && families.size >= 2, trace };
  });
  const ranked = [...out].sort((a, b) => b.priority - a.priority || b.p - a.p || b.lo - a.lo);
  return {
    cells: out, ranked,
    summary: {
      cells: out.length,
      expectedCellsWithPeople: +out.reduce((s, c) => s + c.p, 0).toFixed(2),
      byClass: out.reduce((m, c) => ((m[c.cls] = (m[c.cls] ?? 0) + 1), m), {}),
      badge98: out.filter((c) => c.badge98).length,
    },
    params: { ...mid, ranges: Object.fromEntries(scalarKeys.map((k) => [k, params[k]])) },
    disclaimer: 'Prioridad de búsqueda calculada con parámetros hipotéticos hasta calibración de campo. No es un diagnóstico ni declara víctimas.',
  };
}

/** Puntuación de Brier y diagrama de fiabilidad (para validar la calibración contra una verdad conocida). */
export function calibrationReport(pairs, bins = 10) {
  const brier = pairs.reduce((s, [p, y]) => s + (p - y) ** 2, 0) / pairs.length;
  const table = Array.from({ length: bins }, (_, b) => {
    const sel = pairs.filter(([p]) => Math.min(bins - 1, Math.floor(p * bins)) === b);
    return { bin: `${b / bins}-${(b + 1) / bins}`, n: sel.length, predicted: sel.length ? sel.reduce((s, [p]) => s + p, 0) / sel.length : null, observed: sel.length ? sel.reduce((s, [, y]) => s + y, 0) / sel.length : null };
  });
  return { n: pairs.length, brier: +brier.toFixed(4), table };
}
