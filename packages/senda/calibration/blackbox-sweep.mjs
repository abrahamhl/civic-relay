#!/usr/bin/env node
/**
 * SENDA Drive · Calibrador offline de Caja Negra y barrido de parámetros ADAS (0 €, sin red).
 *
 * Uso:
 *   1) Sin argumentos: ejecuta el barrido Pareto sobre la traza real Udacity MIT (145 fotogramas a 4 Hz)
 *      + escenarios cinemáticos declarados (SIMULATION) y guarda `evidence/drive-calibration/sweep-2026-11-24.json`.
 *   2) Con archivo de caja negra real: `node packages/senda/calibration/blackbox-sweep.mjs senda-blackbox-*.json`
 *      Verifica la cadena criptográfica SHA-256, resume toda la telemetría (GNSS, IMU, batería, zonas sin red,
 *      radares fijos/tramo, sonda BLE) y, si contiene pistas ADAS brutas (`vision.tracks`), re-ejecuta el barrido
 *      de umbrales directamente sobre el viaje real del conductor.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTracker, topAlert, RULES } from '../src/drive-hazard.mjs';
import { verifyBlackBox, summarizeBlackBox } from '../src/drive-blackbox.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

const GRID = {
  amberTtcS: [3.5, 5.0, 6.0],
  cutInSpeed: [0.18, 0.25, 0.32],
  confirmFrames: [1, 2, 3],
  edgeMargin: [0, 0.015],
};

function evalFrames(frames, rules) {
  const tr = createTracker(rules);
  let rojo = 0, ambar = 0;
  const ids = new Set();
  for (const f of frames) {
    const objs = tr.update(f.dets, f.t);
    for (const o of objs) ids.add(o.id);
    const top = topAlert(objs);
    if (top?.level === 'ROJO') rojo++;
    else if (top?.level === 'AMBAR') ambar++;
  }
  return { frames: frames.length, rojo, ambar, totalAlerts: rojo + ambar, trackIds: ids.size };
}

function evalSimScenarios(rules) {
  const box = (cxv, s) => ({ label: 'car', score: 0.8, x: cxv - s / 2, y: 0.5 - s / 2, w: s, h: s });
  // Escenario A (SIMULATION): coche delante acercándose a 12 m/s (43,2 km/h) a 4 Hz
  const tClose = createTracker(rules);
  let closeRedS = null;
  for (let i = 0; i <= 12; i++) {
    const t = i * 0.25, d = 36 - 12 * t;
    if (d <= 2) break;
    const top = topAlert(tClose.update([box(0.5, 4.0 / d)], t));
    if (top?.level === 'ROJO' && closeRedS == null) closeRedS = t;
  }
  // Escenario B (SIMULATION): incorporación rápida 0,30 anchos/s desde la derecha a 4 Hz
  const tCut = createTracker(rules);
  let cutInS = null;
  for (let i = 0; i <= 10; i++) {
    const t = i * 0.25, cxv = 0.85 - 0.30 * t;
    const top = topAlert(tCut.update([box(cxv, 0.14)], t));
    if (top && top.reasons.some((r) => r.startsWith('se mete')) && cutInS == null) cutInS = t;
  }
  return { basis: 'SIMULATION_4HZ', closing43kmhRedS: closeRedS, cutIn030AlertS: cutInS };
}

function runSweep(frames) {
  const rows = [];
  for (const amberTtcS of GRID.amberTtcS) {
    for (const cutInSpeed of GRID.cutInSpeed) {
      for (const confirmFrames of GRID.confirmFrames) {
        for (const edgeMargin of GRID.edgeMargin) {
          const r = { ...RULES, amberTtcS, cutInSpeed, confirmFrames, edgeMargin };
          const real = evalFrames(frames, r);
          const sim = evalSimScenarios(r);
          rows.push({
            params: { amberTtcS, cutInSpeed, confirmFrames, edgeMargin },
            real,
            sim,
          });
        }
      }
    }
  }
  // Filtrar frontera Pareto: mínimo de falsas alertas en vídeo real manteniendo detección de acercamiento y cut-in
  const valid = rows.filter((x) => x.sim.closing43kmhRedS != null && x.sim.cutIn030AlertS != null);
  valid.sort((a, b) => a.real.totalAlerts - b.real.totalAlerts || a.sim.closing43kmhRedS - b.sim.closing43kmhRedS || a.sim.cutIn030AlertS - b.sim.cutIn030AlertS);
  return { testedConfigs: rows.length, validConfigs: valid.length, topPareto: valid.slice(0, 8), all: rows };
}

const argPath = process.argv[2];

if (argPath) {
  const abs = resolve(process.cwd(), argPath);
  const doc = JSON.parse(readFileSync(abs, 'utf8'));
  const integrity = await verifyBlackBox(doc);
  const summary = summarizeBlackBox(doc.frames ?? []);
  const trackFrames = (doc.frames ?? [])
    .filter((f) => Array.isArray(f.vision?.tracks))
    .map((f) => ({
      t: f.t / 1000,
      dets: f.vision.tracks
        .filter((tr) => Array.isArray(tr.box) && tr.box.length === 4)
        .map((tr) => ({ label: tr.label, score: 0.8, x: tr.box[0], y: tr.box[1], w: tr.box[2], h: tr.box[3] })),
    }));
  const sweep = trackFrames.length >= 5 ? runSweep(trackFrames) : null;
  console.log(JSON.stringify({ file: abs, schema: doc.schema, integrity, summary, trackFrames: trackFrames.length, topPareto: sweep?.topPareto ?? null }, null, 2));
} else {
  const tracePath = resolve(here, 'udacity-effdet-4hz.json');
  const trace = JSON.parse(readFileSync(tracePath, 'utf8'));
  const res = runSweep(trace.frames);
  const report = {
    generatedUtc: new Date().toISOString(),
    sourceTrace: 'packages/senda/calibration/udacity-effdet-4hz.json (Udacity CarND MIT, 145 fotogramas a 4 Hz)',
    activeDefaults: {
      amberTtcS: RULES.amberTtcS,
      cutInSpeed: RULES.cutInSpeed,
      confirmFrames: RULES.confirmFrames,
      edgeMargin: RULES.edgeMargin,
    },
    testedConfigs: res.testedConfigs,
    validConfigs: res.validConfigs,
    topPareto: res.topPareto,
  };
  const outDir = resolve(root, 'evidence/drive-calibration');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'sweep-2026-11-24.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Barrido Pareto completado (${res.testedConfigs} configuraciones, ${res.validConfigs} válidas) → ${outPath}`);
  for (const r of res.topPareto.slice(0, 5)) {
    console.log(`  amber=${r.params.amberTtcS}s cutIn=${r.params.cutInSpeed} confirm=${r.params.confirmFrames} edge=${r.params.edgeMargin} → Udacity alertas=${r.real.totalAlerts} (ROJO=${r.real.rojo}, AMBAR=${r.real.ambar}, pistas=${r.real.trackIds}) · sim ROJO=${r.sim.closing43kmhRedS}s · cutIn=${r.sim.cutIn030AlertS}s`);
  }
}
