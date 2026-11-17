import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaseGrid, cumulativeMask, causalHrrrAt, signedDistanceFromMask,
  areaMatchedIsotropic, maskScores, bootstrapMeanCi, evaluateGoesCase,
} from '../src/goes-case-eval.mjs';

const frames = [
  { t: '2025-01-01T10:00:00Z', det: [[34.0, -118.0, 100]] },
  { t: '2025-01-01T12:00:00Z', det: [[34.0, -118.0, 100], [34.0, -117.97, 80]] },
  { t: '2025-01-01T14:00:00Z', det: [[34.0, -117.94, 60]] },
  { t: '2025-01-01T17:00:00Z', det: [[34.0, -117.90, 60]] },
];

test('causal HRRR gate never returns a sample unavailable at t0', () => {
  const hrrr = [
    { validUTC: '2025-01-01T10:00Z', u10: 1, v10: 0 },
    { validUTC: '2025-01-01T11:00Z', u10: 2, v10: 0 },
  ];
  const t0 = Date.parse('2025-01-01T11:30:00Z');
  const s = causalHrrrAt(hrrr, t0);
  assert.equal(s.u10, 1); // 11:00 sample only available at 12:00
  assert.ok(s.availableAtMs <= t0);
  assert.equal(causalHrrrAt(hrrr, Date.parse('2025-01-01T10:30:00Z')), null);
});

test('cumulative mask is monotone in time and excludes future frames', () => {
  const geo = buildCaseGrid(frames);
  const a = cumulativeMask(frames, geo, Date.parse('2025-01-01T11:00:00Z'));
  const b = cumulativeMask(frames, geo, Date.parse('2025-01-01T15:00:00Z'));
  let na = 0, nb = 0;
  for (let k = 0; k < a.length; k++) { na += a[k]; nb += b[k]; if (a[k]) assert.equal(b[k], 1); }
  assert.ok(nb > na);
});

test('area-matched isotropic keeps base and requested area; persistence growth CSI is zero', () => {
  const w = 10, h = 10, mask = new Uint8Array(100); mask[55] = 1;
  const phi = signedDistanceFromMask(mask, w, h, 1000);
  const iso = areaMatchedIsotropic(phi, w, h, 9);
  assert.equal(iso.reduce((a, v) => a + v, 0), 9);
  assert.equal(iso[55], 1);
  const obs = Uint8Array.from(mask); obs[56] = 1;
  assert.equal(maskScores(mask, obs, mask).growthCsi, 0);
});

test('bootstrap CI is deterministic and brackets the mean', () => {
  const a = bootstrapMeanCi([0.1, -0.05, 0.2, 0.0]);
  const b = bootstrapMeanCi([0.1, -0.05, 0.2, 0.0]);
  assert.deepEqual(a, b);
  assert.ok(a.lo <= a.mean && a.mean <= a.hi);
});

test('evaluateGoesCase abstains without causal HRRR and never authorizes warnings', () => {
  const ev = evaluateGoesCase({ frames, hrrr: [] }, { horizonH: 3 });
  assert.ok(ev.origins.length > 0);
  assert.ok(ev.origins.every((o) => o.status === 'ABSTAIN' && o.reason === 'NO_CAUSAL_HRRR'));
});
