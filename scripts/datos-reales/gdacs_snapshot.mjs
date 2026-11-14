#!/usr/bin/env node
/**
 * Descarga real de GDACS (Global Disaster Alert and Coordination System, ONU + Comisión Europea) para el Atlas.
 * Uso: node scripts/datos-reales/gdacs_snapshot.mjs [días=30]
 * Escribe investor-next/public/senda/data/referencias/gdacs_eventos.json con procedencia: URL, fecha de descarga,
 * páginas, SHA-256 de cada respuesta cruda y número de eventos. No inventa nada: si la red falla, no escribe.
 * Condiciones de uso de GDACS: https://www.gdacs.org/About/termsofuse.aspx
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const days = Number(process.argv[2] ?? 30), to = new Date(), from = new Date(to.getTime() - days * 86_400_000);
const d = (x) => x.toISOString().slice(0, 10);
const base = `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromdate=${d(from)}&todate=${d(to)}&alertlevel=green;orange;red&eventlist=EQ;TC;FL;VO;DR;WF`;
const pages = [], events = new Map();
for (let n = 1; n <= 50; n++) {
  const url = `${base}&pageNumber=${n}`, res = await fetch(url);
  if (res.status === 204 || res.status === 404) break;
  if (!res.ok) throw new Error(`GDACS respondió ${res.status} en la página ${n}`);
  const raw = await res.text(); if (!raw.trim()) break;
  const fc = JSON.parse(raw), feats = fc.features ?? [];
  pages.push({ n, url, sha256: createHash('sha256').update(raw).digest('hex'), features: feats.length });
  if (!feats.length) break;
  for (const f of feats) {
    const p = f.properties, [lon, lat] = f.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${p.eventtype}:${p.eventid}`, prev = events.get(key);
    if (prev && prev.episode >= p.episodeid) continue; // nos quedamos con el episodio más reciente
    events.set(key, { type: p.eventtype, id: p.eventid, episode: p.episodeid, name: p.name, alert: p.alertlevel, country: p.country ?? null,
      from: p.fromdate + 'Z', to: p.todate + 'Z', lat, lon, severity: p.severitydata?.severity ?? null, severityUnit: p.severitydata?.severityunit ?? null,
      severityText: p.severitydata?.severitytext ?? null, report: p.url?.report ?? null });
  }
  if (feats.length < 100) break;
}
if (!events.size) throw new Error('GDACS no devolvió eventos: no se escribe nada');
const out = { fuente: 'GDACS · Global Disaster Alert and Coordination System (Naciones Unidas y Comisión Europea, JRC)', terminos: 'https://www.gdacs.org/About/termsofuse.aspx',
  descargadoUTC: to.toISOString(), ventana: { desde: d(from), hasta: d(to) }, consulta: base, paginas: pages, total: events.size,
  nota: 'Descarga real con este script. Los niveles de alerta (Green/Orange/Red) y la severidad son los de GDACS, sin modificar.', eventos: [...events.values()].sort((a, b) => a.from.localeCompare(b.from)) };
const dst = resolve(dirname(fileURLToPath(import.meta.url)), '../../investor-next/public/senda/data/referencias/gdacs_eventos.json');
await writeFile(dst, JSON.stringify(out) + '\n');
console.log(`GDACS: ${events.size} eventos en ${pages.length} páginas → ${dst}`);
