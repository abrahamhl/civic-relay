#!/usr/bin/env node
/**
 * Descarga real de las incidencias activas de la DGT (Punto de Acceso Nacional, DATEX II v3.7) para el Atlas.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/dgt_incidencias_snapshot.mjs
 * Interpreta el XML con el lector del propio núcleo (packages/senda/src/datex2.mjs) y escribe
 * investor-next/public/senda/data/referencias/dgt_incidencias.json con procedencia (URL, hora, SHA-256 del XML).
 * Licencia del conjunto de datos: Creative Commons Attribution (ficha «incidencias-dgt-datex2-v3-7» en nap.dgt.es).
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDatex2 } from '../../packages/senda/src/datex2.mjs';

const URL_DGT = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';
const res = await fetch(URL_DGT);
if (!res.ok) throw new Error(`DGT respondió ${res.status}: no se escribe nada`);
const xml = await res.text();
const published = /<com:publicationTime>([^<]+)<\/com:publicationTime>/.exec(xml)?.[1] ?? null;
const recs = parseDatex2(xml).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
if (!recs.length) throw new Error('El XML no trae incidencias con coordenadas: no se escribe nada');
const out = {
  fuente: 'DGT · Punto de Acceso Nacional de tráfico (nap.dgt.es), incidencias activas DATEX II v3.7', licencia: 'Creative Commons Attribution (ficha del conjunto en nap.dgt.es)',
  url: URL_DGT, descargadoUTC: new Date().toISOString(), publicacionDGT: published, sha256Xml: createHash('sha256').update(xml).digest('hex'), bytesXml: xml.length,
  total: recs.length, lector: 'packages/senda/src/datex2.mjs (parseDatex2)',
  nota: 'Incidencias tal como las publica la DGT: tipo DATEX II, causa, inicio, carretera y coordenadas. Sin modificar ni completar.',
  incidencias: recs.map((r) => ({ id: r.id, type: r.type, cause: r.subtypes?.causeType?.[0] ?? null, detail: Object.entries(r.subtypes ?? {}).filter(([k]) => /Type$/.test(k) && !/^(causeType|tpegLinearLocationType|vehicleType)$/.test(k)).map(([, v]) => v[0])[0] ?? null,
    start: r.start, created: r.created, road: r.road, lat: r.lat, lon: r.lon, severity: r.severity, probability: r.probability })),
};
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/dgt_incidencias.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`DGT: ${recs.length} incidencias (publicación ${published}) → ${dst}`);
