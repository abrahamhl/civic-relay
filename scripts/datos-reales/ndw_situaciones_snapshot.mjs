#!/usr/bin/env node
/**
 * Descarga real de la situación actual del tráfico en Países Bajos (NDW, opendata.ndw.nu, DATEX II v3, «actueel_beeld»).
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/ndw_situaciones_snapshot.mjs
 * La interpreta el lector del núcleo (packages/senda/src/datex2.mjs) y escribe
 * investor-next/public/senda/data/referencias/ndw_situaciones.json con procedencia (URL, hora, SHA-256 del fichero).
 * Licencia: NDW lo publica como open data (factsheet de NDW); la licencia exacta NO está verificada desde esta sesión.
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDatex2 } from '../../packages/senda/src/datex2.mjs';

const URL_NDW = 'https://opendata.ndw.nu/actueel_beeld.xml.gz';
const res = await fetch(URL_NDW);
if (!res.ok) throw new Error(`NDW respondió ${res.status}: no se escribe nada`);
const gz = Buffer.from(await res.arrayBuffer()), xml = gunzipSync(gz).toString('utf8');
const published = /<com:publicationTime>([^<]+)<\/com:publicationTime>/.exec(xml)?.[1] ?? null;
const all = parseDatex2(xml), recs = all.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
if (!recs.length) throw new Error('El fichero no trae situaciones con coordenadas: no se escribe nada');
const out = {
  fuente: 'NDW · Nationaal Dataportaal Wegverkeer (Países Bajos), situación actual DATEX II v3 (actueel_beeld)',
  licencia: 'CC0 1.0 (condiciones generales de datos abiertos de NDW, https://docs.ndw.nu/algemeen/data-gebruiksvoorwaarden/, leídas el 14-11-2026)', url: URL_NDW, descargadoUTC: new Date().toISOString(), publicacionNDW: published,
  sha256Gz: createHash('sha256').update(gz).digest('hex'), registros: all.length, total: recs.length, lector: 'packages/senda/src/datex2.mjs (parseDatex2)',
  nota: 'Situaciones tal como las publica NDW: tipo DATEX II, inicio, carretera si consta y coordenadas. Sin modificar ni completar.',
  situaciones: recs.map((r) => ({ id: r.id, type: r.type, start: r.start, created: r.created, road: r.road, lat: r.lat, lon: r.lon, probability: r.probability })),
};
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/ndw_situaciones.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`NDW: ${recs.length} de ${all.length} situaciones con coordenadas (publicación ${published}) → ${dst}`);
