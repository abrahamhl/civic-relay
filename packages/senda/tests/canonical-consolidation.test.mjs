import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EPISTEMIC_STATUS,
  normalizeEpistemicLabel,
  createEvidenceContractRecord,
  assessForecastSkillGate,
  summarizeEvidenceLineage,
  assessCanonicalRouteGate,
  registerRoutingComparator,
  listRoutingComparators,
  planCanonicalRoute,
  compareCanonicalRoutes,
} from '../src/index.mjs';
import { assessModelRoute } from '../../../experimental/senda-route-truth/route-truth.mjs';
import { buildProblem, planAdaptiveResilience } from '../../../experimental/senda-arr/src/arr-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');

test('evidence-contract: normalizes epistemic labels and never unlocks canPublicWarn from simulation or unanchored data', () => {
  assert.equal(normalizeEpistemicLabel('observed'), EPISTEMIC_STATUS.OBSERVADO);
  assert.equal(normalizeEpistemicLabel('SIMULATION'), EPISTEMIC_STATUS.SIMULADO);
  assert.equal(normalizeEpistemicLabel('model_forecast'), EPISTEMIC_STATUS.PREDICHO);
  assert.equal(normalizeEpistemicLabel('hypothesis'), EPISTEMIC_STATUS.HIPOTESIS);
  assert.equal(normalizeEpistemicLabel(''), EPISTEMIC_STATUS.NO_VERIFICADO);

  const rec = createEvidenceContractRecord({
    basis: 'OBSERVED',
    source: 'USGS_NEIC',
    observationTime: '2026-11-17T06:00:00Z',
    downloadTime: '2026-11-17T06:15:00Z',
    institutionalAnchorVerified: true,
  });
  assert.equal(rec.basis, 'OBSERVADO');
  assert.equal(rec.ageMs, 900_000);
  assert.equal(rec.canPublicWarn, false);

  const simRec = createEvidenceContractRecord({
    basis: 'SIMULATED',
    source: 'WILDFIRE_SYNTHETIC',
    institutionalAnchorVerified: true,
  });
  assert.equal(simRec.experimentalOnly, true);
  assert.equal(simRec.institutionalAnchorVerified, false);
  assert.equal(simRec.canPublicWarn, false);
});

test('evidence-contract: H2 forecast failing persistence baseline is quarantined as EXPERIMENTAL_REJECTED with canPublicWarn=false', () => {
  const h2 = assessForecastSkillGate({
    modelId: 'H2',
    modelBrier: 0.145,
    persistenceBrier: 0.102,
    biasPp: -7.0,
    heldOutUnits: 36,
    operationalFieldValidated: false,
  });
  assert.equal(h2.status, 'EXPERIMENTAL_REJECTED');
  assert.equal(h2.beatsPersistenceBaseline, false);
  assert.equal(h2.experimentalOnly, true);
  assert.equal(h2.canPublicWarn, false);
  assert.match(h2.warning, /RECHAZADO|experimental|avisos públicos/i);

  const futureH3 = assessForecastSkillGate({
    modelId: 'H3',
    modelBrier: 0.08,
    persistenceBrier: 0.12,
    heldOutUnits: 50,
    operationalFieldValidated: false,
  });
  assert.equal(futureH3.status, 'EXPERIMENTAL_SCIENTIFIC_ONLY');
  assert.equal(futureH3.beatsPersistenceBaseline, true);
  assert.equal(futureH3.experimentalOnly, true);
  assert.equal(futureH3.canPublicWarn, false);
});

test('evidence-contract: summarizeEvidenceLineage detects upstream GDACS/USGS/FIRMS dependencies', () => {
  const summary = summarizeEvidenceLineage(['GDACS_EQ', 'USGS_NEIC', 'COPERNICUS_EMS_RAPID']);
  assert.equal(summary.knownInGraph, 3);
  const gdacsUsgs = summary.pairs.find((p) => p.a === 'GDACS_EQ' && p.b === 'USGS_NEIC');
  assert.equal(gdacsUsgs.independent, false);
  const usgsCems = summary.pairs.find((p) => p.a === 'USGS_NEIC' && p.b === 'COPERNICUS_EMS_RAPID');
  assert.equal(usgsCems.independent, true);
});

test('routing-canonical: differential parity with route-truth assessModelRoute across fail-closed gates', () => {
  const baseNodes = [
    { id: 'A', role: 'SENDER', consent: true, powered: true, radioEnabled: true },
    { id: 'R', role: 'RELAY', consent: true, powered: true, radioEnabled: true },
    { id: 'B', role: 'RECEIVER', consent: true, powered: true, radioEnabled: true },
  ];
  const baseLinks = [
    { from: 'A', to: 'R', kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true },
    { from: 'R', to: 'B', kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true },
  ];

  const truthOk = assessModelRoute({ nodes: baseNodes, links: baseLinks, source: 'A', destination: 'B' });
  const canonOk = assessCanonicalRouteGate({ nodes: baseNodes, links: baseLinks, source: 'A', destination: 'B' });
  assert.equal(canonOk.modelReachable, truthOk.modelReachable);
  assert.equal(canonOk.reason, truthOk.reason);
  assert.deepEqual(canonOk.path, truthOk.path);
  assert.equal(canonOk.physicalDeliveryVerified, false);
  assert.equal(canonOk.canPublicWarn, false);

  const passiveLinks = [
    { from: 'A', to: 'R', kind: 'PASSIVE_RIS_REFLECTION', authorized: true, enabled: true, dutyCycleAllowed: true },
    { from: 'R', to: 'B', kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true },
  ];
  const truthPassive = assessModelRoute({ nodes: baseNodes, links: passiveLinks, source: 'A', destination: 'B' });
  const canonPassive = assessCanonicalRouteGate({ nodes: baseNodes, links: passiveLinks, source: 'A', destination: 'B' });
  assert.equal(canonPassive.modelReachable, false);
  assert.equal(canonPassive.modelReachable, truthPassive.modelReachable);
  assert.equal(canonPassive.rejectedLinks.NOT_ACTIVE_RADIO, 1);

  const unknownRoleNodes = baseNodes.map((n) => n.id === 'R' ? { ...n, role: 'REPEATER_TYPO' } : n);
  assert.equal(assessCanonicalRouteGate({ nodes: unknownRoleNodes, links: baseLinks, source: 'A', destination: 'B' }).modelReachable, false);
});

test('routing-canonical: executes CGR, DELIVERY_ASSURANCE, SRLG_CUTS and registered ARR comparator under single contract', async () => {
  registerRoutingComparator('ARR_ENSEMBLE', ({ nodes, contacts, source, destination, startMs, deadlineMs, payloadBytes, k, ensemble }) => {
    const problem = buildProblem({ nodes, contacts, source, destination, startMs, deadlineMs, payloadBytes });
    const plan = planAdaptiveResilience({ problem, ensemble, maxReplicas: k });
    return {
      basis: 'SIMULADO',
      status: plan.routes.length ? 'ARR_PLAN_COMPUTED' : 'NO_ARR_ROUTE',
      routes: plan.routes,
      explanation: `ARR K=${plan.routes.length} p_ens=${plan.predicted.ensembleProbability.toFixed(3)}`,
    };
  });
  assert.ok(listRoutingComparators().includes('ARR_ENSEMBLE'));

  const contacts = [
    { id: 'c1', from: 'A', to: 'B', channel: 'LORA', start: 0, end: 1200, confidence: 0.8 },
    { id: 'c2', from: 'A', to: 'R', channel: 'BLE', start: 0, end: 1200, confidence: 0.7 },
    { id: 'c3', from: 'R', to: 'B', channel: 'LORA', start: 60, end: 1200, confidence: 0.85 },
  ];
  const cgr = await planCanonicalRoute({ engine: 'CGR', contacts, source: 'A', dest: 'B', t0: 0, sizeBytes: 120, k: 2 });
  assert.equal(cgr.status, 'DELIVERABLE');
  assert.equal(cgr.physicalDeliveryVerified, false);
  assert.equal(cgr.canPublicWarn, false);

  const arrOut = await planCanonicalRoute({
    engine: 'ARR_ENSEMBLE',
    adapterInput: {
      nodes: [
        { id: 'A', role: 'SENDER', consent: true, powered: true, radioEnabled: true },
        { id: 'B', role: 'RECEIVER', consent: true, powered: true, radioEnabled: true },
      ],
      contacts: [
        { id: 'k1', from: 'A', to: 'B', kind: 'ACTIVE_RADIO', authorized: true, enabled: true, dutyCycleAllowed: true, startMs: 0, endMs: 600_000, rateBytesPerSec: 1000, handshakeMs: 50, energyMj: 20, probabilityLowerBound: 0.75 },
      ],
      source: 'A',
      destination: 'B',
      startMs: 0,
      deadlineMs: 600_000,
      payloadBytes: 120,
      k: 1,
      ensemble: [{ nodeDeathMs: {} }],
    },
  });
  assert.equal(arrOut.status, 'ARR_PLAN_COMPUTED');
  assert.equal(arrOut.canPublicWarn, false);

  const srlg = await planCanonicalRoute({
    engine: 'SRLG_CUTS',
    srlgInput: {
      links: [
        { id: 'l1', riskDomains: ['TOWER_1', 'POWER_GRID_A'] },
        { id: 'l2', riskDomains: ['TOWER_2', 'POWER_GRID_A'] },
      ],
      paths: [
        { id: 'p1', linkIds: ['l1'], endpointRiskDomains: ['SRC_DEV', 'DST_DEV'], consentDeclared: true, linkAuthorizedDeclared: true },
        { id: 'p2', linkIds: ['l2'], endpointRiskDomains: ['SRC_DEV', 'DST_DEV'], consentDeclared: true, linkAuthorizedDeclared: true },
      ],
      requiredSurvivingPaths: 1,
      maxSimultaneousFailures: 2,
    },
  });
  assert.equal(srlg.status, 'CUT_VULNERABILITY_DETECTED');

  const cmp = await compareCanonicalRoutes(['CGR', 'DELIVERY_ASSURANCE'], {
    contacts,
    source: 'A',
    dest: 'B',
    t0: 0,
    sizeBytes: 120,
    availableBearers: [{ id: 'MESHTASTIC' }, { id: 'SAT_D2C_SMS' }],
    assuranceOptions: { scenarios: { NOW: { prob: 1 } }, effort: 'fast', budgetEUR: 0 },
  });
  assert.equal(cmp.comparisons.length, 2);
});

test('sync-web parity: synced core modules and ARR modules match source byte-for-byte', () => {
  for (const mod of ['evidence-contract.mjs', 'routing-canonical.mjs', 'resilience-council.mjs', 'failure-domain-cuts.mjs', 'hazard-reports.mjs', 'source-evidence.mjs']) {
    const a = readFileSync(resolve(ROOT, 'packages/senda/src', mod));
    const b = readFileSync(resolve(ROOT, 'investor-next/public/senda/core', mod));
    assert.deepEqual(a, b, `core parity mismatch for ${mod}`);
  }
  for (const arrMod of ['arr-core.mjs', 'arr-sim.mjs', 'arr-forecast.mjs']) {
    const a = readFileSync(resolve(ROOT, 'experimental/senda-arr/src', arrMod));
    const b = readFileSync(resolve(ROOT, 'investor-next/public/senda/arr', arrMod));
    assert.deepEqual(a, b, `arr parity mismatch for ${arrMod}`);
  }
});
