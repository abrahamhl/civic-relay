import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeScan, radarPoints, bandOf, drawSignalRadar } from '../src/signal-radar.mjs';

const scan = { wifi: [{ a: 10, r: -45, g: '5' }, { a: 200, r: -70, g: '2.4' }, { a: 90, r: -88, g: '2.4' }], ble: [{ a: 33, r: -60, s: true }, { a: 300, r: -90, s: false }], sendaNear: 1, wifiFresh: false, note: '' };

test('resumen: cuenta, bandas, mediana y SENDA cercanos, sin identificadores', () => {
  const s = summarizeScan(scan);
  assert.equal(s.wifiN, 3); assert.deepEqual(s.wifiByBand, { '2.4': 2, 5: 1, 6: 0 });
  assert.equal(s.wifiBestDbm, -45); assert.equal(s.wifiMedianDbm, -70);
  assert.equal(s.bleN, 2); assert.equal(s.sendaNear, 1);
  assert.ok(!JSON.stringify(s).match(/ssid|bssid|mac/i));
});

test('radar: más fuerte = más cerca del centro; puntos dentro del círculo', () => {
  const pts = radarPoints(scan);
  assert.equal(pts.length, 5);
  const strong = pts.find((p) => p.dbm === -45), weak = pts.find((p) => p.dbm === -88);
  assert.ok(Math.hypot(strong.x, strong.y) < Math.hypot(weak.x, weak.y));
  for (const p of pts) assert.ok(Math.hypot(p.x, p.y) <= 1 + 1e-9);
  assert.equal(bandOf(-50).label, 'muy fuerte'); assert.equal(bandOf(-120).label, 'débil');
});

test('entrada vacía o rota no rompe y el dibujo no lanza', () => {
  assert.equal(summarizeScan(null).wifiN, 0);
  const calls = []; const ctx = new Proxy({}, { get: (_, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => calls.push(k)), set: () => true });
  drawSignalRadar(ctx, 300, radarPoints(scan), 1);
  assert.ok(calls.includes('arc'));
});
