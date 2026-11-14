#!/usr/bin/env node
/**
 * Foto real del caudal GloFAS (Copernicus EMS) vía Open-Meteo Flood API para los puntos de demostración de SENDA,
 * para que la pantalla Avisos tenga contexto también sin red. Uso no comercial (CC BY 4.0, condiciones de Open-Meteo).
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/glofas_snapshot.mjs
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glofasUrl, parseGlofasDaily, GLOFAS_SOURCE } from '../../packages/senda/src/river-context.mjs';

// Punto: las coordenadas de Paiporta que usan las pruebas y la demo de Avisos (no es una estación de aforo).
const PUNTOS = [{ id: 'paiporta', nombre: 'Paiporta (punto de la demo de Avisos)', lat: 39.4269, lon: -0.4174 }];
const out = { fuente: GLOFAS_SOURCE, descargadoUTC: new Date().toISOString(), nota: 'Celda GloFAS más cercana a cada punto; no es una estación de aforo.', puntos: [] };
for (const p of PUNTOS) {
  const url = glofasUrl(p.lat, p.lon), res = await fetch(url); if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const raw = await res.text(); out.puntos.push({ ...p, url, sha256: createHash('sha256').update(raw).digest('hex'), serie: parseGlofasDaily(JSON.parse(raw)) });
}
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/glofas_puntos.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`GloFAS: ${out.puntos.length} punto(s) → ${dst}`);
