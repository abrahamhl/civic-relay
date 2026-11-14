#!/usr/bin/env node
/**
 * Experimento «autobuses como mulas de datos» con el GTFS REAL de la EMT de València (CC BY 4.0, Ajuntament de València).
 * Descarga el GTFS (o usa uno local), calcula con el Connection Scan Algorithm (packages/senda/src/bus-mules.mjs):
 *  - el perfil de entrega desde la Plaça de l'Ajuntament (isócronas de mensaje sin red);
 *  - el estudio de adopción: qué fracción de la flota con nodo SENDA hace falta para entregar en ≤ 60 min.
 * Escribe investor-next/public/senda/data/mulas/valencia.json. TODO resultado es SIMULACIÓN sobre horarios reales.
 * Uso: node scripts/datos-reales/gtfs_valencia_mulas.mjs [fecha=20261116] [zip local opcional]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, buildConnections, deliveryProfile, adoptionStudy, csa, rng, hms, placeBoxes, boxNetworkDelivery, hubRanking } from '../../packages/senda/src/bus-mules.mjs';

const DATE = process.argv[2] ?? '20261116', LOCAL = process.argv[3];
const URL_ZIP = 'https://opendata.vlci.valencia.es/dataset/ab058cf8-ad3e-4d9c-ac89-0c6367ecf351/resource/c81b69e6-c082-44dc-acc6-66fc417b4e66/download/google_transit2026-11-12.zip';
let zipPath = LOCAL;
if (!zipPath) { const r = await fetch(URL_ZIP); if (!r.ok) throw new Error(`GTFS respondió ${r.status}`); zipPath = join(mkdtempSync(join(tmpdir(), 'gtfs-')), 'g.zip'); writeFileSync(zipPath, Buffer.from(await r.arrayBuffer())); }
const sha = createHash('sha256').update(readFileSync(zipPath)).digest('hex');
const f = (n) => parseCsv(execFileSync('unzip', ['-p', zipPath, n], { maxBuffer: 1 << 30 }).toString('utf8'));
const stops = f('stops.txt').filter((s) => s.location_type === '' || s.location_type === '0'), trips = f('trips.txt'), calendar = f('calendar.txt'), calendarDates = f('calendar_dates.txt');
const stopTimes = f('stop_times.txt'), feed = f('feed_info.txt')[0] ?? {};
console.log(`GTFS: ${stops.length} paradas, ${trips.length} viajes, ${stopTimes.length} horarios`);
const conns = buildConnections({ stops, trips, stopTimes, calendar, calendarDates }, { date: DATE, from: '07:00:00', to: '11:00:00' });
console.log(`Conexiones ${DATE} 07–11 h: ${conns.dep.length} en ${conns.nTrips} viajes`);
const T0 = hms('08:00:00');
const src = stops.findIndex((s) => /Plaça de l'Ajuntament/i.test(s.stop_name)), from = src >= 0 ? src : 0;
const prof = deliveryProfile(conns, from, T0), iso = csa(conns, from, T0).arrival;
// Parejas origen-destino con semilla y a más de 3 km (haversine)
const R = rng(20261114), hav = (a, b) => { const r = Math.PI / 180, dφ = (b.stop_lat - a.stop_lat) * r, dλ = (b.stop_lon - a.stop_lon) * r, x = Math.sin(dφ / 2) ** 2 + Math.cos(a.stop_lat * r) * Math.cos(b.stop_lat * r) * Math.sin(dλ / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const pairs = []; while (pairs.length < 40) { const a = Math.floor(R() * stops.length), b = Math.floor(R() * stops.length); if (a !== b && hav(stops[a], stops[b]) > 3) pairs.push([a, b]); }
const QS = [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1], t1 = Date.now(), study = adoptionStudy(conns, pairs, T0, { qs: QS, deadlineMin: 60, runs: 30 }), study120 = adoptionStudy(conns, pairs, T0, { qs: QS, deadlineMin: 120, runs: 30 });
console.log(`Estudio de adopción en ${((Date.now() - t1) / 1000).toFixed(1)} s`); for (const st of [study, study120]) { console.log(`— plazo ${st.deadlineMin} min · parejas posibles con flota completa: ${st.feasibleWithFullFleet}/${st.pairs}`); for (const r of st.results) console.log(`q=${r.q}: epidémico ${(100 * r.epidemic).toFixed(1)} % · copia única ${(100 * r.singleCopy).toFixed(1)} % · mediana ${r.epidemicP50Min?.toFixed(1)} min`); }
// ¿Cuántos buzones y dónde? Cobertura voraz (MCLP) a ≤ 400 m y entrega buzón→buzón con flota completa
const pts = stops.map((s) => ({ lat: +s.stop_lat, lon: +s.stop_lon })), place = placeBoxes(pts, 400, { radiusM: 400 });
const buzones = [25, 50, 100, 200, 400].map((K) => { const sel = place.chosen.slice(0, K), d60 = boxNetworkDelivery(conns, sel, T0, { deadlineMin: 60 }), d120 = boxNetworkDelivery(conns, sel, T0, { deadlineMin: 120 });
  return { K, cobertura400m: +place.coverage[Math.min(K, place.coverage.length) - 1].toFixed(3), entrega60: d60.delivered, entrega120: d120.delivered, p50Min: d120.p50Min }; });
const routeOf = new Map(trips.map((t) => [t.trip_id, t.route_id])), hubs = hubRanking(conns, conns.tripIds.map((t) => routeOf.get(t)));
const cover = (sel) => { const set = new Set(sel); let c = 0; for (const p of pts) if (sel.some((i) => Math.abs(pts[i].lat - p.lat) < 0.004 && Math.abs(pts[i].lon - p.lon) < 0.005 && (6371000 * Math.hypot((pts[i].lat - p.lat) * Math.PI / 180, (pts[i].lon - p.lon) * Math.PI / 180 * Math.cos(p.lat * Math.PI / 180))) <= 400)) c++; return c / pts.length; };
const hubPlan = [25, 50, 100, 200, 400].map((K) => { const sel = hubs.slice(0, K).map((h) => h.stop), d60 = boxNetworkDelivery(conns, sel, T0, { deadlineMin: 60 }), d120 = boxNetworkDelivery(conns, sel, T0, { deadlineMin: 120 });
  return { K, cobertura400m: +cover(sel).toFixed(3), entrega60: d60.delivered, entrega120: d120.delivered, p50Min: d120.p50Min }; });
for (const b of hubPlan) console.log(`HUBS ${b.K}: cobertura ${(100 * b.cobertura400m).toFixed(1)} % · entrega ≤60 ${(100 * b.entrega60).toFixed(1)} % · ≤120 ${(100 * b.entrega120).toFixed(1)} % · mediana ${b.p50Min?.toFixed(0)} min`);
const all = boxNetworkDelivery(conns, stops.map((_, i) => i), T0, { deadlineMin: 120 });
buzones.push({ K: stops.length, cobertura400m: 1, entrega60: boxNetworkDelivery(conns, stops.map((_, i) => i), T0, { deadlineMin: 60 }).delivered, entrega120: all.delivered, p50Min: all.p50Min });
for (const b of buzones) console.log(`buzones ${b.K}: cobertura ${(100 * b.cobertura400m).toFixed(1)} % · entrega ≤60 ${(100 * b.entrega60).toFixed(1)} % · ≤120 ${(100 * b.entrega120).toFixed(1)} % · mediana ${b.p50Min?.toFixed(0)} min`);
const out = { caso: 'Autobuses EMT València como mulas de datos (DTN) si cae la red móvil', basis: 'SIMULATION',
  fuente: { gtfs: URL_ZIP, sha256Zip: sha, licencia: 'CC BY 4.0 · Ajuntament de València (opendata.vlci.valencia.es, ficha leída el 14-11-2026)', feed: { inicio: feed.feed_start_date ?? null, fin: feed.feed_end_date ?? null, version: feed.feed_version ?? null } },
  hipotesis: ['Cada autobús con nodo SENDA lleva los mensajes (probabilidad q, independiente por viaje)', 'Hay un buzón o teléfono SENDA en cada parada que pasa el mensaje al autobús al detenerse', 'El intercambio en la parada es instantáneo (mensaje de ≤ 160 caracteres frente a una parada de segundos)', 'Los autobuses cumplen el horario publicado (en una emergencia real puede no ser así)'],
  metodo: 'Connection Scan Algorithm (Dibbelt et al., SEA 2013) sobre las conexiones del GTFS; epidémico = llegada más temprana sobre los autobuses con nodo; copia única = ruta óptima con flota completa, exige que todos sus autobuses tengan nodo; Monte Carlo con semilla fija.',
  dia: DATE, ventana: conns.window, salida: '08:00', conexiones: conns.dep.length, viajes: conns.nTrips,
  origenIsocronas: { stop_id: stops[from].stop_id, nombre: stops[from].stop_name, perfil: prof },
  paradas: stops.map((s, i) => [s.stop_id, s.stop_name, +(+s.stop_lat).toFixed(5), +(+s.stop_lon).toFixed(5), iso[i] === 0x7fffffff ? null : Math.round((iso[i] - T0) / 60)]),
  adopcion: study, adopcion120: study120,
  buzones: { metodo: 'Cobertura máxima (MCLP, Church y ReVelle 1974) voraz, garantía ≥ (1 − 1/e) del óptimo (Nemhauser et al. 1978); parada servida si hay buzón a ≤ 400 m en línea recta. Entrega buzón→buzón con flota completa; el mensaje solo baja o cambia de autobús donde hay buzón. Sin datos de población: cobertura de paradas, no de personas.', orden: place.chosen.slice(0, 400).map((i) => stops[i].stop_id), resultados: buzones,
    transbordos: { metodo: 'Paradas ordenadas por líneas distintas que pasan (puntos de intercambio), como el reenvío por centralidad en DTN (BUBBLE Rap, Hui et al. 2008). Cobertura calculada igual (≤ 400 m).', orden: hubs.slice(0, 400).map((h) => ({ stop_id: stops[h.stop].stop_id, lineas: h.lines })), resultados: hubPlan } } };
const D = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/mulas');
// Conexiones en binario para que la página recalcule en el navegador: 5 bloques Int32 LE [dep|arr|from|to|trip]
const N = conns.dep.length, buf = Buffer.alloc(N * 5 * 4); [conns.dep, conns.arr, conns.from, conns.to, conns.trip].forEach((a, k) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).copy(buf, k * N * 4));
writeFileSync(join(D, 'conexiones.bin'), buf); out.binario = { fichero: 'conexiones.bin', n: N, viajes: conns.nTrips, paradas: stops.length, formato: 'Int32 little-endian, 5 bloques de n: salida(s), llegada(s), parada origen, parada destino, viaje', sha256: createHash('sha256').update(buf).digest('hex') };
const dst = join(D, 'valencia.json');
writeFileSync(dst, JSON.stringify(out)); console.log(`Desde ${stops[from].stop_name}: ${prof.reached}/${prof.of} paradas (${(100 * prof.share).toFixed(1)} %), mediana ${prof.p50?.toFixed(1)} min, p90 ${prof.p90?.toFixed(1)} min → ${dst}`);
