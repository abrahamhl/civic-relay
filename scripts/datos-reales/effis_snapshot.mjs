#!/usr/bin/env node
/**
 * Descarga real de perímetros de área quemada de EFFIS (European Forest Fire Information System, Copernicus/JRC)
 * para la zona del incendio de San Martín de Valdeiglesias (julio de 2026), por WFS.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/effis_snapshot.mjs
 * Escribe investor-next/public/senda/data/smv2026/effis_perimetros.json con procedencia (URL, hora, SHA-256 de cada respuesta).
 * Condiciones de uso: © Unión Europea, EFFIS; reutilización según la política de la Comisión (citar la fuente). No verificado el texto exacto desde esta sesión.
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BBOX = [40.10, -4.75, 40.55, -4.05]; // lat/lon (EPSG:4326, orden de ejes del WFS 2.0)
const base = 'https://maps.effis.emergency.copernicus.eu/effis?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json;%20subtype=geojson&srsName=EPSG:4326';
const r6 = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5] : c.map(r6));
const capas = {};
for (const layer of ['modis.ba.poly.season']) {
  const url = `${base}&typeNames=ms:${layer}&bbox=${BBOX.join(',')},urn:ogc:def:crs:EPSG::4326`;
  const res = await fetch(url); if (!res.ok) throw new Error(`EFFIS respondió ${res.status}: no se escribe nada`);
  const raw = await res.text(), fc = JSON.parse(raw);
  capas[layer] = { url, sha256: createHash('sha256').update(raw).digest('hex'), features: (fc.features ?? []).map((f) => ({ type: 'Feature', properties: f.properties, geometry: { type: f.geometry.type, coordinates: r6(f.geometry.coordinates) } })) };
}
if (!Object.values(capas).some((c) => c.features.length)) throw new Error('EFFIS no devolvió perímetros: no se escribe nada');
const out = { fuente: 'EFFIS · European Forest Fire Information System (Copernicus EMS, JRC), área quemada MODIS/VIIRS de la temporada', condiciones: '© Unión Europea. Citar EFFIS. Texto exacto de las condiciones no verificado desde la sesión.',
  descargadoUTC: new Date().toISOString(), bboxLatLon: BBOX, nota: 'Perímetros oficiales EFFIS sin modificar salvo redondeo de coordenadas a 1e-5 grados (~1 m). EFFIS solo cartografía áreas ≥ ~30 ha.', capas };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/smv2026/effis_perimetros.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`EFFIS: ${Object.entries(capas).map(([k, c]) => `${k}=${c.features.length}`).join(', ')} → ${dst}`);
