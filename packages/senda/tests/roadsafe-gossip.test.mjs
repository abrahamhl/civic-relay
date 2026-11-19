import test from 'node:test';
import assert from 'node:assert/strict';
import { helloOf, selectForPeer, acceptFromPeer, wireOf } from '../src/roadsafe-gossip.mjs';
import { makeWarning, createWarningBus } from '../src/roadsafe-warning-bus.mjs';
import { demoRoad, pointAt, roadLocate } from '../src/road-guard.mjs';

const now = 2_000_000;
const { road } = demoRoad();
const bearing = (a, b) => { const t = Math.PI / 180, y = Math.sin((b.lon - a.lon) * t) * Math.cos(b.lat * t), x = Math.cos(a.lat * t) * Math.sin(b.lat * t) - Math.sin(a.lat * t) * Math.cos(b.lat * t) * Math.cos((b.lon - a.lon) * t); return (Math.atan2(y, x) / t + 360) % 360; };
/** Vehículo en s, sentido +1 (creciente en la geometría) o −1. */
const fixAt = (s, dir) => { const p = pointAt(road, s), q = pointAt(road, s + 30 * dir); return { lat: p.lat, lon: p.lon, headingDeg: bearing(p, q), speedMs: 30 }; };
const OPTS = { now, road, maxBytes: 2000, maxHops: 4, carryMinTrust: 'SIGNED_PEER', maxOffRoadM: 60 };

function busWith(list) {
  const bus = createWarningBus({ mergeM: 300 });
  for (const [i, o] of list.entries()) { const p = pointAt(road, o.s); bus.ingest(makeWarning({ kind: o.kind, lat: p.lat, lon: p.lon, roadId: road.id, dir: o.dir, validFrom: now - 10, validUntil: now + 600, trust: o.trust, lineage: [{ source: `t${i}`, root: `R${i}` }] }), { now }); }
  return bus.active(now);
}

test('HELLO: sin identificador personal, solo vía, sentido, posición y resumen', () => {
  const h = helloOf(fixAt(5000, 1), road, ['W-abcdef0123456789']);
  assert.deepEqual(Object.keys(h).sort(), ['crossM', 'digest', 'dir', 'roadId', 's', 'schema']);
  assert.deepEqual(h.digest, ['abcdef01']);
  assert.equal(roadLocate(fixAt(5000, -1), road).dir, -1);
});

test('papeles: por delante = CONSUMIDOR; contrario por detrás = PORTADOR; contrario por delante y propio por detrás = nada', () => {
  const dirPlus = roadLocate(fixAt(5000, 1), road).dir, dirMinus = -dirPlus;
  const ws = busWith([
    { s: 8000, dir: dirPlus, kind: 'ACCIDENT', trust: 'OFFICIAL_FEED' },      // delante, mismo sentido
    { s: 2000, dir: dirMinus, kind: 'QUEUE_TAIL', trust: 'SIGNED_PEER' },     // detrás, contrario → portador
    { s: 9000, dir: dirMinus, kind: 'ROADWORKS', trust: 'OFFICIAL_FEED' },    // delante, contrario → nada
    { s: 1000, dir: dirPlus, kind: 'OBSTACLE', trust: 'OFFICIAL_FEED' },      // detrás, mismo sentido → nada
  ]);
  const r = selectForPeer(ws, helloOf(fixAt(5000, 1), road), OPTS);
  assert.deepEqual(r.send.map((x) => [x.role, x.wire.k]), [['CONSUMER', 'ACCIDENT'], ['CARRIER', 'QUEUE_TAIL']]);
  assert.equal(r.skipped.length, 2);
});

test('blindaje: sin firma no se transporta; lo conocido no se reenvía; tope de saltos', () => {
  const dir = roadLocate(fixAt(5000, 1), road).dir;
  const ws = busWith([{ s: 2000, dir: -dir, kind: 'ACCIDENT', trust: 'UNVERIFIED_HINT' }, { s: 7000, dir, kind: 'ACCIDENT', trust: 'OFFICIAL_FEED' }]);
  const r = selectForPeer(ws, helloOf(fixAt(5000, 1), road), OPTS);
  assert.equal(r.send.length, 1);
  assert.match(r.skipped[0].why, /confianza insuficiente/);
  const known = selectForPeer(ws, helloOf(fixAt(5000, 1), road, [ws.find((w) => w.road.dir === dir).warningId]), OPTS);
  assert.equal(known.send.length, 0);
  assert.equal(selectForPeer(ws, helloOf(fixAt(5000, 1), road), { ...OPTS, hopsOf: () => 4 }).send.length, 0);
  assert.throws(() => selectForPeer(ws, helloOf(fixAt(5000, 1), road), { ...OPTS, carryMinTrust: undefined }), /carryMinTrust/);
});

test('presupuesto de bytes: lo que no cabe se informa (overflow), primero lo más grave', () => {
  const dir = roadLocate(fixAt(1000, 1), road).dir;
  const ws = busWith([{ s: 6000, dir, kind: 'ROADWORKS', trust: 'OFFICIAL_FEED' }, { s: 9000, dir, kind: 'PEOPLE_ON_ROAD', trust: 'OFFICIAL_FEED' }]);
  const one = wireOf(ws[0], 1), size = new TextEncoder().encode(JSON.stringify(one)).length;
  const r = selectForPeer(ws, helloOf(fixAt(1000, 1), road), { ...OPTS, maxBytes: size + 10 });
  assert.equal(r.send.length, 1);
  assert.equal(r.send[0].wire.k, 'PEOPLE_ON_ROAD');
  assert.equal(r.overflow.length, 1);
  assert.ok(r.bytesUsed <= size + 10);
});

test('recepción: nunca sube la confianza; rechaza lo caducado, malformado o con demasiados saltos', () => {
  const dir = roadLocate(fixAt(1000, 1), road).dir;
  const [w] = busWith([{ s: 6000, dir, kind: 'ACCIDENT', trust: 'AUTHORITY_VERIFIED' }]);
  const wire = wireOf(w, 1);
  const a = acceptFromPeer(wire, { now, maxHops: 4, signatureVerified: false });
  assert.equal(a.ok, true); assert.equal(a.warning.trust, 'UNVERIFIED_HINT'); assert.equal(a.trustDowngraded, true);
  assert.equal(acceptFromPeer(wire, { now, maxHops: 4, signatureVerified: true }).warning.trust, 'SIGNED_PEER');
  assert.equal(acceptFromPeer({ ...wire, vu: now - 1 }, { now, maxHops: 4, signatureVerified: true }).ok, false);
  assert.equal(acceptFromPeer({ ...wire, k: 'NUKE' }, { now, maxHops: 4, signatureVerified: true }).ok, false);
  assert.equal(acceptFromPeer({ ...wire, h: 9 }, { now, maxHops: 4, signatureVerified: true }).ok, false);
  assert.throws(() => acceptFromPeer(wire, { now, maxHops: 4 }), /signatureVerified/);
  // ida y vuelta: lo aceptado es un aviso canónico válido
  assert.equal(makeWarning(a.warning).kind, 'ACCIDENT');
});
