#!/usr/bin/env node
/**
 * Descarga real de niveles de agua de Rijkswaterstaat (WaterWebservices, API «ddapi20»):
 * medidas («meting») de los últimos DIAS días y previsión oficial («verwachting») de las estaciones de la lista,
 * en cm respecto a NAP. Guarda medias horarias + SHA-256 de cada respuesta cruda.
 * Escribe investor-next/public/senda/data/nl-water/rws_niveles.json. Si la red falla, no escribe.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/rws_agua_snapshot.mjs
 * Licencia: datos abiertos de Rijkswaterstaat (Ministerie van Infrastructuur en Waterstaat), CC0 según su portal de datos
 * — condición NO releída en esta sesión: comprobar antes de un uso comercial.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRws, hourly } from '../../packages/senda/src/water-nl.mjs';

const B = 'https://ddapi20-waterwebservices.rijkswaterstaat.nl', DIAS = 28;
const RIOS = {
  'Rijn · Waal': ['lobith.bovenrijn.tolkamer', 'nijmegen.waal', 'tiel.waal', 'zaltbommel'],
  'Nederrijn · Lek': ['driel.boven', 'culemborg', 'hagestein.beneden'],
  IJssel: ['doesburg.ijssel', 'zutphen.ijssel', 'deventer', 'olst', 'zwolle.ijssel', 'kampen.ijssel'],
  Maas: ['eijsden.grens', 'maastricht.sintpieter', 'roermond.boven', 'venlo', 'well', 'gennep', 'mook', 'grave.beneden', 'lith.beneden'],
  'Delta · costa': ['dordrecht.oudemaas.benedenmerwede', 'rotterdam.nieuwemaas.boerengat', 'hoekvanholland'],
};
const sha = (t) => createHash('sha256').update(t).digest('hex');
const post = async (path, body) => { for (let k = 0; ; k++) { try { const r = await fetch(B + path, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'SENDA-research/1.0' }, body: JSON.stringify(body) }); const raw = await r.text(); if (!r.ok && r.status !== 204) throw new Error(`RWS ${r.status} ${path}: ${raw.slice(0, 120)}`); return { raw, json: raw ? JSON.parse(raw) : {}, sha256: sha(raw) }; } catch (e) { if (k >= 3) throw e; await new Promise((s) => setTimeout(s, 4000 * (k + 1))); } } };
const iso = (d) => d.toISOString().replace('Z', '+00:00');
const cat = await post('/METADATASERVICES/OphalenCatalogus', { CatalogusFilter: { Grootheden: true, Eenheden: true, Hoedanigheden: true, ProcesTypes: true } });
const loc = new Map(cat.json.LocatieLijst.map((l) => [l.Code, l]));
const now = new Date(), consultas = [{ url: B + '/METADATASERVICES/OphalenCatalogus', sha256: cat.sha256 }], estaciones = [];
for (const [rio, codes] of Object.entries(RIOS)) for (const [orden, code] of codes.entries()) {
  const l = loc.get(code); if (!l) { console.log('no está en el catálogo:', code); continue; }
  const q = (pt, a, b) => post('/ONLINEWAARNEMINGENSERVICES/OphalenWaarnemingen', { Locatie: { Code: code }, AquoPlusWaarnemingMetadata: { AquoMetadata: { Grootheid: { Code: 'WATHTE' }, Hoedanigheid: { Code: 'NAP' }, ProcesType: pt } }, Periode: { Begindatumtijd: iso(a), Einddatumtijd: iso(b) } });
  const m = await q('meting', new Date(now - DIAS * 864e5), now), f = await q('verwachting', new Date(now - 3 * 864e5), new Date(+now + 5 * 864e5));
  const pm = parseRws(m.json).meting?.points ?? [], pf = parseRws(f.json).verwachting?.points ?? [];
  consultas.push({ estacion: code, tipo: 'meting', sha256: m.sha256, puntos: pm.length }, { estacion: code, tipo: 'verwachting', sha256: f.sha256, puntos: pf.length });
  estaciones.push({ codigo: code, nombre: l.Naam, rio, orden, lat: l.Lat, lon: l.Lon, medidas: hourly(pm).map((p) => [p.t / 1000, p.v]), prevision: hourly(pf).map((p) => [p.t / 1000, p.v]), puntosCrudos: { medidas: pm.length, prevision: pf.length } });
  console.log(rio, code, pm.length, pf.length, pm.at(-1)?.v);
}
const out = { fuente: 'Rijkswaterstaat · WaterWebservices (ddapi20-waterwebservices.rijkswaterstaat.nl)', magnitud: 'WATHTE · altura de agua en cm respecto a NAP', descargadoUTC: now.toISOString(), diasMedidas: DIAS,
  nota: 'Medias horarias de las medidas de 10 minutos y de la previsión oficial de Rijkswaterstaat. SENDA no produce previsión propia.', licencia: 'Datos abiertos de Rijkswaterstaat; licencia CC0 según su portal — NO releída en esta sesión',
  basis: { medidas: 'MEASURED', prevision: 'OFFICIAL_FORECAST' }, consultas, estaciones };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/nl-water/rws_niveles.json');
await mkdir(dirname(dst), { recursive: true }); await writeFile(dst, JSON.stringify(out));
console.log('estaciones', estaciones.length, '→', dst);
