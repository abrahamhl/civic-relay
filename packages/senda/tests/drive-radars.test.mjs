import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isAllowedOfficialControl, radarsAhead, createSectionTracker } from '../src/drive-radars.mjs';
import { bearingDeg } from '../src/drive-corridor.mjs';

const snapPath = new URL('../../../investor-next/public/senda/data/referencias/dgt_radares_oficiales.json', import.meta.url);
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));

test('radares oficiales España: todo el snapshot real (1126 puntos + 60 tramos) pasa la puerta legal y rechaza controles móviles/RF', () => {
  assert.equal(snap.totalPuntos, 1126);
  assert.equal(snap.totalTramos, 60);
  for (const p of snap.puntos) {
    assert.equal(isAllowedOfficialControl(p), true, `punto rechazado: ${p.id}`);
  }
  for (const s of snap.tramos) {
    assert.equal(isAllowedOfficialControl({ kind: 'stretch', src: s.src }), true, `tramo rechazado: ${s.id}`);
  }
  // Puerta legal dura contra controles policiales móviles, avisos no anunciados o detectores RF
  assert.equal(isAllowedOfficialControl({ kind: 'mobile', src: 'dgt' }), false);
  assert.equal(isAllowedOfficialControl({ kind: 'fixed', src: 'police_crowd' }), false);
  assert.equal(isAllowedOfficialControl({ kind: 'rf_detector', src: 'dgt' }), false);
  assert.equal(isAllowedOfficialControl({ kind: 'camuflado', src: 'dgt' }), false);
  assert.equal(isAllowedOfficialControl({ kind: 'fixed', src: 'unknown_source' }), false);
});

test('radarsAhead sobre snapshot real: detecta radar oficial por delante y descarta la calzada contraria por rumbo', () => {
  // Radar real euskadi-aiurdin: bearing 126°, maxspeed 120 km/h, lon -2.77623, lat 42.94286
  const target = snap.puntos.find((p) => p.id === 'euskadi-aiurdin');
  assert.ok(target);
  // Posición ~500 m antes (rumbo inverso 306° desde el radar)
  const rad = (126 + 180) * Math.PI / 180;
  const distDegLat = (500 * Math.cos(rad)) / 111320;
  const distDegLon = (500 * Math.sin(rad)) / (111320 * Math.cos(target.lat * Math.PI / 180));
  const approachPos = [target.lon + distDegLon, target.lat + distDegLat];

  // Circulando en sentido correcto (126°) a 130 km/h (36.11 m/s) -> avisa y marca overLimit=true
  const fwd = radarsAhead({ pos: approachPos, headingDeg: 126, speedMs: 130 / 3.6, points: snap.puntos });
  assert.ok(fwd.top, 'debe avisar en el sentido publicado');
  assert.equal(fwd.top.id, 'euskadi-aiurdin');
  assert.equal(fwd.top.maxspeed, 120);
  assert.equal(fwd.top.overLimit, true);
  assert.ok(fwd.top.distM >= 450 && fwd.top.distM <= 550);

  // Circulando en sentido contrario (306°, calzada opuesta) desde el otro lado -> NO debe alertar de ese radar
  const oppPos = [target.lon - distDegLon, target.lat - distDegLat];
  const opp = radarsAhead({ pos: oppPos, headingDeg: 306, speedMs: 120 / 3.6, points: snap.puntos });
  assert.equal(opp.items.some((r) => r.id === 'euskadi-aiurdin'), false, 'no debe alertar de la calzada contraria');
});

test('createSectionTracker sobre tramo oficial real (madrid-28, 50 km/h): calcula velocidad media exacta Δs/Δt', () => {
  const tramo = snap.tramos.find((t) => t.id === 'madrid-28');
  assert.ok(tramo);
  const tracker = createSectionTracker(snap.tramos);
  const brg = bearingDeg(tramo.from, tramo.to);

  // Entrada en el pórtico inicial a t=0
  const s0 = tracker.update({ pos: tramo.from, tMs: 0, headingDeg: brg, speedMs: 16 });
  assert.ok(s0);
  assert.equal(s0.id, 'madrid-28');
  assert.equal(s0.maxspeed, 50);

  // Punto medio a t=25 s (~515 m en 25 s -> ~74 km/h > 50 km/h)
  const mid = [(tramo.from[0] + tramo.to[0]) / 2, (tramo.from[1] + tramo.to[1]) / 2];
  const sMid = tracker.update({ pos: mid, tMs: 25_000, headingDeg: brg, speedMs: 18 });
  assert.ok(sMid.avgKmh > 60);
  assert.equal(sMid.overAverage, true);
  assert.equal(sMid.finished, false);

  // Llegada al pórtico final a t=80 s (~1030 m en 80 s -> ~46.3 km/h <= 50 km/h)
  const sEnd = tracker.update({ pos: tramo.to, tMs: 80_000, headingDeg: brg, speedMs: 12 });
  assert.equal(sEnd.finished, true);
  assert.equal(sEnd.overAverage, false);
  assert.ok(sEnd.avgKmh > 40 && sEnd.avgKmh < 50);
  assert.equal(tracker.active, null);
});
