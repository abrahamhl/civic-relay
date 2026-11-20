#!/usr/bin/env node
/**
 * Instantánea de avisos para el Radar SENDA: descarga las fuentes públicas, normaliza con alert-watch.mjs y escribe
 * investor-next/public/senda/data/alertas/instantanea.json con la hora de descarga y la huella SHA-256 de cada fuente.
 * En el navegador, el Radar vuelve a pedir EN VIVO las fuentes que lo permiten (CORS: USGS, EMSC, GDACS, EONET);
 * MeteoAlarm no permite peticiones desde el navegador, así que su frescura es la de esta instantánea.
 *
 * Uso: node packages/senda/scripts/fetch-alerts.mjs [--soft]
 *   --soft: si una fuente falla se conserva su parte de la instantánea anterior (para la compilación).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as W from '../src/alert-watch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../../investor-next/public/senda/data/alertas/instantanea.json');
const ZONES = JSON.parse(readFileSync(resolve(here, '../../../investor-next/public/senda/data/alertas/zonas-emma-es-nl.json'), 'utf8')).zonas;
const soft = process.argv.includes('--soft');
const UA = { 'User-Agent': 'SENDA-alert-watch/1.0 (+https://civic-relay-investor.vercel.app/senda/radar)' };

const FEEDS = [
  { id: 'METEOALARM_ES', source: 'METEOALARM', url: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain', parse: (t) => W.fromMeteoalarmAtom(t, ZONES), text: true },
  { id: 'METEOALARM_NL', source: 'METEOALARM', url: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands', parse: (t) => W.fromMeteoalarmAtom(t, ZONES), text: true },
  { id: 'USGS', source: 'USGS', url: W.ALERT_SOURCES.USGS.url, parse: (j) => W.fromUsgs(j) },
  { id: 'EMSC', source: 'EMSC', url: W.ALERT_SOURCES.EMSC.url, parse: (j) => W.fromEmsc(j) },
  { id: 'GDACS', source: 'GDACS', url: W.ALERT_SOURCES.GDACS.url, parse: (j) => W.fromGdacs(j) },
  { id: 'EONET', source: 'EONET', url: W.ALERT_SOURCES.EONET.url, parse: (j) => W.fromEonet(j) },
];

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sources: [], alerts: [] };
const now = Date.now(), sources = [], alerts = [];
for (const f of FEEDS) {
  try {
    const ctl = AbortSignal.timeout(15_000), r = await fetch(f.url, { headers: UA, signal: ctl });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer()), sha256 = createHash('sha256').update(buf).digest('hex');
    const body = f.text ? buf.toString('utf8') : JSON.parse(buf.toString('utf8'));
    // Se guardan los vigentes y previstos; los caducados no se publican en el radar.
    const list = f.parse(body).filter((a) => a.point && W.phaseOf(a, now) !== 'EXPIRED');
    alerts.push(...list);
    sources.push({ id: f.id, source: f.source, url: f.url, fetchedAt: new Date(now).toISOString(), ok: true, count: list.length, sha256 });
  } catch (e) {
    const old = prev.sources.find((s) => s.id === f.id);
    if (soft && old) { sources.push({ ...old, ok: false, error: String(e.message ?? e), keptFrom: old.fetchedAt }); alerts.push(...prev.alerts.filter((a) => a.feed === f.id)); }
    else sources.push({ id: f.id, source: f.source, url: f.url, fetchedAt: new Date(now).toISOString(), ok: false, error: String(e.message ?? e), count: 0 });
  }
  for (const a of alerts) a.feed ??= f.id;
}
// Recortes de tamaño: sin geometría duplicada (la del aviso MeteoAlarm se resuelve en el cliente por geocode).
for (const a of alerts) if (a.source === 'METEOALARM') delete a.geometry;
const out = { generatedAt: new Date(now).toISOString(), basis: 'INSTANTANEA_DE_FUENTES_PUBLICAS', sources, count: alerts.length, alerts };
writeFileSync(OUT, JSON.stringify(out));
console.log(`avisos: ${alerts.length} · ${sources.map((s) => `${s.id} ${s.ok ? s.count : `FALLO (${s.error})`}`).join(' · ')}`);
if (!soft && sources.some((s) => !s.ok)) process.exitCode = 1;
