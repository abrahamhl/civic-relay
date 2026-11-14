#!/usr/bin/env node
/**
 * SENDA · Plataforma de datos: API v1 estática (se sirve como ficheros, también sin servidor y sin red).
 *
 * Genera investor-next/public/senda/api/v1/:
 *   catalog.json         catálogo de capas con fuente, licencia, hora de descarga, recuento y huella SHA-256 del fichero
 *   layers/<id>.geojson  cada capa en GeoJSON (RFC 7946) con fuente y base en cada elemento
 *   briefing.json        parte del día calculado (no redactado)
 *   openapi.json         contrato OpenAPI 3.1 de lo anterior
 * Todo sale de las fotos reales del repo (scripts/datos-reales/*). No se añade ningún dato.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventsFromGdacs, eventsFromDgt, eventsFromNdw, eventsFromGnss, eventsFromUsgs, eventsFromEmsc, toGeoJSON, dailyBriefing, GDACS_TYPES, DGT_CAUSES, NDW_TYPES } from '../src/atlas.mjs';

const PUB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../investor-next/public'), REF = resolve(PUB, 'senda/data/referencias'), OUT = resolve(PUB, 'senda/api/v1');
const j = (f) => JSON.parse(readFileSync(resolve(REF, f), 'utf8'));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const gdacs = j('gdacs_eventos.json'), dgt = j('dgt_incidencias.json'), ndw = j('ndw_situaciones.json'), adsb = j('adsb_gnss.json'), usgs = j('usgs_sismos.json'), emsc = j('emsc_sismos.json');

const LAYERS = [
  { id: 'mundo-gdacs', titulo: 'Alertas mundiales de desastres (GDACS)', ev: eventsFromGdacs(gdacs), descargadoUTC: gdacs.descargadoUTC, fichero: 'gdacs_eventos.json', licencia: 'Condiciones de uso de GDACS (https://www.gdacs.org/About/termsofuse.aspx)', names: GDACS_TYPES, prefix: 'GDACS_' },
  { id: 'espana-dgt', titulo: 'Incidencias activas en carreteras (DGT, DATEX II)', ev: eventsFromDgt(dgt), descargadoUTC: dgt.descargadoUTC, fichero: 'dgt_incidencias.json', licencia: dgt.licencia, names: DGT_CAUSES, prefix: 'DGT_' },
  { id: 'paises-bajos-ndw', titulo: 'Situación del tráfico en Países Bajos (NDW, DATEX II)', ev: eventsFromNdw(ndw), descargadoUTC: ndw.descargadoUTC, fichero: 'ndw_situaciones.json', licencia: ndw.licencia, names: NDW_TYPES, prefix: 'NDW_' },
  { id: 'mundo-usgs', titulo: 'Sismos M ≥ 4,5 y deslizamientos con señal sísmica (USGS ComCat)', ev: eventsFromUsgs(usgs), descargadoUTC: usgs.descargadoUTC, fichero: 'usgs_sismos.json', licencia: usgs.licencia, names: { earthquake: 'sismo', landslide: 'deslizamiento' }, prefix: 'USGS_' },
  { id: 'mundo-emsc', titulo: 'Sismos M ≥ 4,0 con agencia autora de cada solución (EMSC-CSEM)', ev: eventsFromEmsc(emsc), descargadoUTC: emsc.descargadoUTC, fichero: 'emsc_sismos.json', licencia: emsc.licencia, names: { earthquake: 'sismo' }, prefix: 'EMSC_' },
  { id: 'integridad-gnss', titulo: 'Integridad GNSS desde ADS-B (método GPSJam)', ev: eventsFromGnss(adsb), descargadoUTC: adsb.descargadoUTC, fichero: 'adsb_gnss.json', licencia: 'ODbL 1.0 (© adsb.lol); esta capa derivada también es ODbL 1.0', names: { green: 'verde', yellow: 'amarillo', red: 'rojo' }, prefix: 'GNSS_' },
];

mkdirSync(resolve(OUT, 'layers'), { recursive: true });
const catalog = { plataforma: 'SENDA', version: 'v1', generadoUTC: new Date().toISOString(), aviso: 'Fotos de datos reales con su fuente. No son servicios en tiempo real: la hora de cada descarga va en cada capa.', capas: [] };
for (const L of LAYERS) {
  const gj = JSON.stringify(toGeoJSON(L.ev, { title: L.titulo })), path = `layers/${L.id}.geojson`;
  writeFileSync(resolve(OUT, path), gj + '\n');
  catalog.capas.push({ id: L.id, titulo: L.titulo, url: `/senda/api/v1/${path}`, elementos: L.ev.length, descargadoUTC: L.descargadoUTC, licencia: L.licencia, fuente: [...new Set(L.ev.map((e) => e.source))][0] ?? null,
    base: [...new Set(L.ev.map((e) => e.basis))], sha256: sha(gj), ficheroOrigen: `/senda/data/referencias/${L.fichero}`, sha256Origen: sha(readFileSync(resolve(REF, L.fichero))) });
}
const briefing = { generadoUTC: catalog.generadoUTC, nota: 'Calculado con atlas.dailyBriefing: cada capa usa la hora de su propia descarga como «ahora».',
  capas: LAYERS.filter((L) => L.descargadoUTC).map((L) => ({ id: L.id, hora: L.descargadoUTC, ...dailyBriefing([{ nombre: L.titulo, events: L.ev, names: L.names, prefix: L.prefix }], { now: Date.parse(L.descargadoUTC) })[0] })) };
const openapi = {
  openapi: '3.1.0', info: { title: 'SENDA · API de datos abiertos', version: '1.0.0', description: 'Ficheros estáticos generados con packages/senda/scripts/build-platform-api.mjs a partir de fotos reales. Cada elemento lleva source y basis. Respeta la licencia de cada capa (catalog.json).' },
  paths: {
    '/senda/api/v1/catalog.json': { get: { summary: 'Catálogo de capas con fuente, licencia, hora de descarga y SHA-256', responses: { 200: { description: 'Catálogo' } } } },
    '/senda/api/v1/layers/{id}.geojson': { get: { summary: 'Capa en GeoJSON (RFC 7946)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', enum: LAYERS.map((L) => L.id) } }], responses: { 200: { description: 'FeatureCollection; cada Feature con properties.source y properties.basis' } } } },
    '/senda/api/v1/briefing.json': { get: { summary: 'Parte del día calculado por capa', responses: { 200: { description: 'Parte' } } } },
  },
};
writeFileSync(resolve(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
writeFileSync(resolve(OUT, 'briefing.json'), JSON.stringify(briefing, null, 1) + '\n');
writeFileSync(resolve(OUT, 'openapi.json'), JSON.stringify(openapi, null, 1) + '\n');
console.log(`API v1: ${catalog.capas.map((c) => `${c.id}=${c.elementos}`).join(', ')}`);
