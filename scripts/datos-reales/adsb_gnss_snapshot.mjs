#!/usr/bin/env node
/**
 * Foto real de ADS-B (adsb.lol, datos bajo licencia ODbL 1.0) en varias zonas, para el mapa de integridad GNSS.
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/datos-reales/adsb_gnss_snapshot.mjs
 * Guarda solo lo necesario (hex del transpondedor, posición, NACp, NIC): sin matrículas ni vuelos.
 * Base de datos derivada → también ODbL 1.0 (atribución: «© adsb.lol, ODbL»).
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Zonas: España y Países Bajos (mercados de SENDA) y el Báltico, donde GPSJam muestra interferencia frecuente (control positivo).
const ZONAS = [{ id: 'es', nombre: 'Península Ibérica', lat: 40.4, lon: -3.7 }, { id: 'nl', nombre: 'Países Bajos', lat: 52.2, lon: 5.3 }, { id: 'baltico', nombre: 'Báltico sur', lat: 55.0, lon: 20.5 }];
const out = { fuente: 'adsb.lol API v2 (/v2/point, radio 250 NM)', licencia: 'ODbL 1.0 (© adsb.lol); esta extracción también es ODbL', descargadoUTC: new Date().toISOString(), nota: 'Foto instantánea, no agregación de 24 h como GPSJam.', zonas: [] };
for (const z of ZONAS) {
  const url = `https://api.adsb.lol/v2/point/${z.lat}/${z.lon}/250`, res = await fetch(url); if (!res.ok) throw new Error(`adsb.lol respondió ${res.status}`);
  const raw = await res.text(), d = JSON.parse(raw);
  out.zonas.push({ ...z, url, sha256: createHash('sha256').update(raw).digest('hex'), ahoraMs: d.now, filtro: 'solo ADS-B directo (type adsb_icao*) y en vuelo (alt_baro ≠ ground); se excluyen MLAT, TIS-B y ADS-R, cuyo NACp no es el GPS del avión', descartados: (d.ac ?? []).filter((a) => !(/^adsb_icao/.test(a.type ?? '') && a.alt_baro !== 'ground')).length, aviones: (d.ac ?? []).filter((a) => Number.isFinite(a.lat) && /^adsb_icao/.test(a.type ?? '') && a.alt_baro !== 'ground').map((a) => ({ hex: a.hex, lat: a.lat, lon: a.lon, nac_p: a.nac_p ?? null, nic: a.nic ?? null, version: a.version ?? null, sil: a.sil ?? null, category: a.category ?? null })) });
}
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/adsb_gnss.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`ADS-B: ${out.zonas.map((z) => `${z.id}=${z.aviones.length}`).join(', ')} → ${dst}`);
