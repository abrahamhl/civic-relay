#!/usr/bin/env node
/**
 * SENDA LIVE · Importa el cordón de cámaras MEDIDO (investor-next/public/senda/data/perimetro) como acontecimientos
 * con evidencias de cámara. Cada accidente real de la DGT del plan se abre como acontecimiento (si no existe) y cada
 * cámara medida se adjunta como evidencia encadenada (no como fuente independiente).
 * La cuenta de servicio «senda_camaras» recibe el rol TRUST_ANALYST concedido por el administrador (seed previo).
 * Uso: DATABASE_FILE=... node scripts/importar-cordon.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from '../server/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, '../../../investor-next/public/senda/data/perimetro');
const dbFile = process.env.DATABASE_FILE || join(__dirname, '../data/senda-live.db');
const { db, services } = createServer({ dbFile });
const plan = JSON.parse(readFileSync(join(DATA, 'plan.json'), 'utf8')), med = JSON.parse(readFileSync(join(DATA, 'medicion.json'), 'utf8'));
const admin = db.get("SELECT user_id AS id FROM profiles WHERE handle = 'admin'");
if (!admin) { console.error('Falta el administrador: ejecuta antes «node server/cli.mjs seed»'); process.exit(1); }
let svc = db.get("SELECT user_id AS id FROM profiles WHERE handle = 'senda_camaras'")?.id;
if (!svc) svc = services.auth.register({ email: 'camaras@senda.live', password: randomBytes(18).toString('base64url'), handle: 'senda_camaras', displayName: 'SENDA · cordón de cámaras (automático)' }).user.id;
db.run("INSERT OR IGNORE INTO role_assignments(id, user_id, role, granted_by, created_at) VALUES ('role-camaras-1', ?, 'TRUST_ANALYST', ?, ?)", svc, admin.id, Date.now());
let nEv = 0, nCam = 0;
for (const c of plan.casos) {
  const title = `Accidente ${c.carretera ?? ''} · DGT ${c.id}`.replace(/\s+/g, ' ');
  let ev = db.get('SELECT id FROM events WHERE title = ?', title);
  if (!ev) { ev = services.events.createEvent(svc, { title, type: 'traffic', lat: c.lat, lon: c.lon, placeLabel: `${c.carretera ?? 'Vía'} (DGT, incidencia ${c.id})`, startedAt: Date.parse(c.inicio) || Date.now() }); nEv++; }
  const have = new Set(db.all("SELECT external_id FROM event_evidence WHERE event_id = ?", ev.id).map((r) => r.external_id));
  for (const s of c.sectores) {
    const m = s.camara && med.camaras[s.camara.id]; if (!m || m.error || have.has(`dgtcam:${s.camara.id}`)) continue;
    services.events.addCameraEvidence(svc, ev.id, { provider: 'DGT', cameraId: s.camara.id, url: s.camara.url, licence: 'CC BY (DGT, NAP camaras-dgt-datex2-v3-7)', sector: s.nombre, road: s.camara.carretera,
      dKm: s.camara.dKm, lat: s.camara.lat, lon: s.camara.lon, capturedAt: Date.parse(m.capturas[1]), signal: m, method: `dos capturas ≥${med.separacionMinS} s; ${med.modelo.nombre}` });
    nCam++;
  }
}
console.log(`Cordón importado: ${nEv} acontecimiento(s) nuevos, ${nCam} evidencia(s) de cámara.`);
db.close?.();
