import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRws, hourly, valueAt, trend, percentileRank, forecastPeak, forecastError, travelLag, tidalAmplitudeCm, detide, assessStation, rankStations, WATCH_RULES } from '../src/water-nl.mjs';
const H = 3600e3, T0 = Date.UTC(2026, 10, 1);
const lin = (n, f) => Array.from({ length: n }, (_, i) => ({ t: T0 + i * H, v: f(i) }));

test('agua NL: lee la respuesta de Rijkswaterstaat y descarta el centinela de «sin dato»', () => {
  const r = parseRws({ WaarnemingenLijst: [{ AquoMetadata: { ProcesType: 'meting', Eenheid: { Code: 'cm' }, Hoedanigheid: { Code: 'NAP' } }, MetingenLijst: [
    { Tijdstip: '2026-11-15T01:50:00.000+01:00', Meetwaarde: { Waarde_Numeriek: 647 } }, { Tijdstip: '2026-11-15T01:40:00.000+01:00', Meetwaarde: { Waarde_Numeriek: 646 } }, { Tijdstip: '2026-11-15T02:00:00.000+01:00', Meetwaarde: { Waarde_Numeriek: 999999999 } }] }] });
  assert.equal(r.meting.points.length, 2); assert.equal(r.meting.ref, 'NAP'); assert.ok(r.meting.points[0].t < r.meting.points[1].t);
  assert.deepEqual(parseRws({}), {});
});

test('agua NL: medias horarias e interpolación con hueco máximo', () => {
  const h = hourly([{ t: T0, v: 10 }, { t: T0 + 600e3, v: 20 }, { t: T0 + H, v: 40 }]);
  assert.deepEqual(h, [{ t: T0, v: 15 }, { t: T0 + H, v: 40 }]);
  assert.equal(valueAt(h, T0 + H / 2), 27.5); assert.equal(valueAt(h, T0 - 1), null);
  assert.equal(valueAt([{ t: T0, v: 1 }, { t: T0 + 10 * H, v: 2 }], T0 + H), null, 'no interpola sobre un hueco de 10 h');
});

test('agua NL: tendencia por mínimos cuadrados y cambio en 24 h', () => {
  const t = trend(lin(48, (i) => 100 + 2 * i), { windowH: 6 });
  assert.equal(t.rateCmH, 2); assert.equal(t.change24hCm, 48); assert.equal(t.last.v, 194);
  assert.throws(() => trend(lin(5, (i) => i), {}), /windowH/);
  assert.equal(trend([], { windowH: 6 }).last, null);
});

test('agua NL: percentil dentro de la propia serie, pico y verificación de la previsión oficial', () => {
  const m = lin(100, (i) => i);
  assert.equal(percentileRank(m, 99), 100); assert.equal(percentileRank(m, 49), 50);
  const f = lin(120, (i) => (i < 110 ? i + 2 : 112 - (i - 110)));
  const pk = forecastPeak(f, m[99].t); assert.equal(pk.v, 112); assert.equal(pk.inH, 11); assert.equal(pk.horizonH, 20);
  const e = forecastError(m, f); assert.equal(e.n, 100); assert.equal(e.maeCm, 2); assert.equal(e.biasCm, 2);
  assert.equal(forecastPeak(f, f[119].t), null); assert.equal(forecastError(m, []).maeCm, null);
});

test('agua NL: tiempo de viaje de la onda entre dos estaciones', () => {
  const wave = (i) => 100 + 60 * Math.exp(-(((i - 120) / 18) ** 2)) + 25 * Math.sin(i / 7);
  const up = lin(400, wave), down = lin(400, (i) => wave(i - 9) * 0.9);
  const r = travelLag(up, down, { maxLagH: 48, minCorr: 0.6, diffH: 6 });
  assert.equal(r.lagH, 9); assert.ok(r.corr > 0.95); assert.equal(r.reliable, true);
  const noise = lin(400, (i) => ((i * 7919) % 13) - 6); const bad = travelLag(up, noise, { maxLagH: 48, minCorr: 0.6, diffH: 6 });
  assert.equal(bad.lagH, null, 'sin correlación no se da tiempo de viaje'); assert.equal(bad.reliable, false);
  assert.throws(() => travelLag(up, down, {}), /maxLagH/);
});

test('agua NL: el estado sale de reglas declaradas y avisa de que no es una alarma oficial', () => {
  const calm = assessStation({ measured: lin(200, (i) => 100 + (i % 3)) });
  assert.equal(calm.state, 'ESTABLE'); assert.equal(calm.basis, 'MEASURED'); assert.match(calm.disclaimer, /no es un nivel de alarma oficial/);
  const m = lin(200, (i) => (i < 180 ? 100 : 100 + 5 * (i - 180))), f = lin(260, (i) => (i < 180 ? 100 : 100 + 5 * (i - 180)));
  const hot = assessStation({ measured: m, forecast: f });
  assert.equal(hot.state, 'ATENCION_ALTA'); assert.equal(hot.reasons.length, 3); assert.equal(hot.rateCmH, 5); assert.equal(hot.peakRiseCm, 300); assert.equal(hot.forecastCheck.maeCm, 0);
  assert.equal(assessStation({ measured: [] }).state, 'SIN_DATOS');
  assert.equal(hot.rules, WATCH_RULES);
  const order = rankStations([{ id: 'a', assessment: calm }, { id: 'b', assessment: hot }]); assert.equal(order[0].id, 'b');
});

test('agua NL: detecta la marea con los propios datos y la quita antes de juzgar la tendencia', () => {
  const tide = lin(24 * 20, (i) => 50 + 80 * Math.sin((2 * Math.PI * i) / 12.4206));
  assert.ok(Math.abs(tidalAmplitudeCm(tide) - 80) < 1, 'recupera la amplitud M2');
  assert.ok(tidalAmplitudeCm(lin(24 * 20, (i) => 100 + 0.1 * i)) < 3, 'un río sin marea da amplitud pequeña');
  const d = detide(tide); assert.ok(d.every((p) => Math.abs(p.v - 50) < 8), 'la media de 25 h deja el nivel medio');
  const a = assessStation({ measured: tide.slice(0, 24 * 20 - 3) });
  assert.equal(a.tidal, true); assert.equal(a.state, 'ESTABLE', 'la subida de la marea no dispara la atención');
});
