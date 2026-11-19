#!/usr/bin/env node
/** Turns results/results.json into results/RESULTS.md and two SVG charts. Pure formatting: no number is computed here. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results');
const R = JSON.parse(readFileSync(path.join(dir, 'results.json')));
const pct = (x) => (100 * x).toFixed(1), ci = (c) => `${pct(c.mean)} [${pct(c.lo)}, ${pct(c.hi)}]`;
const ORDER = ['cgr-earliest', 'cgr-k-exclusion', 'top-k-marginal', 'independent-greedy', 'arr', 'spray-8', 'epidemic'];

function methodTable(r) {
  const names = [...ORDER.filter((m) => r.methods[m]), ...Object.keys(r.methods).filter((m) => !ORDER.includes(m))];
  return ['| Método | Entrega a tiempo % [IC 95 %] | ARR − método (pp) [IC 95 %] | Transmisiones | Energía mJ | Latencia min (si entrega) |', '|---|---|---|---|---|---|',
    ...names.map((m) => { const x = r.methods[m], d = r.diffVsArr[m];
      return `| ${m} | ${ci(x.delivery)} | ${d ? ci(d) : '—'} | ${x.transmissions.toFixed(1)} | ${x.energyMj.toFixed(0)} | ${x.latencyMinWhenDelivered.toFixed(0)} |`; })].join('\n');
}
const cal = (c) => `Brier ${c.brier.toFixed(4)} · ECE ${c.ece.toFixed(3)} · sesgo ${(100 * c.bias).toFixed(1)} pp`;
const head = (r) => `Instancias evaluadas ${r.evaluated}/${r.instances} (excluidas sin ruta: ${r.excludedNoRoute}) · ${r.trialsPerInstance} mundos por instancia · fallos de auditoría de invariantes: ${r.auditFailures} · planificación p50/p95: ${r.planningMs.allMethodsP50.toFixed(0)}/${r.planningMs.allMethodsP95.toFixed(0)} ms (todos los métodos), selección ARR ${r.planningMs.arrSelectionP50.toFixed(1)}/${r.planningMs.arrSelectionP95.toFixed(1)} ms`;

const md = [`# SENDA ARR — resultados del experimento H-ARR-1`, '',
  `> Generado por \`experiments/make-report.mjs\` a partir de \`results.json\` (${R.protocol.generatedAt}, Node ${R.protocol.node}).`,
  `> **Todo es simulación.** Semillas retenidas ≥ ${R.protocol.heldOutSeedStart}; semillas de desarrollo ${R.protocol.developmentSeedsExcluded} excluidas. Ninguna cifra es una tasa de entrega real.`, '',
  '## Veredicto frente a los criterios prerregistrados', '', '| Criterio | Resultado |', '|---|---|',
  ...Object.entries(R.verdict).map(([k, v]) => `| ${k.replace(/_/g, ' ')} | ${v ? 'SE CUMPLE' : 'NO SE CUMPLE'} |`), '',
  '## 1. Sintético retenido: barrido de correlación regional', ''];
for (const [k, r] of Object.entries(R.synthetic)) md.push(`### ${k}`, '', head(r), '', methodTable(r), '',
  `Calibración — ARR: ${cal(r.calibration.arr)} · independencia sobre su propio plan: ${cal(r.calibration.independent)} · independencia sobre el plan ARR: ${cal(r.calibration.independentOnArr)}`, '');
md.push('![Entrega frente a correlación](delivery-vs-rho.svg)', '', '![Calibración](calibration-rho09.svg)', '',
  '## 2. Incendios con perímetros OBSERVADOS (USGS GeoMAC 2018)', '',
  'Verdad del peligro: OBSERVADA. Topología, contactos y desvanecimiento: SIMULADOS. Pronóstico: PREDICHO solo con datos anteriores al instante de planificación. Evaluación condicionada a que origen y destino no arden.', '');
for (const [k, r] of Object.entries(R.fire)) {
  if (r.variants) {
    md.push(`### ${k}`, '', `SHA-256 de perímetros: \`${r.perimetersSha256}\``, '', head(r), '', methodTable(r.variants.main), '',
      `Calibración ARR: ${cal(r.variants.main.calibration.arr)} · independencia: ${cal(r.variants.main.calibration.independent)}`, '',
      `Sensibilidad a la censura temporal del perímetro (ARR − independencia, pp): temprana ${ci(r.variants.early.diffVsArr['independent-greedy'])} · tardía ${ci(r.variants.late.diffVsArr['independent-greedy'])}`, '');
  } else md.push(`### ${k} (prueba C4)`, '', head(r), '', methodTable(r), '', `Calibración ARR: ${cal(r.calibration.arr)} · independencia: ${cal(r.calibration.independent)}`, '');
}
md.push('## 3. Ablaciones y sensibilidad (ρ = 0,9 salvo indicación)', '');
for (const [k, r] of Object.entries(R.ablations)) md.push(`### ${k}`, '', head(r), '', methodTable(r), '', `Calibración ARR: ${cal(r.calibration.arr)} · independencia: ${cal(r.calibration.independent)}`, '');
const g = R.greedyVsExhaustive;
md.push('## 4. Voraz frente al óptimo exhaustivo', '',
  `${g.instances} instancias con ≤ 14 candidatas, K = 3: razón media ${g.meanRatio.toFixed(4)}, mínima ${g.minRatio.toFixed(4)}, óptimo exacto alcanzado en el ${pct(g.shareOptimal)} %. Garantía teórica: ${g.guarantee.toFixed(3)}.`, '');
writeFileSync(path.join(dir, 'RESULTS.md'), md.join('\n'));

/* ---- charts (inline SVG, no dependencies) ---- */
const W = 720, H = 360, C = { arr: '#1a7f4b', 'independent-greedy': '#b26a00', 'cgr-k-exclusion': '#1f6fb2', 'cgr-earliest': '#7a52b3', epidemic: '#6b7280' };
const frame = (title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="12"><rect width="${W}" height="${H}" fill="#fff"/><text x="16" y="22" font-size="14" font-weight="600">${title}</text>${body}</svg>`;
{
  const keys = Object.keys(R.synthetic), x = (i) => 70 + (i * (W - 230)) / (keys.length - 1), y = (v) => H - 40 - ((v - 0.4) / 0.6) * (H - 90);
  let b = '';
  for (const v of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) b += `<line x1="60" x2="${W - 150}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb"/><text x="30" y="${y(v) + 4}">${v.toFixed(1)}</text>`;
  keys.forEach((k, i) => (b += `<text x="${x(i) - 18}" y="${H - 18}">${k.replace('rho=', 'ρ = ')}</text>`));
  Object.entries(C).forEach(([m, col], j) => {
    const pts = keys.map((k, i) => [x(i), R.synthetic[k].methods[m].delivery]);
    b += `<polyline fill="none" stroke="${col}" stroke-width="2" points="${pts.map(([px, d]) => `${px},${y(d.mean)}`).join(' ')}"/>`;
    for (const [px, d] of pts) b += `<line x1="${px}" x2="${px}" y1="${y(d.lo)}" y2="${y(d.hi)}" stroke="${col}" stroke-width="2"/><circle cx="${px}" cy="${y(d.mean)}" r="3" fill="${col}"/>`;
    b += `<rect x="${W - 140}" y="${50 + j * 20}" width="12" height="3" fill="${col}"/><text x="${W - 122}" y="${55 + j * 20}">${m}</text>`;
  });
  writeFileSync(path.join(dir, 'delivery-vs-rho.svg'), frame('Entrega simulada a tiempo frente a correlación regional (IC 95 %, semillas retenidas)', b));
}
{
  const r = R.synthetic['rho=0.9'].calibration, x = (v) => 70 + v * (H - 110), y = (v) => H - 40 - v * (H - 90);
  let b = `<line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) b += `<text x="${x(v) - 8}" y="${H - 18}">${v}</text><text x="34" y="${y(v) + 4}">${v}</text>`;
  [['arr', '#1a7f4b', 'ARR: predicción del conjunto'], ['independent', '#b26a00', 'Independencia: su propia afirmación']].forEach(([k, col, name], j) => {
    const pts = r[k].bins.filter((q) => q.n >= 20);
    b += `<polyline fill="none" stroke="${col}" stroke-width="2" points="${pts.map((q) => `${x(q.predicted)},${y(q.observed)}`).join(' ')}"/>`;
    for (const q of pts) b += `<circle cx="${x(q.predicted)}" cy="${y(q.observed)}" r="${Math.min(7, 2 + Math.sqrt(q.n) / 12)}" fill="${col}"/>`;
    b += `<text x="${H + 10}" y="${70 + j * 20}" fill="${col}">${name} · Brier ${r[k].brier.toFixed(4)} · sesgo ${(100 * r[k].bias).toFixed(1)} pp</text>`;
  });
  b += `<text x="${H + 10}" y="130" fill="#6b7280">x: probabilidad predicha · y: frecuencia simulada</text>`;
  writeFileSync(path.join(dir, 'calibration-rho09.svg'), frame('Calibración a ρ = 0,9 (diagrama de fiabilidad; bins con ≥ 20 pares)', b));
}
console.log('report written');
