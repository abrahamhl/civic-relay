#!/usr/bin/env node
/**
 * Validación y calibración reproducible de SENDA Drive (/senda/conducir):
 *   1) Vídeo real Udacity CarND-Vehicle-Detection (MIT, 36,08 s, 145 fotogramas a 4 Hz con EfficientDet-Lite0 int8);
 *   2) Escenarios cinemáticos a la cadencia real de 4 Hz (acercamiento 43 km/h e incorporaciones laterales);
 *   3) 838 incidencias reales DGT DATEX II v3.7 (nap.dgt.es, copia 2026-11-14 con SHA-256).
 *
 * 0 €, 100 % en el dispositivo, sin red. Cumple CLAUDE.md §1: todas las cifras son medidas por este código
 * y las simulaciones cinemáticas van etiquetadas explícitamente como SIMULATION.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTracker, topAlert, zoneOf, RULES } from '../src/drive-hazard.mjs';
import { hazardsAhead, dedupeHazards, CORRIDOR_RULES } from '../src/drive-corridor.mjs';
import { AASHTO_SSD } from '../src/road-guard.mjs';
import { fromDatex } from '../src/report-style.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const tracePath = resolve(here, 'udacity-effdet-4hz.json');
const dgtPath = resolve(root, 'investor-next/public/senda/data/referencias/dgt_incidencias.json');
const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
const dgt = JSON.parse(readFileSync(dgtPath, 'utf8'));

// ── Reproducción exacta del algoritmo base (master c3706a5) para comparación A/B honesta ──
function createBaselineTracker() {
  let tracks = [], nextId = 1;
  const WATCHED = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person', 'dog', 'horse', 'cow', 'sheep'];
  const iou = (a, b) => {
    const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return i / (a.w * a.h + b.w * b.h - i || 1);
  };
  const cx = (b) => b.x + b.w / 2;
  const slope = (pts) => {
    const n = pts.length, mt = pts.reduce((s, p) => s + p.t, 0) / n, my = pts.reduce((s, p) => s + p.v, 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p.t - mt) * (p.v - my); den += (p.t - mt) ** 2; }
    return den ? num / den : 0;
  };
  return {
    update(dets, t) {
      const live = tracks.filter((k) => t - k.last <= 1.0);
      const used = new Set();
      for (const d of dets.filter((d) => WATCHED.includes(d.label))) {
        let best = null, bi = 0.3;
        for (const k of live) { if (used.has(k) || k.label !== d.label) continue; const v = iou(k.box, d); if (v >= bi) { bi = v; best = k; } }
        if (!best) { best = { id: nextId++, label: d.label, hist: [] }; live.push(best); }
        used.add(best); best.box = d; best.last = t; best.hist.push({ t, s: Math.sqrt(d.w * d.h), c: cx(d) });
        if (best.hist.length > 12) best.hist.shift();
      }
      tracks = live;
      return tracks.filter((k) => k.last === t).map((k) => {
        const zone = zoneOf(k.box);
        const out = { id: k.id, label: k.label, box: k.box, zone, ttcS: null, lateral: 0, level: 'VERDE', reasons: [] };
        if (k.hist.length < 3) return out;
        const ds = slope(k.hist.slice(-4).map((h) => ({ t: h.t, v: h.s })));
        if (ds > 0) out.ttcS = k.hist.at(-1).s / ds;
        const vc = slope(k.hist.slice(-4).map((h) => ({ t: h.t, v: h.c })));
        const c = k.hist.at(-1).c, mid = 0.5, side = c > mid ? 'DERECHA' : 'IZQUIERDA';
        const toward = Math.abs(c - mid) > 0.02 && ((side === 'DERECHA' && vc < 0) || (side === 'IZQUIERDA' && vc > 0));
        out.lateral = vc;
        if (out.ttcS !== null && out.ttcS <= AASHTO_SSD.perceptionReactionS && zone === 'TU_CARRIL') { out.level = 'ROJO'; out.reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
        else if (out.ttcS !== null && out.ttcS <= 2 * AASHTO_SSD.perceptionReactionS) { out.level = 'AMBAR'; out.reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
        if (toward && Math.abs(vc) >= 0.25) { out.level = out.level === 'ROJO' ? 'ROJO' : 'AMBAR'; out.reasons.push(side === 'DERECHA' ? 'se mete desde la derecha' : 'se mete desde la izquierda'); }
        return out;
      });
    },
  };
}

// 1) Evaluación sobre vídeo real Udacity MIT (145 fotogramas a 4 Hz)
function evalUdacity(tracker) {
  let rojo = 0, ambar = 0;
  const ids = new Set();
  const alerts = [];
  for (const f of trace.frames) {
    const objs = tracker.update(f.dets, f.t);
    objs.forEach((o) => ids.add(o.id));
    const top = topAlert(objs);
    if (top) {
      if (top.level === 'ROJO') rojo++;
      if (top.level === 'AMBAR') ambar++;
      alerts.push({ t: f.t, id: top.id, label: top.label, zone: top.zone, level: top.level, ttcS: top.ttcS != null ? +top.ttcS.toFixed(2) : null, reasons: top.reasons });
    }
  }
  return { frames: trace.frames.length, rojoFrames: rojo, ambarFrames: ambar, totalAlertFrames: rojo + ambar, trackIds: ids.size, alerts };
}
const udacityBase = evalUdacity(createBaselineTracker());
const udacityCal = evalUdacity(createTracker());

// 2) Escenarios cinemáticos declarados a 4 Hz (SIMULATION)
const box = (cxv, s) => ({ label: 'car', score: 0.8, x: cxv - s / 2, y: 0.5 - s / 2, w: s, h: s });
function evalClosing4Hz(tracker) {
  let firstAmberS = null, firstRedS = null;
  for (let i = 0; i <= 12; i++) {
    const t = i * 0.25, D = 40 - 12 * t;
    const o = tracker.update([box(0.5, 2.2 / D)], t)[0];
    if (o.level === 'AMBAR' && firstAmberS == null) firstAmberS = t;
    if (o.level === 'ROJO' && firstRedS == null) firstRedS = t;
  }
  return { firstAmberS, firstRedS };
}
function evalCutIn4Hz(tracker, speedWps) {
  let firstAmberS = null;
  for (let i = 0; i <= 8; i++) {
    const t = i * 0.25;
    const o = tracker.update([box(0.85 - speedWps * t, 0.12)], t)[0];
    if (o.level === 'AMBAR' && firstAmberS == null) firstAmberS = t;
  }
  return { speedWps, firstAmberS };
}
const kinematics = {
  basis: 'SIMULATION',
  note: 'Escenarios cinemáticos ideales a 4 Hz (250 ms/fotograma, la cadencia real de /senda/conducir); no son colisiones reales grabadas.',
  closing43kmh: { baseline: evalClosing4Hz(createBaselineTracker()), calibrated: evalClosing4Hz(createTracker()) },
  cutIn030: { baseline: evalCutIn4Hz(createBaselineTracker(), 0.30), calibrated: evalCutIn4Hz(createTracker(), 0.30) },
  cutIn036: { baseline: evalCutIn4Hz(createBaselineTracker(), 0.36), calibrated: evalCutIn4Hz(createTracker(), 0.36) },
};

// 3) Validación sobre 838 incidencias reales DGT DATEX II v3.7
const allItems = dgt.incidencias.map((i, idx) => ({ cat: fromDatex(i), lat: i.lat, lon: i.lon, distM: idx, rank: 1 }));
const dedupedNational = dedupeHazards(allItems, CORRIDOR_RULES.dedupM);
const probes = [
  { name: 'Valencia V-31 Sur (hacia ACCIDENTE real)', pos: [-0.3703, 39.4427], headingDeg: 180, speedMs: 25 },
  { name: 'Valencia V-31 Norte (sentido contrario, sin spam)', pos: [-0.3703, 39.4427], headingDeg: 0, speedMs: 25 },
  { name: 'Madrid A-6 BUS-VAO NO (doble CORTE real)', pos: [-3.735, 40.449], headingDeg: 315, speedMs: 100 / 3.6 },
  { name: 'Madrid A-4 Sur (hacia PARADO + TRAFICO reales)', pos: [-3.694, 40.394], headingDeg: 170, speedMs: 25 },
];
const t0 = performance.now();
const dgtProbes = probes.map((p) => {
  const r = hazardsAhead({ pos: p.pos, headingDeg: p.headingDeg, speedMs: p.speedMs, incidents: dgt.incidencias, incSource: `DGT, copia del ${new Date(dgt.descargadoUTC).toLocaleDateString('es-ES')}` });
  return {
    name: p.name,
    mode: r.mode,
    horizonM: r.horizonM,
    ssdM: r.ssdM,
    rawCount: r.rawCount,
    dedupedCount: r.dedupedCount,
    top: r.top ? { cat: r.top.cat, road: r.top.road, distM: r.top.distM, urgency: r.top.urgency, sourceLabel: r.top.sourceLabel } : null,
  };
});
const benchMs = +(performance.now() - t0).toFixed(2);

const report = {
  schema: 'senda-drive-calibration-report/v1',
  generatedUtc: new Date().toISOString(),
  costEur: 0,
  execution: '100 % en el dispositivo, sin red',
  inputs: {
    udacityTrace: { path: 'packages/senda/calibration/udacity-effdet-4hz.json', sha256: sha(tracePath), videoSha256: trace.videoSha256, modelSha256: trace.modelSha256, frames: trace.frames.length },
    dgtSnapshot: { path: 'investor-next/public/senda/data/referencias/dgt_incidencias.json', sha256: sha(dgtPath), xmlSha256: dgt.sha256Xml, descargadoUTC: dgt.descargadoUTC, total: dgt.incidencias.length },
  },
  udacityReal4Hz: {
    basis: 'MEDICION_REAL_DETECTOR_SOBRE_VIDEO_MIT',
    referenceGroundTruth: trace.referenceSummary,
    baseline_c3706a5: udacityBase,
    calibrated: udacityCal,
    delta: {
      falseAlertFramesReduced: udacityBase.totalAlertFrames - udacityCal.totalAlertFrames,
      trackFragmentsReduced: udacityBase.trackIds - udacityCal.trackIds,
    },
  },
  kinematics4Hz: kinematics,
  dgtCorridorReal: {
    basis: 'MEDICION_SOBRE_DATOS_REALES_DGT_DATEX2',
    totalIncidents: dgt.incidencias.length,
    nationalAfter120mDedup: dedupedNational.length,
    duplicatesCollapsedNational: dgt.incidencias.length - dedupedNational.length,
    fourProbesTotalMs: benchMs,
    probes: dgtProbes,
  },
  rulesProvenance: { driveHazard: RULES.source, driveCorridor: CORRIDOR_RULES.source },
  limits: [
    'Udacity MIT es un único tramo de autopista diurna seca (36,08 s, 0 frenadas de emergencia reales): valida falsos positivos y fragmentación, NO calibra falsos negativos en noche, lluvia ni tráfico urbano.',
    'La validación de acercamiento e incorporación lateral a 4 Hz es una simulación cinemática declarada (basis: SIMULATION), no ensayos de choque reales.',
    'Las 838 incidencias DGT son una instantánea real de nap.dgt.es del 2026-11-14 (DATEX II v3.7); en modo sin red la app muestra siempre su fecha y en modo play usa el feed en vivo.',
  ],
};

const outDir = resolve(root, 'evidence/drive-calibration');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'calibration-2026-11-24.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({
  outPath: 'evidence/drive-calibration/calibration-2026-11-24.json',
  udacity: { baseFalseAlerts: udacityBase.totalAlertFrames, calFalseAlerts: udacityCal.totalAlertFrames, baseTracks: udacityBase.trackIds, calTracks: udacityCal.trackIds },
  kinematics4Hz: { closingRedBase: kinematics.closing43kmh.baseline.firstRedS, closingRedCal: kinematics.closing43kmh.calibrated.firstRedS, cutIn030Base: kinematics.cutIn030.baseline.firstAmberS, cutIn030Cal: kinematics.cutIn030.calibrated.firstAmberS },
  dgt: { total: dgt.incidencias.length, duplicatesCollapsed: dgt.incidencias.length - dedupedNational.length, fourProbesTotalMs: benchMs, probes: dgtProbes.map((p) => ({ name: p.name, top: p.top?.cat ? `${p.top.cat} ${p.top.road} ${p.top.distM}m` : 'none', raw: p.rawCount, deduped: p.dedupedCount })) },
}, null, 2));
