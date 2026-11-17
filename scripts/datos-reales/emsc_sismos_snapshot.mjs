#!/usr/bin/env node
/**
 * Descarga real de EMSC-CSEM SeismicPortal (FDSN event 1.2) para contrastar con USGS.
 * Sismos de M ≥ 4,0 de los últimos N días (por defecto 31). Cada evento conserva la agencia autora de su solución
 * (`auth`): si es USGS/NEIC, esa solución NO es independiente de USGS. Escribe emsc_sismos.json con URL y SHA-256.
 * Licencia: CC BY 4.0 (https://www.seismicportal.eu/terms.html, leída el 14-11-2026). Crédito: EMSC-CSEM SeismicPortal.
 * Uso: node scripts/datos-reales/emsc_sismos_snapshot.mjs [días=31]
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const days = Number(process.argv[2] ?? 31), to = new Date(), from = new Date(to.getTime() - days * 86_400_000);
const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minmag=4.0&start=${from.toISOString().slice(0, 19)}&end=${to.toISOString().slice(0, 19)}&limit=5000&orderby=time-asc`;
const res = await fetch(url); if (!res.ok) throw new Error(`EMSC respondió ${res.status}`);
const raw = await res.text(), fc = JSON.parse(raw);
const eventos = (fc.features ?? []).map((f) => { const p = f.properties; return { id: p.unid ?? f.id, t: new Date(p.time).toISOString(), lat: p.lat, lon: p.lon, depthKm: p.depth, mag: p.mag, magType: p.magtype, auth: p.auth, region: p.flynn_region, evtype: p.evtype }; })
  .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isFinite(e.mag));
if (!eventos.length) throw new Error('EMSC no devolvió eventos: no se escribe nada');
const out = { fuente: 'EMSC-CSEM SeismicPortal (FDSN event)', licencia: 'CC BY 4.0 · crédito: EMSC-CSEM SeismicPortal (https://www.seismicportal.eu/terms.html)', descargadoUTC: to.toISOString(),
  consulta: url, sha256: createHash('sha256').update(raw).digest('hex'), total: eventos.length,
  nota: 'Descarga real con este script. «auth» es la agencia autora de la solución: US/NEIC = solución de USGS (no independiente de USGS).', eventos };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/emsc_sismos.json');
await writeFile(dst, JSON.stringify(out) + '\n');
const auths = {}; for (const e of eventos) auths[e.auth] = (auths[e.auth] ?? 0) + 1;
console.log(`EMSC: ${eventos.length} sismos M≥4,0 · autores principales: ${Object.entries(auths).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([a, n]) => `${a}=${n}`).join(' ')} → ${dst}`);
