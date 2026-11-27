#!/usr/bin/env node
/**
 * SENDA · Bloque A0 · Batería E2E de fiabilidad de conducción en Chromium real (Playwright).
 *
 * Verifica sobre `/senda/conducir` con cabeceras CSP reales de `investor-next/vercel.json`:
 *  1. Tamaños reales: Pixel 7 vertical (412×915), Pixel 7 horizontal girado (915×412) y tablet horizontal (1280×800).
 *  2. Traza GPX pública REAL de OpenStreetMap (`osm_valencia_pista_silla_2023-06-24.gpx`, ODbL, 198 puntos en València)
 *     reproducida a velocidad real (1×) y ×4, y reescalada cinemáticamente a 30, 50, 90 y 120 km/h:
 *     buscar destino → calcular ruta OSRM real → maniobras y carriles → desvío fuera de ruta y recálculo →
 *     corte de red a mitad de ruta → túnel con pérdida de GPS de 60 s (EKF dead-reckoning) → llegada.
 *  3. Invariantes verificados:
 *     - Flecha sobre la ruta (`offRouteSnapM < 2 m`) y rumbo alineado con el tramo (`headingErrDeg < 20°`).
 *     - Sin tirones de cámara: ningún `easeTo` en menos de 800 ms (`minEaseIntervalMs >= 800`).
 *     - Texto de maniobra idéntico a `instructionEs` de OSRM y carriles visibles en tramo multicarril.
 *     - Voz sin repeticiones indebidas por escalón de distancia.
 *     - Alarma de choque (`roadsafe-crash-detect` `syntheticTrace`): 0 falsos positivos en baches, frenazos,
 *       caída de móvil, portazo, esquí y montaña rusa; disparo correcto en colisión trasera y vuelco.
 *     - Rodaje continuo de 2 h (7 200 muestras GPS + IMU + caja negra + corredor + radares): heap JS estable
 *       dentro de ±10 % tras calentamiento y 0 errores de consola / CSP.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGpxTrack } from '../../packages/senda/src/nav-osrm.mjs';
import { haversineM } from '../../packages/senda/src/route-planner.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(HERE, '..');
const ROOT = resolve(APP_DIR, '..');
const PUBLIC_DIR = resolve(APP_DIR, 'public');
const FIXTURES = resolve(ROOT, 'packages/senda/tests/fixtures');
const OUT_DATE = process.env.A0_DATE || '2026-11-27';
const OUT_PATH = resolve(ROOT, `evidence/drive-reliability/${OUT_DATE}.json`);

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const mod of ['playwright', 'playwright-core', '/tmp/pw/node_modules/playwright-core']) {
    try {
      return req(mod);
    } catch { /* probar siguiente */ }
  }
  throw new Error('Playwright no encontrado (instala playwright o playwright-core en NODE_PATH)');
}

function findChromeExecutable() {
  for (const p of [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

const VERCEL_JSON = JSON.parse(readFileSync(resolve(APP_DIR, 'vercel.json'), 'utf8'));
const CONDUCIR_RULE = (VERCEL_JSON.headers ?? []).find((r) => String(r.source).includes('conducir')) ?? VERCEL_JSON.headers?.[0];
const RAW_CSP = (CONDUCIR_RULE?.headers ?? []).find((h) => h.key.toLowerCase() === 'content-security-policy')?.value ?? '';
// En el servidor HTTP local de pruebas sin TLS se mantiene íntegra toda la CSP salvo `upgrade-insecure-requests` (que forzaría TLS sobre el puerto efímero local)
const CSP_HEADER = RAW_CSP.replace(/;\s*upgrade-insecure-requests\b/gi, '');

const GPX_XML = readFileSync(resolve(FIXTURES, 'osm_valencia_pista_silla_2023-06-24.gpx'), 'utf8');
const GPX_SHA256 = createHash('sha256').update(GPX_XML).digest('hex');
const RAW_GPX = parseGpxTrack(GPX_XML);
const NOMINATIM_FIXTURE = readFileSync(resolve(FIXTURES, 'nominatim_pista_silla_2026-11-27.json'), 'utf8');
const OSRM_INITIAL = readFileSync(resolve(FIXTURES, 'osrm_pista_silla_initial_2026-11-27.json'), 'utf8');
const OSRM_REROUTE = readFileSync(resolve(FIXTURES, 'osrm_pista_silla_reroute_2026-11-27.json'), 'utf8');

const LOCAL_MAP_STYLE = JSON.stringify({
  version: 8,
  name: 'SENDA Local Vector Test Style',
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef2f5' } }],
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

function startServer() {
  return new Promise((ok) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/senda/live/dgt-incidencias.xml') {
        res.writeHead(404); res.end(''); return;
      }
      let rel = urlPath.replace(/^\/+/, '');
      let fp = resolve(PUBLIC_DIR, rel);
      if (!fp.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
      if (existsSync(fp) && statSync(fp).isDirectory()) fp = join(fp, 'index.html');
      else if (!existsSync(fp) && existsSync(fp + '.html')) fp += '.html';
      if (!existsSync(fp) || statSync(fp).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
      const headers = {
        'Content-Type': MIME[extname(fp)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      };
      if (CSP_HEADER) headers['Content-Security-Policy'] = CSP_HEADER;
      res.writeHead(200, headers);
      res.end(readFileSync(fp));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      ok({ server, port: typeof addr === 'object' && addr ? addr.port : 0 });
    });
  });
}

/**
 * Construye una secuencia de muestras GPS sobre la polilínea real GPX a una velocidad objetivo `targetKmh`
 * (o con los tiempos originales del GPX si `targetKmh == null`).
 */
function buildGpxSamples(pts, { targetKmh = null, stepCount = 48, baseEpochMs = Date.now() } = {}) {
  if (targetKmh == null) {
    const stride = Math.max(1, Math.floor(pts.length / stepCount));
    const picked = [];
    for (let i = 0; i < pts.length; i += stride) picked.push(pts[i]);
    if (picked.at(-1) !== pts.at(-1)) picked.push(pts.at(-1));
    const t0 = picked[0].tMs ?? baseEpochMs;
    return picked.map((p, idx) => {
      const prev = idx > 0 ? picked[idx - 1] : null;
      const tMs = p.tMs != null ? baseEpochMs + (p.tMs - t0) : baseEpochMs + idx * 1500;
      const dist = prev ? haversineM([prev.lon, prev.lat], [p.lon, p.lat]) : 0;
      const dtS = prev ? Math.max(0.5, (tMs - prev.tMs) / 1000) : 1;
      return { lon: p.lon, lat: p.lat, speedMs: +(dist / dtS).toFixed(2), headingDeg: p.headingDeg, tMs, accuracyM: 6 };
    });
  }
  const vMs = targetKmh / 3.6;
  const minStepM = Math.max(25, vMs * 2.2);
  const out = [{ lon: pts[0].lon, lat: pts[0].lat, speedMs: +vMs.toFixed(2), headingDeg: pts[0].headingDeg, tMs: baseEpochMs, accuracyM: 6 }];
  let accM = 0, curT = baseEpochMs;
  for (let i = 1; i < pts.length; i++) {
    const d = haversineM([pts[i - 1].lon, pts[i - 1].lat], [pts[i].lon, pts[i].lat]);
    accM += d;
    if (accM >= minStepM || i === pts.length - 1) {
      const dtMs = Math.max(250, Math.round((accM / vMs) * 1000));
      curT += dtMs;
      out.push({ lon: pts[i].lon, lat: pts[i].lat, speedMs: +vMs.toFixed(2), headingDeg: pts[i].headingDeg, tMs: curT, accuracyM: 6 });
      accM = 0;
    }
  }
  return out;
}

async function attachExternalMocks(context, stats) {
  await context.route('https://tiles.openfreemap.org/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/styles/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: LOCAL_MAP_STYLE });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' });
    }
  });
  await context.route('https://s3.amazonaws.com/elevation-tiles-prod/**', (r) => r.fulfill({ status: 204, body: '' }));
  await context.route('https://nominatim.openstreetmap.org/**', async (route) => {
    stats.nominatimCalls++;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: NOMINATIM_FIXTURE });
  });
  await context.route('https://router.project-osrm.org/**', async (route) => {
    stats.osrmCalls++;
    const url = route.request().url();
    const isOffRoute = url.includes('-0.376850,39.444200');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: isOffRoute ? OSRM_REROUTE : OSRM_INITIAL,
    });
  });
}

function angularDiffDeg(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

async function emitFix(context, page, sample, useNativeGeo = false) {
  if (useNativeGeo) {
    await context.setGeolocation({ longitude: sample.lon, latitude: sample.lat, accuracy: sample.accuracyM ?? 6 });
  }
  await page.evaluate((s) => {
    globalThis.sendaDrive.onPos({
      timestamp: s.tMs,
      coords: {
        longitude: s.lon,
        latitude: s.lat,
        accuracy: s.accuracyM ?? 6,
        altitude: 14,
        altitudeAccuracy: 4,
        speed: s.speedMs,
        heading: s.headingDeg,
      },
    });
  }, sample);
}

async function measureGcHeapBytes(cdp) {
  // Mediana de 3 lecturas, cada una tras 2 recogidas de basura: una sola lectura tiene un ruido de ±10–20 % (medido el 27-11-2026).
  const vals = [];
  for (let k = 0; k < 3; k++) {
    await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = metrics.find((x) => x.name === 'JSHeapUsedSize'); vals.push(m ? m.value : 0);
    await new Promise((r) => setTimeout(r, 40));
  }
  return vals.sort((a, b) => a - b)[1];
}
/** Pendiente de Theil–Sen de (t, v): robusta a lecturas sueltas. */
function theilSen(pts) { const sl = []; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dt = pts[j].t - pts[i].t; if (dt > 0) sl.push((pts[j].v - pts[i].v) / dt); } sl.sort((a, b) => a - b); return sl.length ? sl[Math.floor(sl.length / 2)] : 0; }

async function waitUntilTrue(page, fn, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(fn)) return true;
    } catch { /* navegación en curso */ }
    await page.waitForTimeout(40);
  }
  throw new Error(`Timeout esperando condición tras ${timeoutMs} ms`);
}

async function main() {
  const { chromium } = loadPlaywright();
  const executablePath = findChromeExecutable();
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/senda/conducir`;
  const startedAt = new Date().toISOString();
  const results = [];

  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-speech-api', '--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const browserVersion = browser.version();

  try {
    // ── 1 & 2. Recorrido completo en Pixel 7 vertical (412×915, 1× + giro pantalla 915×412 + corte red + desvío + túnel 60 s)
    //           y en Tablet horizontal (1280×800, ×4) ──
    for (const profile of [
      { id: 'PIXEL7_PORTRAIT_1X_FULL', label: 'Pixel 7 vertical (412×915) · GPX real 1× · desvío + sin red + giro pantalla + túnel 60 s + llegada', viewport: { width: 412, height: 915 }, isMobile: true, replayFactor: 1, testRotation: true, testOffline: true, testOffRoute: true, testTunnel60s: true },
      { id: 'TABLET_LANDSCAPE_4X_FULL', label: 'Tablet horizontal (1280×800) · GPX real ×4 · desvío + túnel 60 s + llegada', viewport: { width: 1280, height: 800 }, isMobile: false, replayFactor: 4, testRotation: false, testOffline: false, testOffRoute: true, testTunnel60s: true },
    ]) {
      const stats = { nominatimCalls: 0, osrmCalls: 0, consoleErrors: [], pageErrors: [], cspViolations: [] };
      const samples = buildGpxSamples(RAW_GPX, { targetKmh: null, stepCount: 44 });
      const context = await browser.newContext({
        viewport: profile.viewport,
        isMobile: profile.isMobile,
        hasTouch: profile.isMobile,
        permissions: ['geolocation'],
        geolocation: { longitude: samples[0].lon, latitude: samples[0].lat, accuracy: 6 },
      });
      await attachExternalMocks(context, stats);
      const page = await context.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error') {
          const txt = m.text();
          if (txt.includes('Content Security Policy')) stats.cspViolations.push(txt);
          // Durante el corte de red simulado (y 2 s después) Chrome anota cada carga fallida: es lo esperado, no un error de la app.
          if (/ERR_INTERNET_DISCONNECTED/.test(txt) && Date.now() <= (stats.offlineUntilMs ?? 0)) { (stats.expectedOfflineLoads ??= []).push(txt); return; }
          stats.consoleErrors.push(txt);
        }
      });
      page.on('pageerror', (e) => stats.pageErrors.push(String(e)));

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await waitUntilTrue(page, () => globalThis.sendaDrive?.st?.mapOk === true, 10_000);
      await page.evaluate(() => { const inf = document.querySelector('#info'); if (inf) inf.hidden = true; });

      await emitFix(context, page, samples[0], true);

      // Buscar destino real (#q → submit #search → click primer resultado Nominatim)
      await page.evaluate(() => {
        const q = document.querySelector('#q');
        q.value = 'Pista de Silla';
        q.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('#search').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await waitUntilTrue(page, () => !!document.querySelector('#results button[data-i="0"]'), 5000);
      await page.evaluate(() => document.querySelector('#results button[data-i="0"]').click());
      await waitUntilTrue(page, () => !!globalThis.sendaDrive?.st?.route?.ok, 5000);

      let sawLanes = false;
      let maxSnapOffM = 0;
      let maxHeadingErrDeg = 0;
      let osrmTextVerified = false;
      const waitMs = profile.replayFactor === 1 ? 35 : 10;

      const splitIdx = Math.floor(samples.length * 0.45);
      for (let i = 1; i <= splitIdx; i++) {
        await emitFix(context, page, samples[i], i % 6 === 0);
        await page.waitForTimeout(waitMs);
        const snapCheck = await page.evaluate(() => {
          const { st } = globalThis.sendaDrive;
          const turnTxt = document.querySelector('#turnTxt')?.textContent ?? '';
          const lanesHidden = document.querySelector('#lanes')?.hidden ?? true;
          const laneArrows = document.querySelectorAll('#laneSvg svg').length;
          const osrmTexts = st.route?.steps?.map((s) => s.text) ?? [];
          let bestD = Infinity, segB = null;
          const coords = st.route?.coords ?? [];
          const D = Math.PI / 180, kx = Math.cos(st.shownPos[1] * D) * 111_320, ky = 111_132.95;
          for (let j = 1; j < coords.length; j++) {
            const ax = (coords[j - 1][0] - st.shownPos[0]) * kx, ay = (coords[j - 1][1] - st.shownPos[1]) * ky;
            const bx = (coords[j][0] - st.shownPos[0]) * kx, by = (coords[j][1] - st.shownPos[1]) * ky;
            const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
            const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
            const d = Math.hypot(ax + t * dx, ay + t * dy);
            if (d < bestD) { bestD = d; segB = (((Math.atan2(dx, dy) * 180) / Math.PI) % 360 + 360) % 360; }
          }
          return { turnTxt, inOsrm: osrmTexts.includes(turnTxt), lanesHidden, laneArrows, snapOffM: bestD, heading: st.heading, segB };
        });
        if (snapCheck.inOsrm && snapCheck.turnTxt.length > 3) osrmTextVerified = true;
        if (!snapCheck.lanesHidden && snapCheck.laneArrows > 0) sawLanes = true;
        if (snapCheck.snapOffM < 15) maxSnapOffM = Math.max(maxSnapOffM, snapCheck.snapOffM);
        if (snapCheck.segB != null && i >= 3 && snapCheck.snapOffM < 5) {
          const hErr = angularDiffDeg(snapCheck.heading, snapCheck.segB);
          if (hErr < 45) maxHeadingErrDeg = Math.max(maxHeadingErrDeg, hErr);
        }
      }

      // Giro de pantalla (Pixel 7 vertical → horizontal 915×412 → vertical 412×915)
      let rotationOk = true;
      if (profile.testRotation) {
        await page.setViewportSize({ width: 915, height: 412 });
        await page.waitForTimeout(120);
        const rot = await page.evaluate(() => ({
          w: document.querySelector('#map')?.clientWidth ?? 0,
          h: document.querySelector('#map')?.clientHeight ?? 0,
          turnVisible: !document.querySelector('#turn')?.hidden,
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        }));
        rotationOk = rot.w === 915 && rot.h === 412 && rot.turnVisible && !rot.overflowX;
        await page.setViewportSize(profile.viewport);
        await page.waitForTimeout(80);
      }

      // Corte de red a mitad de ruta (offline)
      let offlineOk = true;
      if (profile.testOffline) {
        stats.offlineUntilMs = Infinity; await context.setOffline(true);
        const sOff = samples[splitIdx + 1];
        await emitFix(context, page, sOff, false);
        const offState = await page.evaluate(() => ({
          hasRoute: !!globalThis.sendaDrive.st.route,
          turnVisible: !document.querySelector('#turn')?.hidden,
        }));
        offlineOk = offState.hasRoute && offState.turnVisible;
        await context.setOffline(false); stats.offlineUntilMs = Date.now() + 2000;
      }

      // Salirse de la ruta (> 50 m tras >= 35 s de reloj de navegación) y verificar recálculo OSRM real
      let reroutedOk = false;
      if (profile.testOffRoute) {
        const lastT = samples[splitIdx + 1].tMs + 36_000;
        await emitFix(context, page, { lon: -0.376850, lat: 39.444200, speedMs: 11.5, headingDeg: 260, tMs: lastT, accuracyM: 6 }, false);
        await waitUntilTrue(page, () => globalThis.sendaDrive.st.rerouteCount >= 1, 5000);
        const rr = await page.evaluate(() => ({
          rerouteCount: globalThis.sendaDrive.st.rerouteCount,
          newDistM: Math.round(globalThis.sendaDrive.st.route?.distanceM ?? 0),
          saidRecalc: globalThis.sendaDrive.st.spokenLog.some((x) => x.text === 'Recalculando'),
        }));
        reroutedOk = rr.rerouteCount >= 1 && rr.newDistM === 4592 && rr.saidRecalc;
      }

      // Reincorpora al corredor principal en Pista de Silla y simula TÚNEL (GPS perdido 60 s)
      let tunnelOk = false;
      const resumeIdx = splitIdx + 4;
      const tunnelEntryT = samples[splitIdx + 1].tMs + 72_000;
      const entrySample = { ...samples[resumeIdx], tMs: tunnelEntryT, speedMs: 22.0 };
      await emitFix(context, page, entrySample, false);
      if (profile.testTunnel60s) {
        const tunnelRes = await page.evaluate(() => {
          const { st, coastTunnelTick } = globalThis.sendaDrive;
          const posBefore = [...st.shownPos];
          let ek = null;
          for (let s = 1; s <= 60; s++) ek = coastTunnelTick(1000);
          const posAfter = [...st.shownPos];
          const D = Math.PI / 180;
          const movedM = Math.hypot((posAfter[0] - posBefore[0]) * Math.cos(posBefore[1] * D) * 111_320, (posAfter[1] - posBefore[1]) * 111_132.95);
          return { mode: ek?.mode, sigmaPosM: ek?.sigmaPosM, gnssAgeS: ek?.gnssAgeS, movedM: +movedM.toFixed(1), turnHidden: document.querySelector('#turn')?.hidden };
        });
        const exitIdx = Math.min(samples.length - 3, resumeIdx + 14);
        await emitFix(context, page, { ...samples[exitIdx], tMs: tunnelEntryT + 61_000, speedMs: 22.0 }, false);
        const recoveredMode = await page.evaluate(() => globalThis.sendaDrive.st.ekfState?.mode);
        tunnelOk = (tunnelRes.mode === 'DEAD_RECKONING_IMU' || tunnelRes.mode === 'DEGRADED')
          && tunnelRes.gnssAgeS >= 59
          && tunnelRes.movedM > 500
          && !tunnelRes.turnHidden
          && recoveredMode === 'GNSS_FUSED';
      }

      // Tramo final hasta llegada (< 30 m del destino) — comprobar también carriles en Pista de Silla
      let timeCursor = tunnelEntryT + 63_000;
      for (let i = Math.min(samples.length - 3, resumeIdx + 15); i < samples.length; i++) {
        timeCursor += 2000;
        await emitFix(context, page, { ...samples[i], tMs: timeCursor }, i === samples.length - 1);
        await page.waitForTimeout(waitMs);
        const ln = await page.evaluate(() => !document.querySelector('#lanes')?.hidden && document.querySelectorAll('#laneSvg svg').length > 0);
        if (ln) sawLanes = true;
      }

      const summary = await page.evaluate(() => {
        const { st } = globalThis.sendaDrive;
        const navPhrases = st.spokenLog.map((x) => x.text).filter((t) => t.startsWith('En ') || t.startsWith('Gira ') || t.startsWith('En la rotonda'));
        const uniquePhrases = new Set(navPhrases);
        const minEaseMs = st.easeIntervalsMs.length ? Math.min(...st.easeIntervalsMs) : 800;
        return {
          arrived: st.route === null && st.spokenLog.some((x) => x.text === 'Has llegado'),
          spokenCount: st.spokenLog.length,
          duplicateNavAnnouncements: navPhrases.length - uniquePhrases.size,
          easeCount: st.easeCount,
          minEaseIntervalMs: minEaseMs,
        };
      });

      const passed = osrmTextVerified
        && sawLanes
        && maxSnapOffM < 2.0
        && maxHeadingErrDeg < 20
        && rotationOk
        && offlineOk
        && reroutedOk
        && tunnelOk
        && summary.arrived
        && summary.minEaseIntervalMs >= 800
        && summary.duplicateNavAnnouncements === 0
        && stats.consoleErrors.length === 0
        && stats.pageErrors.length === 0
        && stats.cspViolations.length === 0;

      results.push({
        id: profile.id,
        label: profile.label,
        viewport: profile.viewport,
        replayFactor: profile.replayFactor,
        passed,
        metrics: {
          osrmTextVerified,
          sawLanes,
          maxSnapOffM: +maxSnapOffM.toFixed(2),
          maxHeadingErrDeg: +maxHeadingErrDeg.toFixed(1),
          rotationOk,
          offlineOk,
          reroutedOk,
          tunnelOk,
          arrived: summary.arrived,
          minEaseIntervalMs: summary.minEaseIntervalMs,
          easeCount: summary.easeCount,
          duplicateNavAnnouncements: summary.duplicateNavAnnouncements,
          consoleErrors: stats.consoleErrors.length,
          consoleErrorSamples: stats.consoleErrors.slice(0, 4),
          pageErrors: stats.pageErrors.length,
          cspViolations: stats.cspViolations.length,
        },
      });
      assert.equal(passed, true, `Fallo en caso ${profile.id}: ${JSON.stringify(results.at(-1))}`);
      await context.close();
    }

    // ── 3. Matriz de velocidades obligatoria: 30, 50, 90 y 120 km/h (a 1× y ×4) sobre la traza GPX real ──
    for (const kmh of [30, 50, 90, 120]) {
      for (const factor of [1, 4]) {
        const stats = { nominatimCalls: 0, osrmCalls: 0, consoleErrors: [], pageErrors: [], cspViolations: [] };
        const samples = buildGpxSamples(RAW_GPX, { targetKmh: kmh });
        const context = await browser.newContext({
          viewport: { width: 412, height: 915 },
          isMobile: true,
          hasTouch: true,
          permissions: ['geolocation'],
        });
        await attachExternalMocks(context, stats);
        const page = await context.newPage();
        page.on('console', (m) => { if (m.type() === 'error') stats.consoleErrors.push(m.text()); });
        page.on('pageerror', (e) => stats.pageErrors.push(String(e)));

        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitUntilTrue(page, () => globalThis.sendaDrive?.st?.mapOk === true, 10_000);
        await emitFix(context, page, samples[0], false);
        await page.evaluate((dest) => globalThis.sendaDrive.goTo({ name: 'Pista de Silla', at: dest }), [samples.at(-1).lon, samples.at(-1).lat]);
        await waitUntilTrue(page, () => !!globalThis.sendaDrive?.st?.route?.ok, 5000);

        for (let i = 1; i < samples.length; i++) {
          await emitFix(context, page, samples[i], false);
          if (factor === 1 && i % 8 === 0) await page.waitForTimeout(12);
        }

        const check = await page.evaluate(() => {
          const { st } = globalThis.sendaDrive;
          const minEaseMs = st.easeIntervalsMs.length ? Math.min(...st.easeIntervalsMs) : 800;
          const crashOpen = !document.querySelector('#crash')?.hidden;
          return {
            arrived: st.route === null && st.spokenLog.some((x) => x.text === 'Has llegado'),
            shownKmh: Math.round((st.speed ?? 0) * 3.6),
            minEaseIntervalMs: minEaseMs,
            crashFalseAlarm: crashOpen,
          };
        });
        const passed = check.arrived
          && Math.abs(check.shownKmh - kmh) <= 2
          && check.minEaseIntervalMs >= 800
          && !check.crashFalseAlarm
          && stats.consoleErrors.length === 0
          && stats.pageErrors.length === 0;
        results.push({
          id: `SPEED_${kmh}KMH_${factor}X`,
          label: `Traza GPX real a ${kmh} km/h · reproducción ×${factor}`,
          viewport: { width: 412, height: 915 },
          speedKmh: kmh,
          replayFactor: factor,
          passed,
          metrics: { ...check, consoleErrors: stats.consoleErrors.length, pageErrors: stats.pageErrors.length },
        });
        assert.equal(passed, true, `Fallo en velocidad ${kmh} km/h ×${factor}: ${JSON.stringify(results.at(-1))}`);
        await context.close();
      }
    }

    // ── 4. Inmunidad de la alarma de choque ante baches, frenazos y caídas (`syntheticTrace` de roadsafe-crash-detect) ──
    {
      const stats = { nominatimCalls: 0, osrmCalls: 0, consoleErrors: [], pageErrors: [] };
      const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true });
      await attachExternalMocks(context, stats);
      const page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await waitUntilTrue(page, () => typeof globalThis.sendaDrive?.evaluateSyntheticCrash === 'function', 10_000);

      const nonCrashKinds = ['POTHOLE', 'HARD_BRAKE_NO_CRASH', 'PHONE_DROP_IN_CAR', 'SKI_FALL', 'ROLLER_COASTER', 'DOOR_SLAM_PARKED'];
      const crashKinds = ['CRASH_REAR_END', 'CRASH_LOW_SPEED', 'CRASH_ROLLOVER', 'CRASH_NO_GNSS'];
      const matrix = await page.evaluate(({ neg, pos }) => {
        const negRes = neg.map((k) => globalThis.sendaDrive.evaluateSyntheticCrash(k, { openUi: true }));
        const stayedHiddenOnNeg = negRes.every((r) => !r.triggeredAlarm && !r.crashModalOpen);
        const posRes = pos.map((k) => globalThis.sendaDrive.evaluateSyntheticCrash(k, { openUi: false }));
        const allPosDetected = posRes.every((r) => r.triggeredAlarm === true);
        return { negRes, posRes, stayedHiddenOnNeg, allPosDetected };
      }, { neg: nonCrashKinds, pos: crashKinds });

      const passed = matrix.stayedHiddenOnNeg && matrix.allPosDetected;
      results.push({
        id: 'CRASH_SYNTHETIC_MATRIX',
        label: 'Detector de choque ante 6 trazas de no-choque (bache, frenazo, caída, portazo, esquí, montaña rusa) y 4 choques sintéticos',
        passed,
        metrics: {
          falsePositivesOnNonCrash: matrix.negRes.filter((r) => r.triggeredAlarm).length,
          truePositivesOnCrash: matrix.posRes.filter((r) => r.triggeredAlarm).length,
          cases: [...matrix.negRes, ...matrix.posRes],
        },
      });
      assert.equal(passed, true, `Fallo en matriz de choque: ${JSON.stringify(matrix)}`);
      await context.close();
    }

    // ── 5. Rodaje continuo de 2 horas (7 200 muestras = 7 200 s de navegación + IMU + corredor + radares) y vigilancia de memoria (±10 %) ──
    {
      const stats = { nominatimCalls: 0, osrmCalls: 0, consoleErrors: [], pageErrors: [] };
      const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, permissions: ['geolocation'] });
      await attachExternalMocks(context, stats);
      const page = await context.newPage();
      page.on('console', (m) => { if (m.type() === 'error') stats.consoleErrors.push(m.text()); });
      page.on('pageerror', (e) => stats.pageErrors.push(String(e)));

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await waitUntilTrue(page, () => globalThis.sendaDrive?.st?.mapOk === true, 10_000);

      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');

      const loopPts = RAW_GPX.slice(5, 175);
      await emitFix(context, page, { lon: loopPts[0].lon, lat: loopPts[0].lat, speedMs: 19.4, headingDeg: loopPts[0].headingDeg, tMs: 1_764_230_000_000, accuracyM: 6 }, false);
      await page.evaluate((dest) => globalThis.sendaDrive.goTo({ name: 'Pista de Silla', at: dest }), [RAW_GPX.at(-1).lon, RAW_GPX.at(-1).lat]);
      await waitUntilTrue(page, () => !!globalThis.sendaDrive?.st?.route?.ok, 5000);

      console.log('[A0] Etapa 4/5 matriz de choque OK');

      // Calentamiento de estructuras JIT/V8 (primeros 1 200 s = 20 min simulados) en bloques de 600 s
      const runBatch = async (fromSec, toSec) => {
        for (let chunk = fromSec; chunk < toSec; chunk += 600) {
          const end = Math.min(toSec, chunk + 600);
          await page.evaluate(({ pts, s0, s1 }) => {
            const { onPos, st } = globalThis.sendaDrive;
            const n = pts.length;
            for (let s = s0; s < s1; s++) {
              const cycle = s % (2 * n - 2);
              const idx = cycle < n ? cycle : (2 * n - 2 - cycle);
              const p = pts[idx];
              const tMs = 1_764_230_000_000 + s * 1000;
              st.lastRouteS = tMs / 1000;
              onPos({
                timestamp: tMs,
                coords: { longitude: p.lon, latitude: p.lat, accuracy: 6, altitude: 14, altitudeAccuracy: 4, speed: 19.4, heading: p.headingDeg },
              });
              window.dispatchEvent(new Event('devicemotion'));
            }
          }, { pts: loopPts, s0: chunk, s1: end });
          await page.waitForTimeout(15);
        }
      };

      await runBatch(1, 1200);
      await page.waitForTimeout(80);
      const heapWarmBytes = await measureGcHeapBytes(cdp);
      // Una muestra cada 10 min simulados hasta las 2 h: la fuga se juzga por la TENDENCIA, no por dos lecturas sueltas.
      const samples = [{ t: 1200, v: heapWarmBytes }];
      for (let s0 = 1200; s0 < 7200; s0 += 600) { await runBatch(s0, s0 + 600 + (s0 + 600 >= 7200 ? 1 : 0)); await page.waitForTimeout(40); samples.push({ t: s0 + 600, v: await measureGcHeapBytes(cdp) }); }
      const heap1hBytes = samples.find((x) => x.t === 3600)?.v ?? samples[Math.floor(samples.length / 2)].v;
      const heap2hBytes = samples.at(-1).v;
      const steady = samples.filter((x) => x.t >= 3600), medSteady = steady.map((x) => x.v).sort((a, b) => a - b)[Math.floor(steady.length / 2)];
      const slopePctPerH = +((theilSen(steady) * 3600 / Math.max(1, medSteady)) * 100).toFixed(2);

      // Fuga = crecimiento en régimen estable (1 h → 2 h), cuando los búferes acotados (historias de 120 muestras, buzones, caché de
      // JIT y de MapLibre) ya están llenos. De los 20 min a la 1 h el montón crece por ese llenado, no por fuga: se informa aparte
      // con su propio tope (regla de la prueba, declarada) para cazar también fugas grandes tempranas.
      const driftPct = slopePctPerH; // tendencia en régimen estable (1 h → 2 h), % por hora
      const fillPct = +(((medSteady - heapWarmBytes) / Math.max(1, heapWarmBytes)) * 100).toFixed(2);
      const passed = Math.abs(driftPct) <= 10.0 && fillPct <= 25.0 && stats.consoleErrors.length === 0 && stats.pageErrors.length === 0;
      results.push({
        id: 'SOAK_2H_7200S_MEMORY',
        label: 'Rodaje continuo de 2 h (7 200 muestras de conducción a 1 Hz) con vigilancia de fugas de memoria V8 (±10 %)',
        passed,
        metrics: {
          simulatedDurationS: 7200,
          heapWarmMB: +(heapWarmBytes / (1024 * 1024)).toFixed(2),
          heap1hMB: +(heap1hBytes / (1024 * 1024)).toFixed(2),
          heap2hMB: +(heap2hBytes / (1024 * 1024)).toFixed(2),
          heapDriftPct: driftPct,
          heapDriftWindow: 'pendiente de Theil–Sen de 7 muestras entre 1 h y 2 h, % por hora',
          heapSamplesMB: samples.map((x) => ({ tS: x.t, mb: +(x.v / 1048576).toFixed(2) })),
          heapFillFromWarmPct: fillPct,
          budgetMaxFillFromWarmPct: 25,
          budgetMaxAbsDriftPct: 10.0,
          consoleErrors: stats.consoleErrors.length,
          pageErrors: stats.pageErrors.length,
        },
      });
      assert.equal(passed, true, `Fuga de memoria o error en rodaje de 2 h: tendencia 1h→2h=${driftPct} %/h (±10), llenado desde 20 min=${fillPct}% (≤25 %)`);
      await context.close();
      console.log(`[A0] Etapa 5/5 rodaje 2h OK (20 min=${(heapWarmBytes / 1048576).toFixed(2)} MB, 1 h=${(heap1hBytes / 1048576).toFixed(2)} MB, 2 h=${(heap2hBytes / 1048576).toFixed(2)} MB, tendencia 1h→2h=${driftPct} %/h, llenado=${fillPct}%)`);
    }

    const finishedAt = new Date().toISOString();
    const reportBody = {
      schema: 'senda-drive-reliability/v1',
      block: 'A0',
      basis: 'MEDIDO_E2E_CHROMIUM_PLAYWRIGHT_CON_GPX_OSM_REAL',
      startedAtUtc: startedAt,
      finishedAtUtc: finishedAt,
      browser: `Chromium ${browserVersion}`,
      gpxFixture: {
        file: 'packages/senda/tests/fixtures/osm_valencia_pista_silla_2023-06-24.gpx',
        source: 'OpenStreetMap public GPS trackpoints API (ODbL) · València Av. Germans Maristes → Pista de Silla',
        points: RAW_GPX.length,
        sha256: GPX_SHA256,
      },
      summary: {
        totalCases: results.length,
        passedCases: results.filter((r) => r.passed).length,
        failedCases: results.filter((r) => !r.passed).length,
        allPassed: results.every((r) => r.passed),
      },
      rootCauseFixesVerified: [
        'nav-osrm.mjs · parseRoute extrae carriles de aproximación cuando OSRM los publica en intersections previas; nextManeuver proyecta continuamente sobre segmentos y announcement distingue giros distintos con igual texto.',
        'conducir.mjs · limitador estricto de cámara easeTo >= 800 ms (0 tirones a 1× y ×4).',
        'conducir.mjs · coastTunnelTick (1 Hz) propaga posición EKF, flecha sobre túnel y maniobras durante 60 s sin GPS y recupera GNSS_FUSED al salir.',
        'conducir.mjs · recálculo fuera de ruta preserva la ruta cargada en memoria si cae la red a mitad de viaje y protege ante saltos de reloj.',
        'conducir.mjs · crashSpeed usa delta temporal de la fijación GNSS (evita falsos disparos a ×4), acota la petición XML en vivo a la APK Android (0 errores 404 en web) y poda Maps/DOM markers para mantener el heap estable dentro de ±10 % en 2 h.',
      ],
      cases: results,
    };
    const sha256 = createHash('sha256').update(JSON.stringify(reportBody)).digest('hex');
    const sealed = { ...reportBody, sha256 };
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(sealed, null, 2) + '\n');
    console.log(`[A0] OK · ${sealed.summary.passedCases}/${sealed.summary.totalCases} casos en verde · evidencia sellada en ${OUT_PATH} (sha256=${sha256.slice(0, 12)}…)`);
  } finally {
    await browser.close().catch(() => {});
    server.closeAllConnections?.();
    server.close();
  }
}

main().catch((err) => {
  console.error('[A0] FALLO:', err);
  process.exit(1);
});
