#!/usr/bin/env node
/**
 * SENDA · Paquete de incidencias para la reserva, a partir de cualquier Punto de Acceso Nacional DATEX II.
 * Lo ejecuta el relé del organismo (o cualquiera con Internet), no el teléfono:
 *   node packages/senda/scripts/datex-pack.mjs --src dgt  [--route ruta.json] [--buffer 2] [--out pack.json]
 *   node packages/senda/scripts/datex-pack.mjs --src ndw
 *   node packages/senda/scripts/datex-pack.mjs --src ./archivo.xml(.gz)
 * Fuentes: DGT (DATEX II v3.7) y NDW (incidents.xml.gz). Las URL pueden cambiar: los NAP avisan con dos meses.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { parseDatex2, toHazards, corridorPack } from '../src/datex2.mjs';

const SOURCES = { dgt: 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml', ndw: 'https://opendata.ndw.nu/incidents.xml.gz' };
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const src = arg('src', 'dgt'), url = SOURCES[src] ?? src;
let buf;
if (/^https?:/.test(url)) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); buf = Buffer.from(await r.arrayBuffer()); }
else buf = await readFile(url);
const xml = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8');
const records = parseDatex2(xml), hazards = toHazards(records);
const route = arg('route') ? JSON.parse(await readFile(arg('route'), 'utf8')) : null;
const pack = route ? corridorPack(hazards, route, { bufferKm: +arg('buffer', 2) }) : { hazards, bytes: hazards.length * 24, dropped: 0 };
const out = { source: url, fetchedAt: new Date().toISOString(), records: records.length, active: hazards.length, ...pack };
if (arg('out')) await writeFile(arg('out'), JSON.stringify(out)); 
console.log(`${records.length} registros · ${hazards.length} activos con posición · ${pack.hazards.length} en el paquete (${pack.bytes} bytes en tramas SENDA)`);
