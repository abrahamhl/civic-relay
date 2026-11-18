import test from 'node:test';
import assert from 'node:assert/strict';
import { sightDistanceAlong, requiredDecel, maxSpeedToStopWithin, physicalUrgency, urgencyPhrase } from '../src/roadsafe-drive-physics.mjs';
import { createAttentionPlanner } from '../src/roadsafe-attention.mjs';

// Vías sintéticas (geometría, no datos): recta y arco circular de radio R.
const LAT0 = 40, LON0 = -3, KX = 111_320 * Math.cos((LAT0 * Math.PI) / 180), KY = 110_574;
const ll = (x, y) => ({ lat: LAT0 + y / KY, lon: LON0 + x / KX });
const straight = { id: 'RECTA', points: Array.from({ length: 41 }, (_, k) => ll(k * 50, 0)) };
const arc = (R, lenM, step = 5) => ({ id: `ARCO-${R}`, points: Array.from({ length: Math.floor(lenM / step) + 1 }, (_, k) => { const th = (k * step) / R; return ll(R * Math.sin(th), R - R * Math.cos(th)); }) });
const fixAt = (road, i) => { const p = road.points[i], q = road.points[i + 1]; return { lat: p.lat, lon: p.lon, headingDeg: (Math.atan2((q.lon - p.lon) * KX, (q.lat - p.lat) * KY) * 180 / Math.PI + 360) % 360, speedMs: 25 }; };

test('visibilidad: en recta llega al horizonte de cálculo; parámetros obligatorios', () => {
  const r = sightDistanceAlong(straight, fixAt(straight, 0), { clearanceM: 5, maxM: 800, stepM: 10 });
  assert.equal(r.sightM, 800); assert.equal(r.limitedBy, 'HORIZONTE_DE_CALCULO');
  assert.throws(() => sightDistanceAlong(straight, fixAt(straight, 0), { maxM: 800, stepM: 10 }), /clearanceM/);
});

test('visibilidad: en curva circular coincide con la fórmula de la ordenada media S = 2R·acos(1 − M/R)', () => {
  for (const [R, M] of [[200, 6], [400, 8], [800, 5]]) {
    const road = arc(R, 1500);
    const r = sightDistanceAlong(road, fixAt(road, 0), { clearanceM: M, maxM: 1400, stepM: 2 });
    const S = 2 * R * Math.acos(1 - M / R);
    assert.ok(Math.abs(r.sightM - S) <= 0.03 * S + 4, `R=${R} M=${M}: numérico ${r.sightM} vs analítico ${S.toFixed(1)}`);
    assert.equal(r.limitedBy, 'TRAZADO');
  }
});

test('deceleración necesaria y velocidad máxima son inversas', () => {
  const v = maxSpeedToStopWithin({ distM: 120, reactS: 1.5, decelMs2: 6, marginM: 0 });
  assert.ok(Math.abs(requiredDecel({ vMs: v, distM: 120, reactS: 1.5, marginM: 0, hazardSpeedMs: 0 }) - 6) < 1e-6);
  assert.equal(requiredDecel({ vMs: 30, distM: 30, reactS: 1.5, marginM: 0, hazardSpeedMs: 0 }), Infinity, 'sin espacio tras reaccionar');
  assert.equal(requiredDecel({ vMs: 20, distM: 50, reactS: 1.5, marginM: 0, hazardSpeedMs: 25 }), 0, 'el peligro se aleja más rápido');
  assert.throws(() => requiredDecel({ vMs: 20, distM: 50, marginM: 0, hazardSpeedMs: 0 }), /reactS/);
});

// Política de ejemplo DECLARADA para las pruebas (no son valores medidos).
const POL = { reactS: 1.5, marginM: 10, mu: 0.4, comfortDecelMs2: 3, prepareDecelMs2: 1 };
const it = (warningId, kind, aheadM, extra = {}) => ({ warningId, kind, ceiling: 'ADVISORY', aheadM, etaS: Math.round(aheadM / 30), ...extra });

test('urgencia física: inminente, frenar, preparar, informar; oculto tras la curva con velocidad aconsejada', () => {
  const u = physicalUrgency([it('a', 'ACCIDENT', 60), it('b', 'ACCIDENT', 200), it('c', 'ROADWORKS', 400), it('d', 'ROADWORKS', 1500)], { vMs: 30, sightM: 150 }, POL);
  assert.deepEqual(u.map((x) => x.urgency), ['IMMINENT', 'BRAKE', 'PREPARE', 'INFO']);
  assert.equal(u[0].cannotStop, true);
  assert.equal(u[1].hidden, true); assert.ok(u[1].adviseMaxKmh > 0 && u[1].adviseMaxKmh < 108);
  assert.equal(u[3].hidden, false, 'muy lejos: no es «oculto», aún hay tiempo');
  assert.equal(urgencyPhrase(u[0], 'es'), 'Frena ya');
  assert.match(urgencyPhrase({ ...u[2], hidden: true, adviseMaxKmh: 70 }, 'en'), /Hidden hazard.*70/);
  assert.throws(() => physicalUrgency([], { vMs: 30 }, { ...POL, mu: undefined }), /mu/);
});

test('cola que avanza: se usa la velocidad relativa', () => {
  const [q] = physicalUrgency([it('q', 'QUEUE_TAIL', 150, { hazardSpeedMs: 20 })], { vMs: 30 }, POL);
  const [s] = physicalUrgency([it('s', 'QUEUE_TAIL', 150)], { vMs: 30 }, POL);
  assert.ok(q.dracMs2 < s.dracMs2);
});

test('atención: la urgencia física manda, no se raciona y rescata lo tardío si está oculto', () => {
  const p = createAttentionPlanner({ tMinS: 8, tMaxS: 600, budgetPerWindow: 1, windowS: 300, minGapS: 30 });
  const items = physicalUrgency([it('obras', 'ROADWORKS', 900, { ceiling: 'WARNING' }), it('choque', 'ACCIDENT', 70)], { vMs: 30, sightM: 400 }, POL);
  const r1 = p.next(items, 0);
  assert.equal(r1.speak.warningId, 'choque'); assert.equal(r1.bypass, 'URGENCIA_FISICA');
  // presupuesto agotado y separación mínima: aun así, un segundo peligro inminente se dice
  const r2 = p.next(physicalUrgency([it('gente', 'PEOPLE_ON_ROAD', 50)], { vMs: 30, sightM: 400 }, POL), 2);
  assert.equal(r2.speak.warningId, 'gente');
  // tardío (eta < tMinS) pero oculto: se rescata
  const r3 = createAttentionPlanner({ tMinS: 8, tMaxS: 600, budgetPerWindow: 3, windowS: 300, minGapS: 0 }).next([{ ...it('x', 'OBSTACLE', 150), etaS: 5, hidden: true, urgency: 'PREPARE' }], 0);
  assert.equal(r3.speak?.warningId, 'x');
});
