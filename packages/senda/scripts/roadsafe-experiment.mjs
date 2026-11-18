#!/usr/bin/env node
/**
 * SENDA RoadSafe · Experimentos reproducibles (semillas fijas). Escribe evidence/roadsafe/*.json y un resumen .md.
 *   node packages/senda/scripts/roadsafe-experiment.mjs [--n 3000]
 * Todos los resultados son de SIMULACIÓN con parámetros declarados; no son eficacia real.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExperiment, PARAM_PROVENANCE, SCENARIOS, circumstanceGrid, EXAMPLE_SCENARIO_CASE_STUDY as SC_EX } from '../src/roadsafe-accident-sim.mjs';
import { fuseRoadEvidence } from '../src/roadsafe-correlation.mjs';
import { rng } from '../src/roadsafe-secondary-risk.mjs';
import { createDispatchOrchestrator, createContractSimulator } from '../src/roadsafe-dispatch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../../evidence/roadsafe');
mkdirSync(outDir, { recursive: true });
const argN = process.argv.indexOf('--n'), N = argN > 0 ? +process.argv[argN + 1] : 3000;
const results = { schema: 'senda-roadsafe-evidence/1', generatedBy: 'packages/senda/scripts/roadsafe-experiment.mjs', n: N, provenance: PARAM_PROVENANCE, experiments: {} };
const E = results.experiments;
const pick = (s) => Object.fromEntries(Object.entries(s.summary).map(([k, v]) => [k, { pCollision: v.pCollision, ci: v.ciCollision, pSecondary: v.pSecondaryImpact, impactP50: v.impactKmhP50, impactP95: v.impactKmhP95, coverage: v.effectiveCoverage, latencyP50: v.latencyP50, latencyP95: v.latencyP95, leadP50: v.usefulLeadP50, falseAlarmRate: v.falseAlarmRate, lateShown: v.lateWarningsShown, lateSuppressed: v.lateWarningsSuppressed, confirmedDisplayAck: v.confirmedDisplayAck, messagesPerCase: v.messagesPerCase }]));

// 1) Base A–E
E.baseline = pick(runExperiment({ scenario: SC_EX, n: N, seed: 2026 }));
// 2) Visibilidad
E.visibility = Object.fromEntries([25, 40, 60, 100, 250].map((sightM) => [sightM, pick(runExperiment({ scenario: SC_EX, n: N, seed: 2026, overrides: { sightM } }))]));
// 3) Distancia temporal
E.headway = Object.fromEntries([0.6, 1.0, 1.5, 2.0].map((headwayS) => [headwayS, pick(runExperiment({ scenario: SC_EX, n: N, seed: 2026, overrides: { headwayS }, scenarios: ['A_NO_DIGITAL', 'D_SENDA_VERIFIED'] }))]));
// 4) Adopción (cuota SENDA y DGT→navegador a 0 para aislar SENDA)
E.adoption = Object.fromEntries([0, 0.01, 0.05, 0.1, 0.3, 0.6].map((share) => [share, pick(runExperiment({ scenario: SC_EX, n: N, seed: 2026, overrides: { sightM: 100, shareOverride: { SENDA_APP: share, DGT30_NAVIGATOR: 0 } }, scenarios: ['A_NO_DIGITAL', 'D_SENDA_VERIFIED'] }))]));
// 5) Latencia del canal autorizado (con taxi llegando pronto: 120 s tras la V16)
E.latency = Object.fromEntries([5, 30, 60, 120, 300].map((lat) => [lat, pick(runExperiment({ scenario: SC_EX, n: N, seed: 2026, assistArrivalS: 120, overrides: { sightM: 100, latencyOverride: { DGT30_NAVIGATOR: lat } }, scenarios: ['A_NO_DIGITAL', 'C_AUTHORIZED_ROAD_CHANNEL'] }))]));
// 6) Controles negativos
const nc = {};
const nc1 = runExperiment({ scenario: SC_EX, n: N, seed: 7, overrides: { shareOverride: { SENDA_APP: 0, DGT30_NAVIGATOR: 0 } } }).summary;
nc.NC1_zero_adoption_equals_A = { A: nc1.A_NO_DIGITAL.pCollision, C: nc1.C_AUTHORIZED_ROAD_CHANNEL.pCollision, D: nc1.D_SENDA_VERIFIED.pCollision, pass: nc1.A_NO_DIGITAL.pCollision === nc1.D_SENDA_VERIFIED.pCollision && nc1.A_NO_DIGITAL.pCollision === nc1.C_AUTHORIZED_ROAD_CHANNEL.pCollision };
const nc2 = runExperiment({ scenario: SC_EX, n: N, seed: 7, overrides: { placebo: true } }).summary; // placebo: aviso sin efecto conductual posible
nc.NC2_placebo_no_effect = { A: nc2.A_NO_DIGITAL.pCollision, D: nc2.D_SENDA_VERIFIED.pCollision, pass: nc2.A_NO_DIGITAL.pCollision === nc2.D_SENDA_VERIFIED.pCollision };
const nc3 = runExperiment({ scenario: SC_EX, n: N, seed: 7, assistArrivalS: 60, overrides: { latencyOverride: { DGT30_NAVIGATOR: 5000, SENDA_APP: 5000 } } }).summary;
nc.NC3_latency_beyond_event_no_benefit = { A: nc3.A_NO_DIGITAL.pCollision, C: nc3.C_AUTHORIZED_ROAD_CHANNEL.pCollision, D: nc3.D_SENDA_VERIFIED.pCollision, pass: nc3.D_SENDA_VERIFIED.pCollision === nc3.A_NO_DIGITAL.pCollision };
// NC4: avisos tardíos mostrados sin política ⇒ pueden AUMENTAR el riesgo (distracción)
const nc4 = runExperiment({ scenario: SC_EX, n: N, seed: 7, displayRangeM: 50, overrides: { shareOverride: { DGT30_NAVIGATOR: 0.9, SENDA_APP: 0.9 }, acceptanceRange: [0.9, 0.9] } }).summary; // todos los avisos llegan tarde (< minLead)
nc.NC4_late_warning_harm = { A: nc4.A_NO_DIGITAL.pCollision, C_noPolicy: nc4.C_AUTHORIZED_ROAD_CHANNEL.pCollision, D_policy: nc4.D_SENDA_VERIFIED.pCollision, lateShownC: nc4.C_AUTHORIZED_ROAD_CHANNEL.lateWarningsShown, lateSuppressedD: nc4.D_SENDA_VERIFIED.lateWarningsSuppressed, harmObserved: nc4.C_AUTHORIZED_ROAD_CHANNEL.pCollision > nc4.A_NO_DIGITAL.pCollision, policyAvoidsHarm: nc4.D_SENDA_VERIFIED.pCollision <= nc4.A_NO_DIGITAL.pCollision };
E.negativeControls = nc;

// 7) H-ROAD-2: corroboración falsa con fuentes derivadas (V16 → DGT 3.0 → navegador)
function hroad2(seed = 3, episodes = 2000) {
  const r = rng(seed); const tally = { naive: { fp: 0, tp: 0 }, causal: { fp: 0, tp: 0 }, pos: 0, neg: 0 };
  for (let i = 0; i < episodes; i++) {
    const real = r() < 0.5; real ? tally.pos++ : tally.neg++;
    // Falso: V16 activada por error (o prueba) y reflejada en DGT 3.0 y en un navegador; a veces un toque erróneo.
    // Real: misma cadena V16 + con prob. 0,4 un conductor independiente lo confirma + con prob. 0,2 DATEX II.
    const obs = [{ obsId: 'a', source: 'V16_BEACON', rootHint: 'b' + i, at: 0 }, { obsId: 'b', source: 'DGT30_V16', rootHint: 'b' + i, at: 30 }, { obsId: 'c', source: 'NAVIGATOR_FROM_DGT30', rootHint: 'b' + i, at: 60 }];
    if (real && r() < 0.4) obs.push({ obsId: 'd', source: 'SENDA_CITIZEN_REPORT', reporterId: 'u' + i, at: 90 });
    if (real && r() < 0.2) obs.push({ obsId: 'e', source: 'DATEX2_NAP', at: 120 });
    if (!real && r() < 0.05) obs.push({ obsId: 'f', source: 'SENDA_CITIZEN_REPORT', reporterId: 'x' + i, at: 90 });
    for (const m of ['naive', 'causal']) { const f = fuseRoadEvidence(obs, { now: 150, naive: m === 'naive' }); if (f.status === 'CORROBORATED') real ? tally[m].tp++ : tally[m].fp++; }
  }
  const rate = (m) => ({ falseCorroborationRate: +(tally[m].fp / tally.neg).toFixed(4), sensitivity: +(tally[m].tp / tally.pos).toFixed(4) });
  return { episodes, naive: rate('naive'), causal: rate('causal'), note: 'Episodios sintéticos con proporciones HIPOTÉTICAS; mide el efecto del doble conteo, no la tasa real de falsas alarmas.' };
}
E.H_ROAD_2_double_counting = hroad2();

// 8) H-ROAD-3: afirmaciones falsas de «en camino / en el lugar» con fallos de proveedor
async function hroad3() {
  const faults = [{}, { timeout: true }, { http5xx: true }, { ackWithoutRef: true }, { outOfOrder: true }, { duplicateEvents: true }, { neverArrives: true }];
  const rows = [];
  for (const f of faults) {
    const sim = createContractSimulator({ providerId: 'TOW-A', kind: 'TOW', faults: f, etaS: 1200 });
    const orch = createDispatchOrchestrator({ incidentId: 'RS-x' });
    const r = await orch.request(sim, { serviceId: 's1', kind: 'TOW', payload: {}, now: 0 });
    let applied = 0;
    if (r.service.reference) for (const ev of sim.eventsFor(r.service.reference, 0)) { const u = orch.updateStatus('s1', { ...ev, authenticated: true }); if (u.ok && !u.duplicate) applied++; }
    const delays = orch.checkDelays(4000);
    const naiveClaimsDispatched = r.service.history.some((h) => h.state === 'TRANSPORT_ACCEPTED'); // ingenuo: 2xx = «grúa enviada»
    const s = r.service;
    rows.push({ faults: Object.keys(f).join('+') || 'none', finalState: s.state, reference: s.reference, flags: s.flags, applied, delayAlerts: delays.map((d) => d.issue), naiveWouldClaimDispatched: naiveClaimsDispatched, contractClaimsOnScene: ['ON_SCENE_REPORTED', 'ON_SCENE_CONFIRMED'].includes(s.state) });
  }
  return { rows, note: 'Banco de pruebas contractual (simulado). Mide si el orquestador afirma más de lo que el proveedor confirmó.' };
}
E.H_ROAD_3_partial_failures = await hroad3();

E.circumstances = circumstanceGrid({ scenario: SC_EX, n: N, seed: 2026 });
writeFileSync(resolve(outDir, 'roadsafe-experiments.json'), JSON.stringify(results, null, 2));

// Resumen markdown
const L = [];
L.push('# RoadSafe · Resultados de simulación (reproducibles)', '', `Generado por \`packages/senda/scripts/roadsafe-experiment.mjs\` con N=${N} por escenario y semillas fijas.`, '', '> **Simulación con parámetros declarados. No demuestra reducción real de accidentes.** Procedencia de cada parámetro en `roadsafe-experiments.json → provenance`.', '');
L.push('## 1. Escenarios A–E (base: visibilidad 250 m, llegada del taxi 300–2400 s tras la V16)', '', '| Escenario | P(alcance) [IC95] | P(taxi→furgoneta) | Impacto p50/p95 km/h | Cobertura efectiva | Latencia p50/p95 s | Antelación p50 s | Falsas alarmas | Acuse de visualización |', '|---|---|---|---|---|---|---|---|---|');
for (const [k, v] of Object.entries(E.baseline)) L.push(`| ${SCENARIOS[k].label} | ${v.pCollision} [${v.ci.join(', ')}] | ${v.pSecondary} | ${v.impactP50 ?? '—'}/${v.impactP95 ?? '—'} | ${v.coverage} | ${v.latencyP50 ?? '—'}/${v.latencyP95 ?? '—'} | ${v.leadP50 ?? '—'} | ${v.falseAlarmRate} | ${v.confirmedDisplayAck} |`);
L.push('', '## 2. Visibilidad efectiva (m) — P(alcance)', '', 'En seguimiento de vehículos la visibilidad solo limita cuando es menor que la separación (≈ headway·v): niebla densa.', '', '| sight | A | B | C | D | E |', '|---|---|---|---|---|---|');
for (const [s, v] of Object.entries(E.visibility)) L.push(`| ${s} | ${v.A_NO_DIGITAL.pCollision} | ${v.B_V16_INFORMATIVE.pCollision} | ${v.C_AUTHORIZED_ROAD_CHANNEL.pCollision} | ${v.D_SENDA_VERIFIED.pCollision} | ${v.E_SENDA_DEGRADED.pCollision} |`);
L.push('', '## 3. Adopción de SENDA (visibilidad 100 m, canal DGT→navegador anulado)', '', '| cuota | A | D | cobertura D |', '|---|---|---|---|');
for (const [s, v] of Object.entries(E.adoption)) L.push(`| ${s} | ${v.A_NO_DIGITAL.pCollision} | ${v.D_SENDA_VERIFIED.pCollision} | ${v.D_SENDA_VERIFIED.coverage} |`);
L.push('', '## 4. Latencia del canal autorizado (taxi llega 120 s tras la V16; visibilidad 100 m)', '', '| latencia s | A | C | cobertura C | avisos tardíos mostrados |', '|---|---|---|---|---|');
for (const [s, v] of Object.entries(E.latency)) L.push(`| ${s} | ${v.A_NO_DIGITAL.pCollision} | ${v.C_AUTHORIZED_ROAD_CHANNEL.pCollision} | ${v.C_AUTHORIZED_ROAD_CHANNEL.coverage} | ${v.C_AUTHORIZED_ROAD_CHANNEL.lateShown} |`);
L.push('', '## 5. Distancia temporal (s) — A vs D', '', '| headway | A | D |', '|---|---|---|');
for (const [s, v] of Object.entries(E.headway)) L.push(`| ${s} | ${v.A_NO_DIGITAL.pCollision} | ${v.D_SENDA_VERIFIED.pCollision} |`);
L.push('', '## 6. Controles negativos', '', '```json', JSON.stringify(E.negativeControls, null, 2), '```');
L.push('', '## 7. H-ROAD-2 — doble conteo de fuentes derivadas', '', '```json', JSON.stringify(E.H_ROAD_2_double_counting, null, 2), '```');
L.push('', '## 8. H-ROAD-3 — fallos parciales de proveedor (banco contractual)', '', '| fallo | estado final | referencia | marcas | «enviada» ingenuo | «en el lugar» contrato |', '|---|---|---|---|---|---|');
for (const r of E.H_ROAD_3_partial_failures.rows) L.push(`| ${r.faults} | ${r.finalState} | ${r.reference ?? '—'} | ${r.flags.join(', ') || '—'} | ${r.naiveWouldClaimDispatched} | ${r.contractClaimsOnScene} |`);
L.push('', '## 9. Probabilidad condicionada por circunstancia (simulada; A sin aviso vs D SENDA)', '', '| Circunstancia | P(alcance) A [IC95] | × base | P(empuje) A | impacto p95 km/h | P(alcance) D |', '|---|---|---|---|---|---|');
for (const r of E.circumstances.rows) L.push(`| ${r.label} | ${r.pA} [${r.ciA.join(', ')}] | ${r.relativeToBase} | ${r.pSecA} | ${r.impactP95A ?? '—'} | ${r.pD} |`);
writeFileSync(resolve(outDir, 'ROADSAFE_RESULTS.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
