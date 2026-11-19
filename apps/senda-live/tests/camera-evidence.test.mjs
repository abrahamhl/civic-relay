/**
 * SENDA LIVE · Evidencia de cámaras públicas en un acontecimiento (cordón perimetral).
 * Usa la medición REAL guardada en investor-next/public/senda/data/perimetro (DGT + YOLOX).
 * Invariantes: solo roles autorizados aportan señales de cámara; entran en la cadena de procedencia; NO son fuente
 * independiente (no cambian el estado de verificación); la lectura nunca dice «confirmado».
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB = join(__dirname, '../data/test-camera-evidence.db');
const DATA = join(__dirname, '../../../investor-next/public/senda/data/perimetro');

test('cordón de cámaras en SENDA LIVE con señales reales', async () => {
  if (existsSync(DB)) rmSync(DB, { force: true });
  const ctx = createServer({ dbFile: DB }); const { db, services } = ctx;
  try {
    const plan = JSON.parse(readFileSync(join(DATA, 'plan.json'), 'utf8')), med = JSON.parse(readFileSync(join(DATA, 'medicion.json'), 'utf8'));
    const caso = plan.casos.find((c) => c.sectores.some((s) => s.camara && med.camaras[s.camara.id] && !med.camaras[s.camara.id].error));
    assert.ok(caso, 'hay un caso con cámaras medidas');
    const reg = (h) => services.auth.register({ email: `${h}@senda.test`, password: 'contraseñaSegura123', handle: h, displayName: h }).user.id;
    const ciudadana = reg('vecina_1'), otra = reg('vecino_2'), analista = reg('analista_1');
    db.run("INSERT INTO role_assignments(id, user_id, role, granted_by, created_at) VALUES ('ra-an-1', ?, 'TRUST_ANALYST', ?, ?)", analista, analista, Date.now());

    const ev = services.events.createEvent(ciudadana, { title: `Accidente ${caso.carretera ?? ''} (DGT ${caso.id})`.trim(), type: 'traffic', lat: caso.lat, lon: caso.lon });
    const before = db.get('SELECT COUNT(*) AS c FROM event_sources WHERE event_id = ?', ev.id).c;
    const sectors = caso.sectores.filter((s) => s.camara && med.camaras[s.camara.id] && !med.camaras[s.camara.id].error);
    const body = (s) => ({ provider: 'DGT', cameraId: s.camara.id, url: s.camara.url, licence: 'CC BY (DGT, NAP)', sector: s.nombre, road: s.camara.carretera, dKm: s.camara.dKm,
      capturedAt: Date.parse(med.camaras[s.camara.id].capturas[1]), signal: med.camaras[s.camara.id], method: 'dos capturas ≥130 s; YOLOX-s' });

    // Una ciudadana sin rol NO puede aportar señales de cámara
    assert.throws(() => services.events.addCameraEvidence(ciudadana, ev.id, body(sectors[0])), (e) => e.status === 403);

    for (const s of sectors) services.events.addCameraEvidence(analista, ev.id, body(s));
    const evid = db.all("SELECT report_hash, prev_hash, metadata FROM event_evidence WHERE event_id = ? ORDER BY created_at, rowid", ev.id);
    assert.equal(evid.length, sectors.length);
    for (let i = 1; i < evid.length; i++) assert.equal(evid[i].prev_hash, evid[i - 1].report_hash, 'cadena de procedencia');
    assert.equal(db.get('SELECT COUNT(*) AS c FROM event_sources WHERE event_id = ?', ev.id).c, before, 'las cámaras no son fuentes independientes');
    assert.equal(services.events.getEvent(ev.id).status ?? db.get('SELECT status FROM events WHERE id = ?', ev.id).status, 'UNVERIFIED_REPORT');

    const per = services.events.cameraPerimeter(ev.id, { road: caso.carretera });
    assert.equal(per.cameras, sectors.length); assert.ok(per.assessment.statements.every((t) => !/confirmad/i.test(t)));
    assert.match(per.note, /no cuentan como fuente independiente/);

    // Dos vecinos independientes sí corroboran (la red social), las cámaras siguen siendo contexto
    services.events.addObservation(ciudadana, ev.id, { text: 'Coches parados en el arcén tras el golpe', lat: caso.lat, lon: caso.lon });
    services.events.addObservation(otra, ev.id, { text: 'Lo veo desde el puente: un carril cortado', lat: caso.lat, lon: caso.lon });
    assert.equal(db.get('SELECT status FROM events WHERE id = ?', ev.id).status, 'CORROBORATED');
  } finally { ctx.db.close?.(); if (existsSync(DB)) rmSync(DB, { force: true }); }
});

test('SENDA LIVE sirve la Consola en el mismo origen con CSP por hashes (sin unsafe-inline) y sin salir del directorio público', async () => {
  const DB2 = join(__dirname, '../data/test-senda-surface.db'); if (existsSync(DB2)) rmSync(DB2, { force: true });
  const ctx = createServer({ dbFile: DB2 });
  await new Promise((r) => ctx.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${ctx.server.address().port}`;
  try {
    const r = await fetch(`${base}/senda/consola`); assert.equal(r.status, 200);
    const csp = r.headers.get('content-security-policy'); assert.match(csp, /script-src 'self' 'sha256-[A-Za-z0-9+/=]+'/); assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /unsafe-inline/);
    assert.match(await r.text(), /SENDA · Consola|SENDA Consola|Consola/);
    const core = await fetch(`${base}/senda/core/camera-perimeter.mjs`); assert.equal(core.status, 200); assert.match(core.headers.get('content-type'), /javascript/);
    for (const t of ['/senda/..%2f..%2fpackage.json', '/senda/..%2f..%2f..%2fpackage.json']) { const body = await (await fetch(`${base}${t}`)).text(); assert.doesNotMatch(body, /"name"\s*:\s*"@/, 'no se sirve nada fuera de investor-next/public'); }
    const per = await fetch(`${base}/api/events/no-existe/camera-perimeter`); assert.equal(per.status, 404);
  } finally { await new Promise((r) => ctx.server.close(r)); ctx.db.close?.(); if (existsSync(DB2)) rmSync(DB2, { force: true }); }
});
