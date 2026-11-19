/**
 * SENDA · Calibración del detector de choques (roadsafe-crash-detect) con trazas ETIQUETADAS.
 *
 * Entrada: JSONL, una traza por línea:
 *   { id, label: true|false, split: 'train'|'test', imu: [{t,x,y,z}] (m/s²), gyro?: [{t,x,y,z}] (°/s),
 *     speed: [{t, ms}], distanceToRoadM?, airbag? }
 * (Para VZCrash, generarla con packages/senda/calibration/vzcrash_to_jsonl.py tras aceptar su licencia.)
 *
 * Método:
 *  1. Con la configuración base (umbrales DECLARADOS) se calculan las evidencias de cada traza.
 *  2. En TRAIN se estima, por evidencia, LR = P(evidencia | choque) / P(evidencia | no choque) con suavizado
 *     de Laplace (+1). Solo las trazas que DISPARAN el detector entran en la estimación.
 *  3. La probabilidad PREVIA NO se ajusta con el dataset (su proporción de choques está sesgada por el
 *     muestreo): se mantiene la declarada en la configuración base y se informa aparte de la del dataset.
 *  4. En TEST se mide sensibilidad y especificidad con intervalo de Wilson al 95 %.
 *
 * Uso: node packages/senda/scripts/crash-calibrate.mjs <trazas.jsonl> --dataset <nombre> --license <licencia> [--out informe.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { detectCrashEvent, evaluateDetector, EXAMPLE_DETECTION_CONFIG, EVIDENCE_KEYS } from '../src/roadsafe-crash-detect.mjs';

export function calibrate(traces, baseConfig, { dataset, license, sha256 = null }) {
  if (!dataset || !license) throw new Error('calibrate: «dataset» y «license» deben declararse');
  const train = traces.filter((t) => t.split === 'train'), test = traces.filter((t) => t.split === 'test');
  if (!train.length || !test.length) throw new Error('calibrate: hacen falta trazas de train y de test (sin mezclar)');
  const neutral = { ...baseConfig, lr: Object.fromEntries(EVIDENCE_KEYS.map((k) => [k, 1])) };
  const counts = Object.fromEntries(EVIDENCE_KEYS.map((k) => [k, { pos: 0, posN: 0, neg: 0, negN: 0 }]));
  let triggeredPos = 0, triggeredNeg = 0;
  for (const tr of train) {
    const r = detectCrashEvent(tr, neutral);
    if (r.state === 'NO_EVENT' && r.why?.includes('sin disparo')) continue;
    if (tr.label) triggeredPos++; else triggeredNeg++;
    for (const k of EVIDENCE_KEYS) {
      const v = r.evidence?.[k]; if (v === undefined) continue;
      const c = counts[k]; if (tr.label) { c.posN++; if (v === true) c.pos++; } else { c.negN++; if (v === true) c.neg++; }
    }
  }
  const lr = {}, lrDetail = {};
  for (const k of EVIDENCE_KEYS) {
    const c = counts[k];
    if (c.posN === 0 || c.negN === 0) { lr[k] = null; lrDetail[k] = { ...c, lr: null, why: 'sin trazas de ambas clases con esta evidencia observada' }; continue; }
    const v = ((c.pos + 1) / (c.posN + 2)) / ((c.neg + 1) / (c.negN + 2));
    lr[k] = +v.toFixed(3); lrDetail[k] = { ...c, lr: lr[k] };
  }
  const calibrated = { ...baseConfig, lr, basis: `CALIBRATED_LR · ${dataset} (${license}) · train n=${train.length}${sha256 ? ` · sha256 ${sha256.slice(0, 16)}` : ''} · prior DECLARADO, no ajustado` };
  const evalTest = evaluateDetector(test, calibrated), evalBase = evaluateDetector(test, baseConfig);
  const prevalence = traces.filter((t) => t.label).length / traces.length;
  return {
    dataset, license, sha256, n: { train: train.length, test: test.length, triggeredTrain: { crash: triggeredPos, noCrash: triggeredNeg } },
    datasetCrashShare: +prevalence.toFixed(4), priorOddsUsed: baseConfig.priorOdds,
    priorNote: 'La proporción de choques del dataset NO es la del mundo real (muestreo enriquecido): no se usa como previa.',
    lr: lrDetail, config: calibrated,
    test: { calibrated: { sensitivity: evalTest.sensitivity, specificity: evalTest.specificity, abstain: evalTest.abstain }, baseline: { sensitivity: evalBase.sensitivity, specificity: evalBase.specificity, abstain: evalBase.abstain } },
    licenseWarning: /NC/i.test(license) ? 'Licencia NO comercial: estos parámetros sirven para investigación y validación; no deben usarse en un producto comercial sin permiso del titular.' : null,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , path, ...rest] = process.argv, arg = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  if (!path) { console.error('uso: crash-calibrate.mjs <trazas.jsonl> --dataset <nombre> --license <licencia> [--out f.json]'); process.exit(2); }
  const raw = readFileSync(path), traces = raw.toString('utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const report = calibrate(traces, EXAMPLE_DETECTION_CONFIG, { dataset: arg('--dataset'), license: arg('--license'), sha256: createHash('sha256').update(raw).digest('hex') });
  const out = JSON.stringify(report, null, 2);
  if (arg('--out')) writeFileSync(arg('--out'), out); else console.log(out);
}
