/**
 * SENDA · Plan de repetidores de radio para llevar un aviso de Chiva a l'Horta Sud (PREDICCIÓN con modelo, no medida).
 * Parámetros de ESCENARIO (declarados aquí y repetidos en la salida). Uso: node scripts/datos-reales/radio_calcular.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { placeRelays, peakCandidates, mesh, link, ASSUMPTIONS } from '../../packages/senda/src/radio-planner.mjs';
const dir = new URL('../../investor-next/public/senda/data/radio/', import.meta.url);
const d = JSON.parse(readFileSync(new URL('poyo.json', dir))), dem = d.dem;
export const ESCENARIO = {
  fMhz: 868, kFactor: 4 / 3, txPowerDbm: 14, txGainDbi: 2.15, rxGainDbi: 2.15, sensitivityDbm: -137, marginDb: 10, mastilM: 6, receptorM: 1.5, azoteaM: 15, K: 6,
  fuentes: {
    fMhz: 'banda ISM europea de 868 MHz (dispositivos de corto alcance)', txPowerDbm: '14 dBm (25 mW) de p.r.a.: límite habitual de la subbanda 868,0–868,6 MHz (ETSI EN 300 220 / CEPT ERC 70-03) — NO verificado en esta sesión',
    sensitivityDbm: '−137 dBm: sensibilidad típica LoRa SF12 a 125 kHz en hoja de datos Semtech SX1262 — NO verificado en esta sesión', ganancias: '2,15 dBi = dipolo de media onda (teoría de antenas)',
    marginDb: '10 dB: margen de desvanecimiento elegido por SENDA', kFactor: '4/3: atmósfera estándar (ITU-R P.453)', alturas: 'mástil 6 m en cimas, 15 m en azotea de municipio, receptor a 1,5 m: decisiones de escenario',
  },
};
const E_ = ESCENARIO, radio = { txPowerDbm: E_.txPowerDbm, txGainDbi: E_.txGainDbi, rxGainDbi: E_.rxGainDbi, sensitivityDbm: E_.sensitivityDbm, marginDb: E_.marginDb }, p = { fMhz: E_.fMhz, kFactor: E_.kFactor, stepM: 90 };
const towns = d.municipios, demand = towns.map((t) => ({ lon: t.lon, lat: t.lat, hM: E_.receptorM }));
const cands = [...towns.map((t) => ({ id: 'azotea ' + t.nombre, lon: t.lon, lat: t.lat, hM: E_.azoteaM })), ...peakCandidates(dem, { win: 14, hM: E_.mastilM, minProminenceM: 40 })];
const seed = towns.findIndex((t) => t.nombre === 'Chiva');
const t0 = Date.now(), plan = placeRelays(dem, cands, demand, radio, p, E_.K, { mustConnect: true, seed });
const sites = plan.chosen.map((c) => cands[c]), m = mesh(dem, sites, radio, p, { from: 0 });
const direct = towns.map((t, i) => ({ municipio: t.nombre, ...(({ dKm, totalDb, marginDb, ok, los }) => ({ dKm: +dKm.toFixed(1), perdidaDb: +totalDb.toFixed(1), margenDb: +marginDb.toFixed(1), cierra: ok, visionDirecta: los }))(link(dem, { ...cands[seed] }, demand[i], radio, p)) }));
const out = { basis: 'MODEL', caso: d.caso, generadoUTC: new Date().toISOString().slice(0, 19) + 'Z', escenario: ESCENARIO, candidatos: cands.length, municipios: towns.length,
  directoDesdeChiva: { cierran: direct.filter((x) => x.cierra).length, de: direct.length, detalle: direct },
  plan: { repetidores: sites.map((s, i) => ({ orden: i + 1, id: s.id, lon: +s.lon.toFixed(5), lat: +s.lat.toFixed(5), cotaM: s.z ?? null, mastilM: s.hM, saltosDesdeChiva: m.hops[i], municipiosNuevos: plan.steps[i].gain, acumuladoPct: plan.steps[i].pct })),
    municipiosCubiertos: plan.coveredWeight, de: plan.totalWeight, sinCubrir: towns.filter((_, i) => !plan.covered[i]).map((t) => t.nombre),
    enlaces: m.links.filter((l) => l.ok).map((l) => ({ a: sites[l.a].id, b: sites[l.b].id, km: +l.dKm.toFixed(1), margenDb: +l.marginDb.toFixed(1), visionDirecta: l.los })) },
  hipotesis: ASSUMPTIONS, ms: Date.now() - t0 };
writeFileSync(new URL('poyo_plan.json', dir), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ cand: cands.length, directo: out.directoDesdeChiva.cierran, plan: out.plan.repetidores, sin: out.plan.sinCubrir, enlaces: out.plan.enlaces.length, ms: out.ms }, null, 1));
