import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, hms, activeServices, buildConnections, csa, pathTrips, adoptionStudy } from '../src/bus-mules.mjs';

// Red de juguete: línea 1 A→B→C y línea 2 B→D; transbordo en B.
const toy = () => {
  const stops = ['A', 'B', 'C', 'D'].map((id) => ({ stop_id: id }));
  const trips = [{ trip_id: 't1', service_id: 'L' }, { trip_id: 't2', service_id: 'L' }, { trip_id: 't3', service_id: 'S' }];
  const st = (trip, stop, seq, t) => ({ trip_id: trip, stop_id: stop, stop_sequence: String(seq), arrival_time: t, departure_time: t });
  const stopTimes = [st('t1', 'A', 1, '08:00:00'), st('t1', 'B', 2, '08:10:00'), st('t1', 'C', 3, '08:20:00'), st('t2', 'B', 1, '08:15:00'), st('t2', 'D', 2, '08:30:00'), st('t3', 'A', 1, '08:01:00'), st('t3', 'D', 2, '08:05:00')];
  const calendar = [{ service_id: 'L', monday: '1', tuesday: '1', wednesday: '1', thursday: '1', friday: '1', saturday: '0', sunday: '0', start_date: '20260101', end_date: '20261231' },
    { service_id: 'S', monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '0', sunday: '1', start_date: '20260101', end_date: '20261231' }];
  return { stops, trips, stopTimes, calendar, calendarDates: [] };
};

test('CSV con comillas, horas GTFS ≥ 24 y servicios del día (calendar + excepciones)', () => {
  const r = parseCsv('a,b\n"x, y","he said ""hola"""\n1,2\n'); assert.deepEqual(r[0], { a: 'x, y', b: 'he said "hola"' }); assert.equal(r.length, 2);
  assert.equal(hms('25:01:30'), 90090);
  const on = activeServices(toy().calendar, [{ service_id: 'S', date: '20261116', exception_type: '1' }], '20261116');
  assert.ok(on.has('L') && on.has('S'), 'lunes + excepción que añade S');
});

test('Connection Scan: llegada más temprana con transbordo; el servicio de domingo no cuenta en lunes; autobús sin nodo corta la ruta', () => {
  const c = buildConnections(toy(), { date: '20261116' });
  assert.equal(c.dep.length, 3, 'solo las 3 conexiones de lunes');
  const r = csa(c, 0, hms('08:00:00'));
  assert.equal(r.arrival[2], hms('08:20:00')); assert.equal(r.arrival[3], hms('08:30:00'), 'A→B (t1) y transbordo a t2 → D');
  assert.equal(pathTrips(c, r, 0, 3).length, 2);
  const t2 = c.tripIds.indexOf('t2'), down = csa(c, 0, hms('08:00:00'), { up: (tr) => tr !== t2 });
  assert.equal(down.arrival[3], 0x7fffffff, 'sin nodo en t2 no se llega a D');
  assert.equal(csa(c, 0, hms('08:11:00')).arrival[2], 0x7fffffff, 'si salgo tarde pierdo el autobús');
});

test('estudio de adopción: epidémico ≥ copia única siempre; con flota completa ambos 100 %', () => {
  const c = buildConnections(toy(), { date: '20261116' });
  const s = adoptionStudy(c, [[0, 3], [0, 2]], hms('08:00:00'), { qs: [0.3, 1], deadlineMin: 60, runs: 50 });
  for (const r of s.results) assert.ok(r.epidemic >= r.singleCopy);
  assert.equal(s.results.at(-1).epidemic, 1); assert.equal(s.results.at(-1).singleCopy, 1); assert.equal(s.basis, 'SIMULATION');
});

test('resultado REAL (GTFS EMT València): procedencia, hipótesis declaradas y coherencia de las curvas', () => {
  const d = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/mulas/valencia.json', import.meta.url)));
  assert.equal(d.basis, 'SIMULATION'); assert.match(d.fuente.licencia, /CC BY 4\.0/); assert.match(d.fuente.sha256Zip, /^[0-9a-f]{64}$/);
  assert.ok(d.hipotesis.length >= 3); assert.ok(d.conexiones > 10000);
  for (const st of [d.adopcion, d.adopcion120]) {
    for (const r of st.results) assert.ok(r.epidemic >= r.singleCopy - 1e-9, `q=${r.q}`);
    for (let i = 1; i < st.results.length; i++) assert.ok(st.results[i].epidemic >= st.results[i - 1].epidemic - 0.05, 'la entrega crece con la adopción (tolerancia Monte Carlo)');
  }
  assert.ok(d.adopcion120.feasibleWithFullFleet >= 30);
});

test('buzones: sin buzón en el transbordo el mensaje no puede cambiar de autobús; cobertura voraz creciente', async () => {
  const { placeBoxes } = await import('../src/bus-mules.mjs');
  const c = buildConnections(toy(), { date: '20261116' });
  assert.equal(csa(c, 0, hms('08:00:00'), { hub: (s) => s !== 1 }).arrival[3], 0x7fffffff, 'sin buzón en B no hay transbordo a la línea 2');
  assert.equal(csa(c, 0, hms('08:00:00'), { hub: () => true }).arrival[3], hms('08:30:00'));
  const pts = [{ lat: 39.47, lon: -0.376 }, { lat: 39.4701, lon: -0.3761 }, { lat: 39.48, lon: -0.36 }];
  const r = placeBoxes(pts, 2, { radiusM: 400 }); assert.deepEqual(r.chosen.length, 2); assert.equal(r.coverage.at(-1), 1); assert.ok(r.coverage[0] >= 2 / 3);
});

test('buzones en València (real, simulación): colocarlos en transbordos entrega más que colocarlos solo por cobertura', () => {
  const d = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/mulas/valencia.json', import.meta.url)));
  const c = d.buzones.resultados.find((r) => r.K === 100), h = d.buzones.transbordos.resultados.find((r) => r.K === 100);
  assert.ok(h.entrega120 > c.entrega120, `transbordos ${h.entrega120} > cobertura ${c.entrega120}`);
  assert.ok(c.cobertura400m > h.cobertura400m, 'pero la cobertura geográfica gana en cobertura: hay un compromiso');
  assert.match(d.buzones.metodo, /1 − 1\/e/);
});
