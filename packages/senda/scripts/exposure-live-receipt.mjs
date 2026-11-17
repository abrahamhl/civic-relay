#!/usr/bin/env node
/**
 * Evidencia en vivo del motor de exposición con datos de tráfico REALES:
 *  - Digitraffic TMS (Finlandia, abierto): intensidad y velocidad por estación y sentido.
 *  - Informo Madrid (abierto): intensidad y ocupación por detector.
 * Calcula el plan de aviso adaptativo por estación y lo compara con la política fija (3 saltos, 2 km).
 * Escribe evidence/senda/exposure/live-receipt-<fecha>.json con el SHA-256 de cada respuesta.
 * Detrás de un proxy HTTPS: NODE_USE_ENV_PROXY=1 node scripts/exposure-live-receipt.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDigitrafficTms, parseMadridPm, roadWarningPlan, densityFromOccupancy } from '../src/exposure.mjs';
import { fromUtm } from '../src/utm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
async function get(url, headers = {}) {
  const r = await fetch(url, { headers: { 'Digitraffic-User': 'SENDA-research', ...headers } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, sha256: sha(buf), bytes: buf.length };
}
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null; };
const r2 = (x) => Math.round(x * 100) / 100;

const fetchedAt = new Date().toISOString();
const tmsRaw = await get('https://tie.digitraffic.fi/api/tms/v1/stations/data');
const tms = parseDigitrafficTms(JSON.parse(tmsRaw.buf.toString('utf8')));
const plans = tms.filter((r) => r.flowVehH > 0).map((r) => ({ ...r, plan: roadWarningPlan({ flowVehH: r.flowVehH, speedKmh: r.speedKmh, penetration: 0.1, lanes: 2 }) }));
const short = plans.filter((p) => p.plan.fixedPolicy.coverageOfDangerZone < 0.999);
const top = [...plans].sort((a, b) => b.plan.vehiclesAtRisk - a.plan.vehiclesAtRisk).slice(0, 5);

const pmRaw = await get('https://informo.madrid.es/informo/tmadrid/pm.xml');
const pm = parseMadridPm(pmRaw.buf.toString('utf8'), { fromUtm });
const madridDensity = pm.filter((d) => d.flowVehH > 0 && d.occupancyPct > 0).map((d) => {
  const k = densityFromOccupancy(d.occupancyPct);           // veh/km/carril
  return { id: d.id, flowVehH: d.flowVehH, densityVehKmLane: r2(k), speedKmhEst: r2(d.flowVehH / Math.max(k, 1e-6)) };
});

const receipt = {
  schema: 'senda.evidence.exposure-live/1', fetchedAt, claim: 'DATO_REAL_CAPTURADO (tráfico) + CALCULATED (planes)',
  sources: {
    digitraffic: { url: 'https://tie.digitraffic.fi/api/tms/v1/stations/data', sha256: tmsRaw.sha256, bytes: tmsRaw.bytes, licence: 'CC BY 4.0, Fintraffic / digitraffic.fi' },
    madrid: { url: 'https://informo.madrid.es/informo/tmadrid/pm.xml', sha256: pmRaw.sha256, bytes: pmRaw.bytes, licence: 'Portal de datos abiertos del Ayuntamiento de Madrid (atribución)' },
  },
  digitraffic: {
    stationDirectionsWithFlow: plans.length,
    flowVehH: { p50: quant(plans.map((p) => p.flowVehH), 0.5), p95: quant(plans.map((p) => p.flowVehH), 0.95), max: Math.max(...plans.map((p) => p.flowVehH)) },
    dangerZoneM: { p50: r2(quant(plans.map((p) => p.plan.dangerZoneM), 0.5)), p95: r2(quant(plans.map((p) => p.plan.dangerZoneM), 0.95)) },
    vehiclesAtRisk: { p50: r2(quant(plans.map((p) => p.plan.vehiclesAtRisk), 0.5)), p95: r2(quant(plans.map((p) => p.plan.vehiclesAtRisk), 0.95)) },
    recommendedMaxHops: { p50: quant(plans.map((p) => p.plan.recommended.maxHops), 0.5), p95: quant(plans.map((p) => p.plan.recommended.maxHops), 0.95) },
    fixedPolicyShortfall: { stationDirections: short.length, share: r2(short.length / Math.max(1, plans.length)) },
    top5ByVehiclesAtRisk: top.map((p) => ({ stationId: p.stationId, direction: p.direction, flowVehH: p.flowVehH, speedKmh: p.speedKmh, vehiclesAtRisk: r2(p.plan.vehiclesAtRisk), dangerZoneM: r2(p.plan.dangerZoneM), recommendedMaxHops: p.plan.recommended.maxHops, fixedCoverage: r2(p.plan.fixedPolicy.coverageOfDangerZone) })),
    note: 'Hora local de la captura: puede ser madrugada (tráfico bajo). Penetración SENDA supuesta: 10 %.',
  },
  madrid: {
    detectorsValid: pm.length,
    withFlowAndOccupancy: madridDensity.length,
    densityVehKmLane: { p50: quant(madridDensity.map((d) => d.densityVehKmLane), 0.5), p95: quant(madridDensity.map((d) => d.densityVehKmLane), 0.95) },
    note: 'Velocidad estimada v = q/k con longitud efectiva supuesta de 6,5 m; NO es una velocidad medida.',
  },
};
const out = resolve(root, `evidence/senda/exposure/live-receipt-${fetchedAt.slice(0, 10)}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ out, digitraffic: { n: plans.length, flow: receipt.digitraffic.flowVehH, risk: receipt.digitraffic.vehiclesAtRisk, hops: receipt.digitraffic.recommendedMaxHops, shortfall: receipt.digitraffic.fixedPolicyShortfall, top1: receipt.digitraffic.top5ByVehiclesAtRisk[0] }, madrid: receipt.madrid }, null, 1));
