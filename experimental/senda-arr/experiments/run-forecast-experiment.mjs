#!/usr/bin/env node
/**
 * SENDA ARR — experiment H2: does assimilating the latest OBSERVED perimeter improve the forecast of
 * "the fire reaches this place within 24 h"?  `node experiments/run-forecast-experiment.mjs`
 *
 * PRE-REGISTERED (written before running on the fires):
 *  - Outcome OBSERVED: a point is inside the cumulative perimeter union at the last perimeter mapped ≤ t0 + 24 h.
 *  - 300 seeded evaluation points per (fire, planning index), unburnt at t0, uniformly in the padded bounding box.
 *  - Planning indices 1..12 (assimilation needs one earlier perimeter), kept only if a perimeter exists in (t0, t0 + 24 h].
 *  - Forecasts: persistence (front does not move), prior ensemble, assimilated ensemble. 64 members. No tuning.
 *  - Statistical unit = (fire, planning index); paired Brier difference; bootstrap 95 % CI, 2000 resamples.
 *  ACCEPT H2 iff  Brier(prior) − Brier(assimilated) has CI lower bound > 0  AND  relative Brier reduction ≥ 15 %.
 *  Also reported, not part of the criterion: skill versus persistence, bias, reliability bins.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mulberry32, projector, bootstrapCi, calibration, mean } from '../src/arr-sim.mjs';
import { forecastParticles, pointGeometry, arrivalForecast } from '../src/arr-forecast.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), HOUR = 3600000, HORIZON_H = 24, MODES = ['persistence', 'prior', 'assimilated'];
const EXPLORATORY = process.argv.find((a) => a.startsWith('--exploratory-probes='))?.split('=')[1]; // post hoc, never confirmatory
const units = [], pairs = Object.fromEntries(MODES.map((m) => [m, []])), perFire = {};

for (const key of ['camp', 'carr', 'woolsey']) {
  const d = JSON.parse(readFileSync(path.join(here, '..', 'data', `geomac-2018-${key}.json`)));
  const all = d.perimeters.flatMap((p) => p.rings.flat()), lon = all.map((p) => p[0]), lat = all.map((p) => p[1]);
  const lo = [Math.min(...lon), Math.min(...lat)], hi = [Math.max(...lon), Math.max(...lat)], pad = [(hi[0] - lo[0]) * 0.25, (hi[1] - lo[1]) * 0.25];
  const toKm = projector(lo[0] - pad[0], lo[1] - pad[1]), area = toKm([hi[0] + pad[0], hi[1] + pad[1]]);
  const per = d.perimeters.map((p) => ({ tMs: Date.parse(p.t), rings: p.rings.map((r) => r.map(toKm)) }));
  perFire[key] = [];
  for (let k0 = 1; k0 <= Math.min(12, per.length - 2); k0++) {
    let kEnd = k0; while (kEnd + 1 < per.length && per[kEnd + 1].tMs <= per[k0].tMs + HORIZON_H * HOUR) kEnd++;
    if (kEnd === k0) continue; // nothing observed inside the horizon: outcome unknowable
    const rng = mulberry32(7000 + k0 * 131 + key.length), points = [];
    while (points.length < 300) { const p = [rng() * area[0], rng() * area[1]]; if (!pointGeometry(per, k0, [p])[0].burnt) points.push(p); }
    const geometry = pointGeometry(per, k0, points), outcome = pointGeometry(per, kEnd, points).map((g) => (g.burnt ? 1 : 0));
    const unit = { fire: key, k0, planningTime: d.perimeters[k0].t, observedUntil: d.perimeters[kEnd].t, baseRate: mean(outcome), brier: {}, ess: null };
    for (const mode of MODES) {
      const f = forecastParticles(mulberry32(9000 + k0), { perimetersKm: per, k0, mode, area, ...(EXPLORATORY ? { effectiveProbes: +EXPLORATORY } : {}) });
      if (mode === 'assimilated') unit.ess = f.effectiveSampleSize;
      const probs = arrivalForecast(f, geometry, HORIZON_H).map((x) => x.probability);
      unit.brier[mode] = mean(probs.map((p, i) => (p - outcome[i]) ** 2));
      probs.forEach((p, i) => pairs[mode].push([p, outcome[i]]));
    }
    units.push(unit); perFire[key].push(unit);
  }
}

const diff = (a, b, set = units) => bootstrapCi(set.map((u) => u.brier[a] - u.brier[b]), { seed: 17 });
const brier = Object.fromEntries(MODES.map((m) => [m, mean(units.map((u) => u.brier[m]))]));
const gain = diff('prior', 'assimilated');
const result = {
  protocol: { exploratoryEffectiveProbes: EXPLORATORY ?? null, horizonHours: HORIZON_H, pointsPerUnit: 300, members: 64, generatedAt: new Date().toISOString() },
  units: units.length, meanBaseRate: mean(units.map((u) => u.baseRate)), brier,
  priorMinusAssimilated: gain, relativeReduction: (brier.prior - brier.assimilated) / brier.prior,
  persistenceMinusAssimilated: diff('persistence', 'assimilated'), persistenceMinusPrior: diff('persistence', 'prior'),
  perFire: Object.fromEntries(Object.entries(perFire).map(([k, us]) => [k, { units: us.length, brier: Object.fromEntries(MODES.map((m) => [m, mean(us.map((u) => u.brier[m]))])), priorMinusAssimilated: diff('prior', 'assimilated', us) }])),
  calibration: Object.fromEntries(MODES.map((m) => { const c = calibration(pairs[m]); return [m, { ece: c.ece, bias: c.bias, bins: c.bins }]; })),
  unitsDetail: units,
};
result.verdict = { ciLowerAboveZero: gain.lo > 0, reductionAtLeast15pct: result.relativeReduction >= 0.15, h2Accepted: gain.lo > 0 && result.relativeReduction >= 0.15,
  beatsPersistence: result.persistenceMinusAssimilated.lo > 0 };
writeFileSync(path.join(here, '..', 'results', EXPLORATORY ? 'forecast-results.exploratory.json' : 'forecast-results.json'), JSON.stringify(result, null, 1));
const f4 = (x) => x.toFixed(4), c3 = (c) => `${f4(c.mean)} [${f4(c.lo)}, ${f4(c.hi)}]`;
writeFileSync(path.join(here, '..', 'results', EXPLORATORY ? 'FORECAST_RESULTS.exploratory.md' : 'FORECAST_RESULTS.md'), [
  ...(EXPLORATORY ? [`> **EXPLORATORIO, POST HOC (effectiveProbes = ${EXPLORATORY}).** Ejecutado después de ver el resultado prerregistrado; no confirma nada.`, ''] : []),
  '# SENDA ARR — resultados del experimento H2 (asimilación de perímetros)', '',
  `> Generado por \`experiments/run-forecast-experiment.mjs\` (${result.protocol.generatedAt}). Resultado OBSERVADO: el punto queda dentro del perímetro acumulado en ≤ 24 h. Pronósticos PREDICHOS con datos ≤ instante de planificación.`, '',
  `Unidades (incendio × instante): ${result.units} · 300 puntos por unidad · tasa base observada de llegada en 24 h: ${(100 * result.meanBaseRate).toFixed(1)} %`, '',
  '| Pronóstico | Brier medio | Sesgo (pp) | ECE |', '|---|---|---|---|',
  ...MODES.map((m) => `| ${m} | ${f4(brier[m])} | ${(100 * result.calibration[m].bias).toFixed(1)} | ${result.calibration[m].ece.toFixed(3)} |`), '',
  `- Brier(prior) − Brier(asimilado): ${c3(gain)} · reducción relativa ${(100 * result.relativeReduction).toFixed(1)} %`,
  `- Brier(persistencia) − Brier(asimilado): ${c3(result.persistenceMinusAssimilated)} (negativo = la persistencia es mejor)`,
  `- Brier(persistencia) − Brier(prior): ${c3(result.persistenceMinusPrior)}`, '',
  '| Incendio | Unidades | Persistencia | Prior | Asimilado | Prior − asimilado [IC 95 %] |', '|---|---|---|---|---|---|',
  ...Object.entries(result.perFire).map(([k, r]) => `| ${k} | ${r.units} | ${f4(r.brier.persistence)} | ${f4(r.brier.prior)} | ${f4(r.brier.assimilated)} | ${c3(r.priorMinusAssimilated)} |`), '',
  '## Veredicto prerregistrado', '',
  `- IC inferior > 0: **${result.verdict.ciLowerAboveZero ? 'sí' : 'no'}** · reducción ≥ 15 %: **${result.verdict.reductionAtLeast15pct ? 'sí' : 'no'}** → H2 ${result.verdict.h2Accepted ? 'ACEPTADA' : '**RECHAZADA**'}`,
  `- ¿Mejora a la persistencia?: **${result.verdict.beatsPersistence ? 'sí' : 'no'}**`, ''].join('\n'));
const { unitsDetail, calibration: _c, ...brief } = result;
console.log(JSON.stringify(brief, null, 1));
console.log('bias', Object.fromEntries(MODES.map((m) => [m, result.calibration[m].bias.toFixed(3)])));
