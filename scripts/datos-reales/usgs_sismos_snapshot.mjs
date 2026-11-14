#!/usr/bin/env node
/**
 * Descarga real del catálogo de USGS (ANSS ComCat) para el Atlas y la Consola.
 *  - Sismos de magnitud ≥ 4,5 del último mes (feed oficial GeoJSON).
 *  - Eventos pedidos por identificador (p. ej. la señal sísmica del colapso de Langtang, Nepal, 26-08-2026).
 * Escribe investor-next/public/senda/data/referencias/usgs_sismos.json con URL, fecha de descarga y SHA-256 de cada
 * respuesta cruda. No inventa nada: si la red falla, no escribe.
 * Uso: node scripts/datos-reales/usgs_sismos_snapshot.mjs [id1,id2,...]
 * Licencia: los datos de USGS son obra del Gobierno de EE. UU. (dominio público en EE. UU., 17 U.S.C. §105); ComCat
 * agrega redes de otros países, por lo que se conserva la red de origen (net) de cada evento.
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ids = (process.argv[2] ?? 'us7000tbwb,us7000tc90').split(',').filter(Boolean);
const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson';
const sha = (t) => createHash('sha256').update(t).digest('hex');
const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`USGS respondió ${r.status}: ${url}`); const raw = await r.text(); return { raw, json: JSON.parse(raw), url, sha256: sha(raw) }; };
const pick = (f) => { const p = f.properties, [lon, lat, depth] = f.geometry.coordinates;
  return { id: f.id, t: new Date(p.time).toISOString(), lat, lon, depthKm: depth, mag: p.mag, magType: p.magType, type: p.type, place: p.place, net: p.net, status: p.status, alert: p.alert ?? null, tsunami: p.tsunami, url: p.url }; };
const feed = await get(FEED);
const extra = [];
for (const id of ids) extra.push(await get(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=${id}`));
const out = { fuente: 'USGS · ANSS Comprehensive Earthquake Catalog (ComCat)', licencia: 'Obra del Gobierno de EE. UU.: dominio público en EE. UU. (17 U.S.C. §105); se conserva la red de origen de cada evento',
  descargadoUTC: new Date().toISOString(), consultas: [{ url: feed.url, sha256: feed.sha256, eventos: feed.json.features.length }, ...extra.map((e) => ({ url: e.url, sha256: e.sha256 }))],
  nota: 'Descarga real con este script. Magnitudes, tipos (earthquake, landslide…) y posiciones son los de USGS, sin modificar.',
  eventos: feed.json.features.map(pick).sort((a, b) => a.t.localeCompare(b.t)), casos: extra.map((e) => pick(e.json)) };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/usgs_sismos.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`USGS: ${out.eventos.length} sismos M≥4,5 del último mes + ${out.casos.length} casos (${out.casos.map((c) => `${c.id} ${c.type} M${c.mag}`).join(', ')}) → ${dst}`);
