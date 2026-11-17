import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gnssCells, FAA_NACP_MIN, GPSJAM_LEVELS, SENDA_DEFAULT_FILTER } from '../src/gnss-integrity.mjs';
import { eventsFromGnss } from '../src/atlas.mjs';

const snap = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public/senda/data/referencias/adsb_gnss.json'), 'utf8'));
const ac = (n, nacp, lat = 55.2, lon = 20.3, v = 2, sil = 3) => Array.from({ length: n }, (_, k) => ({ hex: `${nacp}-${k}-${lat}`, lat, lon, nac_p: nacp, version: v, sil }));

test('sin umbral con fuente no se clasifica', () => { assert.throws(() => gnssCells(ac(3, 9), {})); assert.equal(FAA_NACP_MIN.value, 8); });

test('fórmula y colores de GPSJam (escenario SINTÉTICO de interferencia)', () => {
  const [red] = gnssCells([...ac(20, 9), ...ac(10, 0)], { nacpMin: 8 });
  assert.equal(red.n, 30); assert.equal(red.pctBad, (100 * (10 - 1)) / 30); assert.equal(red.level, 'red');
  const [yel] = gnssCells([...ac(45, 9), ...ac(3, 0)], { nacpMin: 8 }); assert.ok(yel.pctBad >= GPSJAM_LEVELS.yellowPct && yel.pctBad <= GPSJAM_LEVELS.redPct); assert.equal(yel.level, 'yellow');
  const [one] = gnssCells([...ac(5, 9), ...ac(1, 0)], { nacpMin: 8 }); assert.equal(one.pctBad, 0, 'un solo avión malo no basta (resta 1, como GPSJam)');
});

test('filtro de SENDA: descarta transpondedores antiguos y sin integridad declarada', () => {
  const cells = gnssCells([...ac(20, 9), ...ac(10, 0, 55.2, 20.3, 0, 0)], { nacpMin: 8 });
  assert.equal(cells[0].bad, 0); assert.match(SENDA_DEFAULT_FILTER.note, /decisión de SENDA/);
  const noFilter = gnssCells([...ac(20, 9), ...ac(10, 0, 55.2, 20.3, 0, 0)], { nacpMin: 8, filter: null }); assert.equal(noFilter[0].level, 'red');
});

test('foto real de adsb.lol: zonas con aviones, licencia ODbL y celdas para el Atlas', () => {
  assert.match(snap.licencia, /ODbL/); assert.ok(snap.zonas.length === 3 && snap.zonas.every((z) => /^[0-9a-f]{64}$/.test(z.sha256) && z.aviones.length > 0));
  const ev = eventsFromGnss(snap); assert.ok(ev.length > 0 && ev.every((e) => e.basis === 'MEASURED_ADSB' && /GNSS_(green|yellow|red)/.test(e.kind)));
});
