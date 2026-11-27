#!/usr/bin/env node
// Descarga las cámaras públicas de fuentes oficiales (ES, NL, BE, DE) y las guarda en un solo archivo con la licencia y el estado
// de cada fuente. Uso: node packages/senda/scripts/fetch-public-cameras.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMERA_SOURCES, parseMadridKml, parseEuskadi, parseRws, parseBrussels, parseAutobahn, fromDgt, mergeCameras } from '../src/public-cameras.mjs';

const here = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(here, '../../..');
const OUT = resolve(ROOT, 'investor-next/public/senda/data/referencias/camaras_publicas.json');
const UA = { 'User-Agent': 'SENDA-opendata (reutilizacion de datos abiertos)' };
const get = async (u, kind = 'json') => { const r = await fetch(u, { headers: UA, redirect: 'follow' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return kind === 'json' ? r.json() : r.text(); };
const status = {}, lists = [];
async function run(id, fn) { try { const l = await fn(); lists.push(l); status[id] = { ok: true, count: l.length }; } catch (e) { status[id] = { ok: false, count: 0, error: String(e.message || e) }; } }

await run('DGT', async () => fromDgt(JSON.parse(readFileSync(resolve(ROOT, 'investor-next/public/senda/data/referencias/dgt_camaras.json'), 'utf8')).camaras));
await run('MADRID', async () => parseMadridKml(await get('https://datos.madrid.es/egob/catalogo/202088-0-trafico-camaras.kml', 'text')));
await run('EUSKADI', async () => { const first = await get('https://api.euskadi.eus/traffic/v1.0/cameras?_page=1'); let all = first.cameras ?? []; for (let p = 2; p <= (first.totalPages ?? 1); p++) all = all.concat((await get(`https://api.euskadi.eus/traffic/v1.0/cameras?_page=${p}`)).cameras ?? []); return parseEuskadi(all); });
await run('RWS', async () => parseRws(await get('https://api.rwsverkeersinfo.nl/api/cameras')));
await run('BRUSSEL', async () => parseBrussels((await get('https://opendata.bruxelles.be/api/explore/v2.1/catalog/datasets/webcams/records?limit=100')).results));
await run('AUTOBAHN', async () => { const { roads } = await get('https://verkehr.autobahn.de/o/autobahn/'); let all = []; for (const r of roads) { try { all = all.concat(parseAutobahn(r, await get(`https://verkehr.autobahn.de/o/autobahn/${encodeURIComponent(r)}/services/webcam`))); } catch { /* vía sin servicio */ } } return all; });

const cameras = mergeCameras(...lists);
const doc = { format: 'senda-camaras-publicas/1', generatedAtUtc: new Date().toISOString(), basis: 'DATOS PUBLICOS OFICIALES · solo fuentes publicadas para reutilizar; sin cámaras privadas',
  sources: Object.entries(CAMERA_SOURCES).map(([id, s]) => ({ id, ...s, ...status[id] })), total: cameras.length,
  byCountry: cameras.reduce((m, c) => ((m[c.cc] = (m[c.cc] ?? 0) + 1), m), {}), withImage: cameras.filter((c) => c.img).length, cameras };
writeFileSync(OUT, JSON.stringify(doc));
console.log(`${cameras.length} cámaras · ${JSON.stringify(doc.byCountry)} · con imagen: ${doc.withImage}`);
for (const s of doc.sources) console.log(` ${s.id}: ${s.ok ? s.count : 'FALLO ' + s.error}`);
