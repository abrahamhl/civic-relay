// Escenas calculadas de /senda/explica: apagón, carrera de caminos, cámara y señal, drones.
// Ejecutan los módulos de /senda/core en el navegador.
import { planMultiBearer, BEARERS } from '/senda/core/bearers.mjs';
import { auditIndependentPlan, DEFAULT_HAZARDS } from '/senda/core/delivery-assurance.mjs';
import { encodeShards, decodeShards } from '/senda/core/erasure.mjs';
import { syntheticCity, survival, BACKUP, cellCoverage, placeGateways } from '/senda/core/blackout.mjs';
import { locateBeacon, projectToCamera } from '/senda/core/rubble.mjs';
import { CAPABILITIES, synthesizeCsi, analyzeCsi } from '/senda/core/through-wall.mjs';
import { encodeLocation, decodeOdid, muleSortie } from '/senda/core/drone.mjs';
import { sweepScenario, planSweep, sweepBoard } from '/senda/core/house-sweep.mjs';

const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pct = (x, d = 1) => (100 * x).toFixed(d).replace('.', ',') + ' %';
const fmt = (x) => Math.round(x).toLocaleString('es-ES');
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(R) { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
/** Ejecuta un bucle de animación solo mientras el lienzo está en pantalla. */
function loop(canvas, draw) {
  let on = false, raf = 0, last = performance.now();
  const tick = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; draw(dt, t / 1000); if (on) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); }).observe(canvas);
}

/* ======================= ESCENA 1 · apagón ======================= */
{
  const city = syntheticCity();
  const cv = $('#bk-cv'), g = cv.getContext('2d'), ch = $('#bk-chart'), gc = ch.getContext('2d');
  const lats = city.cells.map((c) => c.lat), lons = city.cells.map((c) => c.lon);
  const box = { la0: Math.min(...lats), la1: Math.max(...lats), lo0: Math.min(...lons), lo1: Math.max(...lons) };
  const X = (lon) => 30 + ((lon - box.lo0) / (box.lo1 - box.lo0)) * (cv.width - 60), Y = (lat) => 30 + ((box.la1 - lat) / (box.la1 - box.la0)) * (cv.height - 60);
  const cw = (cv.width - 60) / 23, chh = (cv.height - 60) / 23;
  let T = 0, playing = false, gw = null;
  const covAt = (t) => city.cells.map((c) => cellCoverage(c, city.towers, t));
  function stats(t) {
    const cov = covAt(t), pop = city.cells.reduce((a, c) => a + c.pop, 0);
    const covered = city.cells.reduce((a, c, i) => a + c.pop * cov[i], 0);
    const alive = city.towers.reduce((a, tw) => a + survival(t, BACKUP[tw.backup]), 0);
    return { cov, pctCov: covered / pop, dark: pop - covered, alive };
  }
  function drawMap() {
    const s = stats(T);
    g.fillStyle = '#071018'; g.fillRect(0, 0, cv.width, cv.height);
    city.cells.forEach((c, i) => { const v = s.cov[i]; g.fillStyle = `rgba(${Math.round(255 * (1 - v))},${Math.round(90 + 60 * v)},${Math.round(110 + 120 * v)},${0.25 + 0.5 * (1 - v) * 0.6 + 0.2 * v})`; g.fillRect(X(c.lon) - cw / 2, Y(c.lat) - chh / 2, cw - 1, chh - 1); });
    for (const tw of city.towers) {
      const S = survival(T, BACKUP[tw.backup]), x = X(tw.lon), y = Y(tw.lat);
      g.globalAlpha = 0.25 + 0.75 * S; g.strokeStyle = S > 0.5 ? '#91d7e8' : '#ff5b6e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x - 6, y + 7); g.moveTo(x, y - 9); g.lineTo(x + 6, y + 7); g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.stroke();
      if (S > 0.5 && !REDUCED) { g.globalAlpha = 0.25 * S * (0.5 + 0.5 * Math.sin(performance.now() / 300 + x)); g.beginPath(); g.arc(x, y - 9, 8, -2.4, -0.7); g.stroke(); }
      g.globalAlpha = 1;
    }
    if (gw) for (const p of gw.picks) { const x = X(p.lon), y = Y(p.lat); g.strokeStyle = '#fbbf24'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 2000 / ((box.lo1 - box.lo0) * 111320 * Math.cos(39.47 * Math.PI / 180)) * (cv.width - 60), 0, 7); g.stroke(); g.fillStyle = '#fbbf24'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.fill(); }
    g.fillStyle = '#f2f4f4'; g.font = '600 15px system-ui'; g.fillText(`${T.toFixed(1).replace('.', ',')} h sin luz`, 18, 24);
    g.fillStyle = '#9fb2bc'; g.font = '12px system-ui'; g.fillText('Ciudad SINTÉTICA de ejemplo · antenas: azul = probablemente viva, rojo = probablemente apagada', 18, cv.height - 10);
    $('#bk-tv').textContent = `${T.toFixed(1).replace('.', ',')} h`; $('#bk-cov').textContent = pct(s.pctCov, 0); $('#bk-dark').textContent = fmt(s.dark); $('#bk-alive').textContent = `${Math.round(s.alive)} / 60`;
    $('#bk-reach').textContent = gw ? pct(gw.reachedPct / 100, 0) : '—';
    drawChart();
  }
  // La curva se calcula una vez por paso de 0,5 h: cachear para no recalcular 49 veces por fotograma.
  const curve = []; for (let h = 0; h <= 24; h += 0.5) curve.push(stats(h).pctCov);
  function drawChart() {
    const W = ch.width, H = ch.height; gc.fillStyle = '#071018'; gc.fillRect(0, 0, W, H);
    const px = (h) => 40 + (h / 24) * (W - 55), py = (v) => 15 + (1 - v) * (H - 45);
    gc.strokeStyle = '#203240'; gc.fillStyle = '#9fb2bc'; gc.font = '11px system-ui'; gc.lineWidth = 1;
    for (const v of [0, 0.5, 1]) { gc.beginPath(); gc.moveTo(40, py(v)); gc.lineTo(W - 15, py(v)); gc.stroke(); gc.fillText(`${v * 100} %`, 4, py(v) + 4); }
    for (const h of [0, 6, 12, 18, 24]) gc.fillText(`${h} h`, px(h) - 8, H - 12);
    gc.strokeStyle = '#91d7e8'; gc.lineWidth = 2; gc.beginPath(); curve.forEach((v, i) => (i ? gc.lineTo(px(i / 2), py(v)) : gc.moveTo(px(0), py(v)))); gc.stroke();
    gc.strokeStyle = '#ff7756'; gc.beginPath(); gc.moveTo(px(T), 10); gc.lineTo(px(T), H - 28); gc.stroke();
    gc.fillStyle = '#9fb2bc'; gc.fillText('población con cobertura (calculada)', 46, 12);
  }
  $('#bk-t').addEventListener('input', (e) => { T = +e.target.value; gw = null; drawMap(); });
  $('#bk-play').addEventListener('click', () => { playing = !playing; $('#bk-play').textContent = playing ? '❚❚ Pausa' : '▶ Reproducir'; if (playing && T >= 24) T = 0; });
  $('#bk-gw').addEventListener('click', () => { gw = placeGateways({ ...city, tH: Math.max(T, 0.25), k: 3 }); drawMap(); });
  loop(cv, (dt) => { if (playing) { T = Math.min(24, T + dt * 2); $('#bk-t').value = T; if (T >= 24) { playing = false; $('#bk-play').textContent = '▶ Reproducir'; } } drawMap(); });
  drawMap();
}

/* ======================= ESCENA 2 · carrera de caminos ======================= */
{
  const MSG = 'SOS · somos 3 (una niña de 6 años) · C/ Mayor 12, 2º B · el agua nos llega al pecho y sigue subiendo · una herida en la pierna, sangrado controlado · el portal está bloqueado por coches · podemos subir a la azotea · batería del móvil 18 % · sin cobertura desde las 19:40';
  const data = new TextEncoder().encode(MSG);
  $('#rc-bytes').textContent = `${data.length} bytes, texto inventado`; $('#rc-msg').textContent = `«${MSG}»`;
  const cv = $('#rc-cv'), g = cv.getContext('2d');
  const SRC = { x: 80, y: 420 }, DST = { x: 920, y: 300 };
  // Cada camino: puntos intermedios (geometría del dibujo), color, nombre llano y qué es físicamente.
  const LANES = {
    PHONE_MESH: { pts: [{ x: 230, y: 470 }, { x: 390, y: 455 }, { x: 560, y: 430 }, { x: 720, y: 390 }], color: '#34d399', name: 'Vecinos (Bluetooth / Wi-Fi Direct)', what: 'De móvil en móvil hasta alguien que aún tiene red.' },
    SMS: { pts: [{ x: 300, y: 250 }], color: '#91d7e8', name: 'Antena móvil (SMS)', what: 'Un SMS pasa con señal débil o 2G cuando los datos ya no.', icon: 'tower' },
    SAT_D2C_SMS: { pts: [{ x: 470, y: 60 }], color: '#b79cff', name: 'Satélite directo al móvil', what: 'Solo si el operador lo ofrece; funciona por ventanas de paso.', icon: 'sat' },
    MESHTASTIC: { pts: [{ x: 420, y: 205 }, { x: 640, y: 215 }], color: '#fbbf24', name: 'Radio LoRa (repetidor en el monte)', what: 'Accesorio de radio de 868 MHz: kilómetros, pocos bytes.', icon: 'hill' },
    IRIDIUM_SBD: { pts: [{ x: 640, y: 40 }], color: '#f0abfc', name: 'Iridium (módem satelital)', what: 'Módem pequeño de la brigada; 340 bytes por mensaje.', icon: 'sat' },
    DRONE_MULE: { pts: [{ x: 300, y: 360 }, { x: 600, y: 330 }], color: '#ff7756', name: 'Dron mula', what: 'Recoge los mensajes por Wi-Fi y los suelta en el puesto de mando.', icon: 'drone' },
    RELAY_INTERNET: { pts: [{ x: 300, y: 320 }, { x: 560, y: 150 }], color: '#7dd3fc', name: 'Internet satelital de un vecino', what: 'La antena satelital de un vecino o de un servicio, vía Wi-Fi.', icon: 'dish' },
  };
  const PRESETS = {
    city: { on: ['PHONE_MESH', 'SMS', 'SAT_D2C_SMS', 'RELAY_INTERNET'], scene: 'Ciudad a las 5 h del apagón · la antena del barrio aguanta a medias' },
    forest: { on: ['PHONE_MESH', 'MESHTASTIC', 'IRIDIUM_SBD', 'DRONE_MULE'], scene: 'Brigada en un valle sin cobertura · compañeros con radio LoRa y un módem Iridium' },
    flood: { on: ['PHONE_MESH', 'SAT_D2C_SMS', 'DRONE_MULE', 'MESHTASTIC'], scene: 'Pueblo incomunicado por una riada · antena caída, el dron de emergencias pasa cada media hora' },
    narrow: { on: ['SMS', 'SAT_D2C_SMS', 'MESHTASTIC'], scene: 'Nadie cerca: solo caminos que admiten mensajes muy cortos (SMS 116 B, LoRa 200 B) · aquí se ve el troceo k de n' },
  };
  let preset = 'city', enabled = new Set(PRESETS.city.on), plan = null, particles = [], got = new Map(), done = null, simT = 0, attempt = 1, logLines = [];
  const box = $('#rc-bearers');
  for (const [id, L] of Object.entries(LANES)) {
    const lab = document.createElement('label'); lab.className = 'chk';
    lab.innerHTML = `<input type="checkbox" data-b="${id}"><span class="sw" style="background:${L.color}"></span><span><b>${L.name}</b><br><span class="m" style="font-size:13px">${L.what} · p = ${String(BEARERS[id].p).replace('.', ',')} <span class="tag sim" style="margin:0">PREVIO</span></span></span>`;
    box.append(lab);
  }
  const syncChecks = () => box.querySelectorAll('input').forEach((i) => (i.checked = enabled.has(i.dataset.b)));
  box.addEventListener('change', (e) => { const id = e.target.dataset.b; if (!id) return; e.target.checked ? enabled.add(id) : enabled.delete(id); replan(); });
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { preset = b.dataset.preset; enabled = new Set(PRESETS[preset].on); document.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b)); syncChecks(); replan(); }));
  function log(s) { logLines.push(s); $('#rc-log').textContent = logLines.slice(-12).join('\n'); $('#rc-log').scrollTop = 1e9; }
  function replan() {
    particles = []; got = new Map(); done = null; logLines = [];
    const avail = [...enabled].map((id) => ({ id }));
    plan = avail.length ? planMultiBearer(data.length, avail, { target: 0.99 }) : { feasible: false, reason: 'NO_BEARER' };
    const ok = plan.k != null;
    $('#rc-k').textContent = ok ? plan.k : '—'; $('#rc-n').textContent = ok ? plan.n : '—';
    $('#rc-p').textContent = ok ? pct(plan.pDelivery, 2) : '0 %';
    $('#rc-eta').textContent = ok && Number.isFinite(plan.etaS) ? (plan.etaS < 120 ? `${plan.etaS} s` : `${Math.round(plan.etaS / 60)} min`) : '—';
    const bars = $('#rc-bars'); bars.innerHTML = '';
    if (ok) {
      const per = {}; for (const m of plan.messages) { per[m.id] ??= { shards: 0, msgs: 0 }; per[m.id].shards += m.shards; per[m.id].msgs++; }
      for (const [id, v] of Object.entries(per)) bars.insertAdjacentHTML('beforeend', `<div class="bar"><label><span>${LANES[id].name}</span><span class="mono">${v.shards} fragm. en ${v.msgs} envío${v.msgs > 1 ? 's' : ''}</span></label><div class="track"><div class="fill" style="width:${(100 * v.shards) / plan.n}%;background:${LANES[id].color}"></div></div></div>`);
      const audit = auditIndependentPlan(plan, { GRID_DOWN: { ...DEFAULT_HAZARDS.GRID_DOWN, prob: 1 } });
      $('#rc-claim').textContent = pct(audit.claimed, 2); $('#rc-actual').textContent = pct(audit.actual, 2);
    } else { $('#rc-claim').textContent = '—'; $('#rc-actual').textContent = '—'; }
    $('#rc-state').textContent = !ok ? 'Sin ningún camino: el mensaje se queda guardado en el móvil hasta que aparezca uno.' : plan.feasible ? PRESETS[preset].scene : `${PRESETS[preset].scene} · con estos caminos el máximo es ${pct(plan.pDelivery, 2)}: no llega al objetivo del 99 %; añade otro camino.`;
    $('#rc-log').textContent = ok ? `Plan: partir ${data.length} B en ${plan.n} fragmentos; bastan ${plan.k}. Pulsa «Enviar el SOS».` : 'Sin caminos activos: SENDA guarda el mensaje (store-and-forward).';
  }
  const pathOf = (id) => [SRC, ...LANES[id].pts, DST];
  function pointAt(pts, u) {
    const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); tot += d; }
    let r = u * tot; for (let i = 0; i < seg.length; i++) { if (r <= seg[i]) { const f = r / seg[i]; return { x: pts[i].x + f * (pts[i + 1].x - pts[i].x), y: pts[i].y + f * (pts[i + 1].y - pts[i].y) }; } r -= seg[i]; }
    return pts[pts.length - 1];
  }
  let encoded = null;
  function send() {
    if (!plan || plan.k == null) return;
    particles = []; got = new Map(); done = null; simT = 0; logLines = [];
    encoded = encodeShards(data, plan.k, plan.n);
    const R = rng(20261120 + attempt++);
    let idx = 0;
    log(`Mensaje partido con Reed-Solomon: ${plan.n} fragmentos de ${encoded.shardSize} B; con ${plan.k} cualesquiera se reconstruye.`);
    plan.messages.forEach((m, j) => {
      const success = R() < m.p, dur = 1.6 + 1.1 * Math.log10(1 + m.latencyS), start = 0.15 * j + R() * 0.4, failAt = 0.25 + R() * 0.55;
      for (let s = 0; s < m.shards; s++) particles.push({ id: m.id, idx: idx++, start: start + s * 0.12, dur, success, failAt, latencyS: m.latencyS });
      log(`${LANES[m.id].name}: envío ${j + 1} con ${m.shards} fragm. → ${success ? 'llegará' : 'se perderá'} (sorteo con p = ${String(m.p).replace('.', ',')})`);
    });
  }
  function draw(dt, t) {
    g.fillStyle = '#071018'; g.fillRect(0, 0, cv.width, cv.height);
    // Paisaje: valle, monte, agua o humo según escenario.
    g.fillStyle = '#0c1b24'; g.beginPath(); g.moveTo(0, 520); g.quadraticCurveTo(250, 300, 470, 470); g.quadraticCurveTo(640, 250, 1000, 420); g.lineTo(1000, 560); g.lineTo(0, 560); g.fill();
    if (preset === 'flood') { g.fillStyle = 'rgba(56,130,190,.35)'; g.fillRect(0, 470 + 4 * Math.sin(t), 520, 90); }
    if (preset === 'forest') for (let i = 0; i < 6; i++) { const x = 40 + i * 28, fl = 10 + 6 * Math.sin(t * 6 + i); g.fillStyle = 'rgba(255,119,86,.8)'; g.beginPath(); g.moveTo(x, 520); g.lineTo(x + 8, 520 - fl - 12); g.lineTo(x + 16, 520); g.fill(); }
    // Caminos
    for (const [id, L] of Object.entries(LANES)) {
      const on = enabled.has(id), pts = pathOf(id);
      g.setLineDash(on ? [] : [4, 6]); g.strokeStyle = on ? L.color : '#2a3a46'; g.globalAlpha = on ? 0.55 : 0.6; g.lineWidth = on ? 2.5 : 1.5;
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      for (const p of L.pts) drawIcon(L.icon ?? 'phone', p.x, p.y, on ? L.color : '#3b4b57', t);
      if (!on) { const p = L.pts[0]; g.strokeStyle = '#ff5b6e'; g.lineWidth = 3; g.beginPath(); g.moveTo(p.x - 9, p.y - 9); g.lineTo(p.x + 9, p.y + 9); g.moveTo(p.x + 9, p.y - 9); g.lineTo(p.x - 9, p.y + 9); g.stroke(); }
      const lp = L.pts[Math.floor((L.pts.length - 1) / 2)];
      g.fillStyle = on ? '#cfd8dc' : '#4b5b66'; g.font = '12px system-ui'; g.fillText(L.name, lp.x - 50, lp.y - 16);
    }
    drawIcon('person', SRC.x, SRC.y, '#ff7756', t); g.fillStyle = '#f2f4f4'; g.font = '600 13px system-ui'; g.fillText('Emisor (persona en apuros)', SRC.x - 60, SRC.y + 34);
    drawIcon('hq', DST.x, DST.y, '#34d399', t); g.fillText('Centro de coordinación / 112', DST.x - 150, DST.y + 40);
    // Partículas
    if (particles.length) simT += dt;
    for (const q of particles) {
      const u = (simT - q.start) / q.dur; if (u < 0) continue;
      const L = LANES[q.id];
      if (!q.success && u >= q.failAt) { const p = pointAt(pathOf(q.id), q.failAt), a = Math.max(0, 1 - (u - q.failAt) * 2); g.globalAlpha = a; g.strokeStyle = '#ff5b6e'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 6 + (1 - a) * 10, 0, 7); g.stroke(); g.globalAlpha = 1; continue; }
      if (u >= 1) { if (q.success && !got.has(q.idx)) { got.set(q.idx, q); onArrive(q); } continue; }
      const p = pointAt(pathOf(q.id), u); g.fillStyle = L.color; g.shadowColor = L.color; g.shadowBlur = 10; g.beginPath(); g.arc(p.x, p.y, 4.5, 0, 7); g.fill(); g.shadowBlur = 0;
    }
    // Contador en destino
    if (plan?.k) {
      const n = got.size, k = plan.k, w = 180;
      g.fillStyle = '#0b141c'; g.strokeStyle = '#203240'; g.fillRect(DST.x - w + 40, DST.y - 120, w, 62); g.strokeRect(DST.x - w + 40, DST.y - 120, w, 62);
      g.fillStyle = '#9fb2bc'; g.font = '12px system-ui'; g.fillText('fragmentos recibidos', DST.x - w + 50, DST.y - 102);
      g.fillStyle = done ? '#34d399' : '#f2f4f4'; g.font = '700 20px ui-monospace,monospace'; g.fillText(`${n} / ${k} necesarios`, DST.x - w + 50, DST.y - 76);
      for (let i = 0; i < k; i++) { g.fillStyle = i < n ? '#34d399' : '#203240'; g.fillRect(DST.x - w + 50 + i * Math.min(16, 160 / k), DST.y - 68, Math.min(14, 160 / k - 2), 6); }
    }
    if (done) { g.fillStyle = 'rgba(52,211,153,.12)'; g.fillRect(560, 470, 420, 70); g.strokeStyle = '#34d399'; g.strokeRect(560, 470, 420, 70); g.fillStyle = '#34d399'; g.font = '700 14px system-ui'; g.fillText(done.ok ? '✓ Mensaje reconstruido y verificado' : '✗ Faltan fragmentos: el mensaje sigue en cola', 574, 494); g.fillStyle = '#cfd8dc'; g.font = '12.5px system-ui'; g.fillText(done.text.length > 64 ? done.text.slice(0, 62) + '…»' : done.text, 574, 520); }
    const still = particles.some((q) => (simT - q.start) / q.dur < (q.success ? 1 : q.failAt + 0.5));
    if (particles.length && !still && !done) { done = { ok: false, text: `Recibidos ${got.size} de ${plan.k}. SENDA reintenta en la siguiente ventana.` }; log(done.text); }
  }
  function onArrive(q) {
    if (done || got.size < plan.k) return;
    const rec = [...got.values()].map((p) => ({ index: p.idx, data: encoded.shards[p.idx] }));
    const text = new TextDecoder().decode(decodeShards(rec, { k: plan.k, len: encoded.len }));
    const tReal = Math.max(...[...got.values()].map((p) => p.latencyS));
    done = { ok: text === MSG, text: `«${text}»` };
    log(`✓ ${plan.k} fragmentos bastan: reconstruido con decodeShards → idéntico al original: ${text === MSG ? 'sí' : 'NO'}. Tiempo real equivalente ≈ ${tReal < 120 ? tReal + ' s' : Math.round(tReal / 60) + ' min'} (latencias declaradas de cada camino).`);
  }
  function drawIcon(kind, x, y, c, t) {
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 2;
    if (kind === 'tower') { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x - 10, y + 14); g.moveTo(x, y - 18); g.lineTo(x + 10, y + 14); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.stroke(); }
    else if (kind === 'sat') { g.fillRect(x - 5, y - 5, 10, 10); g.fillRect(x - 22, y - 3, 13, 6); g.fillRect(x + 9, y - 3, 13, 6); }
    else if (kind === 'hill') { g.globalAlpha = .35; g.beginPath(); g.moveTo(x - 40, y + 30); g.lineTo(x, y - 4); g.lineTo(x + 40, y + 30); g.fill(); g.globalAlpha = 1; g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y - 20); g.stroke(); g.beginPath(); g.arc(x, y - 20, 3, 0, 7); g.fill(); }
    else if (kind === 'drone') { const b = Math.sin(t * 3) * 4; g.beginPath(); g.moveTo(x - 12, y + b); g.lineTo(x + 12, y + b); g.stroke(); g.beginPath(); g.arc(x - 12, y - 3 + b, 5, 0, 7); g.arc(x + 12, y - 3 + b, 5, 0, 7); g.stroke(); }
    else if (kind === 'dish') { g.beginPath(); g.arc(x, y, 10, Math.PI * 0.9, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 14); g.stroke(); }
    else if (kind === 'person') { g.beginPath(); g.arc(x, y - 14, 6, 0, 7); g.fill(); g.fillRect(x - 4, y - 7, 8, 16); g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 4); g.beginPath(); g.arc(x, y - 4, 18, 0, 7); g.stroke(); g.globalAlpha = 1; }
    else if (kind === 'hq') { g.fillRect(x - 16, y - 12, 32, 24); g.fillStyle = '#071018'; g.fillRect(x - 10, y - 6, 8, 6); g.fillRect(x + 2, y - 6, 8, 6); }
    else { g.fillRect(x - 5, y - 9, 10, 18); }
  }
  $('#rc-go').addEventListener('click', send);
  $('#rc-mc').addEventListener('click', () => {
    if (!plan?.k) return; const R = rng(7 + attempt++), N = 2000; let ok = 0;
    for (let i = 0; i < N; i++) { let s = 0; for (const m of plan.messages) if (R() < m.p) s += m.shards; if (s >= plan.k) ok++; }
    log(`2 000 sorteos independientes del mismo plan: llegó en ${fmt(ok)} (${pct(ok / N)}). La fórmula exacta dice ${pct(plan.pDelivery)}: coinciden dentro del ruido del sorteo.`);
  });
  syncChecks(); replan(); loop(cv, draw);
}

/* ======================= ESCENA 3 · cámara y señal ======================= */
{
  const cv = $('#ar-cv'), g = cv.getContext('2d'), mp = $('#ar-map'), gm = mp.getContext('2d');
  const VICTIM = { x: 3.2, y: 9.5, z: -1.6 };
  const MODEL = { txPower1m: -59, n: 3.2 };
  // Recorrido del rescatador: rodea el montón de escombros (buena geometría para triangular) y sube y baja (varía z).
  const PILE = { x: 3, y: 8 };
  const PATH = Array.from({ length: 14 }, (_, i) => { const a = -2.6 + i * 0.42; return { x: PILE.x + 5.5 * Math.cos(a), y: PILE.y + 5.5 * Math.sin(a), z: 0.5 + 1.2 * Math.abs(Math.sin(i * 0.7)) }; });
  let reads = [], est = null, walking = false, step = 0, R = rng(42);
  function measure(p) { const d = Math.hypot(VICTIM.x - p.x, VICTIM.y - p.y, VICTIM.z - p.z); return MODEL.txPower1m - 10 * MODEL.n * Math.log10(d) + 3 * gauss(R); }
  function reset() { reads = []; est = null; step = 0; walking = false; R = rng(42); $('#ar-go').textContent = '▶ Caminar y medir'; upd(); }
  function upd() {
    $('#ar-reads').textContent = reads.length;
    $('#ar-err').textContent = est ? `± ${est.errorM.toFixed(1).replace('.', ',')} m` : '—';
    $('#ar-real').textContent = est ? `${Math.hypot(est.x - VICTIM.x, est.y - VICTIM.y, est.z - VICTIM.z).toFixed(1).replace('.', ',')} m` : '—';
  }
  function cam() { const p = PATH[Math.min(Math.floor(step), PATH.length - 1)], aim = est ?? { ...PILE, z: -1 }, z = p.z + 0.4; return { pos: { x: p.x, y: p.y, z }, yaw: Math.atan2(aim.y - p.y, aim.x - p.x), pitch: -Math.atan2(z - aim.z, Math.hypot(aim.x - p.x, aim.y - p.y)) * 0.8, hfovRad: 1.15, width: cv.width, height: cv.height }; }
  function draw(dt, t) {
    if (walking) { step += dt * 1.4; const i = Math.floor(step); if (i < PATH.length && reads.length <= i) { const p = PATH[i]; reads.push({ ...p, rssi: measure(p) }); if (reads.length >= 4) est = locateBeacon(reads, MODEL) ?? est; upd(); } if (step >= PATH.length) { walking = false; $('#ar-go').textContent = '▶ Caminar y medir'; } }
    const W = cv.width, H = cv.height, c = cam();
    // «Imagen de cámara» dibujada: cielo con humo, escombros, forjados caídos.
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2a2f33'); sky.addColorStop(0.45, '#4a4440'); sky.addColorStop(1, '#2b2622'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(200,190,180,.07)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc((i * 230 + t * 12) % (W + 200) - 100, 90 + 30 * i % 70, 90, 0, 7); g.fill(); }
    g.fillStyle = '#3d3833'; g.beginPath(); g.moveTo(0, H * 0.62); for (let x = 0; x <= W; x += 40) g.lineTo(x, H * 0.55 + 30 * Math.sin(x * 0.013) + 18 * Math.sin(x * 0.051)); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#5a534c'; [[120, 250, 260, 34, -0.12], [420, 300, 300, 30, 0.18], [650, 240, 200, 26, -0.25], [260, 390, 360, 40, 0.06]].forEach(([x, y, w, h, r]) => { g.save(); g.translate(x, y); g.rotate(r); g.fillRect(0, 0, w, h); g.fillStyle = '#6b645c'; for (let k = 10; k < w; k += 24) g.fillRect(k, 4, 2, h - 8); g.restore(); g.fillStyle = '#5a534c'; });
    g.fillStyle = '#26221f'; for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = H * 0.6 + ((i * 53) % (H * 0.4)); g.fillRect(x, y, 6 + (i % 5) * 3, 4 + (i % 3) * 3); }
    // HUD de cámara
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; [[20, 20, 1, 1], [W - 20, 20, -1, 1], [20, H - 20, 1, -1], [W - 20, H - 20, -1, -1]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + 30 * b); g.lineTo(x, y); g.lineTo(x + 30 * a, y); g.stroke(); });
    g.fillStyle = '#f2f4f4'; g.font = '600 13px ui-monospace,monospace'; g.fillText('CÁMARA · SENDA búsqueda de baliza BLE', 34, 44);
    g.fillStyle = '#ffb4a2'; g.fillText('La cámara NO ve a través del escombro: el marcador es la señal de radio medida', 34, 64);
    if (reads.length) { const r = reads[reads.length - 1]; g.fillStyle = '#91d7e8'; g.fillText(`Última lectura: ${r.rssi.toFixed(0)} dBm`, 34, H - 34); const bars = Math.max(0, Math.min(5, Math.round((r.rssi + 100) / 7))); for (let i = 0; i < 5; i++) { g.fillStyle = i < bars ? '#91d7e8' : 'rgba(255,255,255,.2)'; g.fillRect(260 + i * 9, H - 34 - i * 4, 6, 6 + i * 4); } }
    const shown = [];
    if (est) shown.push({ p: projectToCamera({ x: est.x, y: est.y, z: est.z, errorM: est.errorM }, c), col: '#ff7756', label: 'señal del teléfono (estimación)' });
    if ($('#ar-truth').checked) shown.push({ p: projectToCamera({ ...VICTIM, errorM: 0.3 }, c), col: '#34d399', label: 'posición real (simulación)' });
    let off = 0;
    for (const { p, col, label } of shown) {
      if (!p.visible) { g.fillStyle = col; g.fillText(`${label}: fuera de cuadro, gira el móvil`, 34, H - 60 - 20 * off++); continue; }
      const pulse = REDUCED ? 0 : 6 * Math.sin(t * 3);
      g.strokeStyle = col; g.globalAlpha = .9; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.arc(p.u, p.v, Math.min(260, Math.max(14, p.radiusPx)) + pulse, 0, 7); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.moveTo(p.u - 14, p.v); g.lineTo(p.u + 14, p.v); g.moveTo(p.u, p.v - 14); g.lineTo(p.u, p.v + 14); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = col; g.font = '700 13px system-ui'; g.fillText(`${label} · ${p.depthM.toFixed(1).replace('.', ',')} m`, p.u + 18, p.v - 10);
      if (col === '#ff7756') $('#ar-depth').textContent = `${p.depthM.toFixed(1).replace('.', ',')} m`;
    }
    // Mapa cenital
    const MW = mp.width, MH = mp.height, sx = (x) => 30 + ((x + 4) / 16) * (MW - 60), sy = (y) => MH - 20 - ((y - 1.5) / 13.5) * (MH - 40);
    gm.fillStyle = '#071018'; gm.fillRect(0, 0, MW, MH);
    gm.fillStyle = 'rgba(120,110,100,.25)'; gm.beginPath(); gm.ellipse(sx(PILE.x), sy(PILE.y), (4 / 16) * (MW - 60), (4 / 13.5) * (MH - 40), 0, 0, 7); gm.fill(); gm.fillStyle = '#9fb2bc'; gm.font = '11px system-ui'; gm.fillText('montón de escombros', sx(PILE.x) - 50, sy(PILE.y) + 4);
    gm.strokeStyle = '#3b4b57'; gm.setLineDash([4, 4]); gm.beginPath(); PATH.forEach((p, i) => (i ? gm.lineTo(sx(p.x), sy(p.y)) : gm.moveTo(sx(p.x), sy(p.y)))); gm.stroke(); gm.setLineDash([]);
    for (const r of reads) { gm.fillStyle = '#91d7e8'; gm.beginPath(); gm.arc(sx(r.x), sy(r.y), 4, 0, 7); gm.fill(); }
    const cp = PATH[Math.min(Math.floor(step), PATH.length - 1)]; gm.fillStyle = '#f2f4f4'; gm.beginPath(); gm.arc(sx(cp.x), sy(cp.y), 6, 0, 7); gm.fill(); gm.fillText('rescatador', sx(cp.x) + 8, sy(cp.y) + 14);
    if (est) { gm.strokeStyle = '#ff7756'; gm.lineWidth = 2; gm.beginPath(); gm.arc(sx(est.x), sy(est.y), (est.errorM / 16) * (MW - 60), 0, 7); gm.stroke(); gm.fillStyle = '#ff7756'; gm.beginPath(); gm.arc(sx(est.x), sy(est.y), 4, 0, 7); gm.fill(); }
    if ($('#ar-truth').checked) { gm.fillStyle = '#34d399'; gm.beginPath(); gm.arc(sx(VICTIM.x), sy(VICTIM.y), 4, 0, 7); gm.fill(); }
    gm.fillStyle = '#9fb2bc'; gm.fillText('vista desde arriba · azul = lecturas · naranja = estimación ± incertidumbre', 10, 14);
  }
  $('#ar-go').addEventListener('click', () => { if (step >= PATH.length) reset(); walking = !walking; $('#ar-go').textContent = walking ? '❚❚ Pausa' : '▶ Seguir'; });
  $('#ar-reset').addEventListener('click', reset);
  loop(cv, draw); upd();

  // Tabla de capacidades: texto del propio módulo.
  const ST = { IMPLEMENTED_ALGORITHM: ['Algoritmo implementado', 'calc'], IMPLEMENTED_ALGORITHM_NEEDS_FIELD_CALIBRATION: ['Implementado · falta calibrar en campo', 'sim'], NOT_PHYSICALLY_POSSIBLE: ['No es físicamente posible', 'no'] };
  $('#cap-t tbody').innerHTML = CAPABILITIES.map((c) => `<tr><td>${c.what}</td><td>${c.hardware}</td><td><span class="tag ${(ST[c.status] ?? [c.status, 'sim'])[1]}" style="margin:0">${(ST[c.status] ?? [c.status])[0]}</span></td></tr>`).join('');

  // CSI sintético con y sin persona.
  const withP = synthesizeCsi({ rpm: 14, person: true, seed: 3 }), empty = synthesizeCsi({ rpm: 14, person: false, seed: 3 });
  const aP = analyzeCsi(withP), aE = analyzeCsi(empty);
  const cc = $('#csi-cv'), gx = cc.getContext('2d'), Wc = cc.width, Hc = cc.height;
  const series = (fr) => fr.map((row) => row[0]);
  function plotCsi() {
    gx.fillStyle = '#071018'; gx.fillRect(0, 0, Wc, Hc);
    [[series(withP), '#34d399', 60, 'con persona respirando'], [series(empty), '#9fb2bc', 160, 'sala vacía']].forEach(([s, col, mid, lab]) => {
      const mean = s.reduce((a, v) => a + v, 0) / s.length; gx.strokeStyle = col; gx.lineWidth = 1.5; gx.beginPath();
      s.forEach((v, i) => { const x = 10 + (i / (s.length - 1)) * (Wc - 20), y = mid - (v - mean) * 60; i ? gx.lineTo(x, y) : gx.moveTo(x, y); }); gx.stroke();
      gx.fillStyle = col; gx.font = '12px system-ui'; gx.fillText(lab, 12, mid - 32);
    });
    gx.fillStyle = '#9fb2bc'; gx.fillText('amplitud de una subportadora Wi-Fi · 40 s · señal SINTÉTICA', 12, Hc - 8);
  }
  plotCsi();
  $('#csi-out').innerHTML = `Resultado de <span class="mono">analyzeCsi</span>: con persona → respiración ${aP.breathing?.detected ? `<b>detectada, ${String(aP.breathing.rpm).replace('.', ',')} rpm</b>` : 'no detectada'}; sala vacía → ${aE.breathing?.detected ? `detectada (${aE.breathing.rpm} rpm)` : '<b>no detectada</b>'}. Es un indicio para orientar la búsqueda, nunca descarta a nadie.`;
}

/* ======================= ESCENA 4 · drones ======================= */
{
  const cv = $('#rid-cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const C0 = { lat: 39.405, lon: -0.41 }; // zona de ejemplo (l'Horta Sud)
  const DR = [
    { id: 'Bomberos-1', r: 0.006, w: 0.12, ph: 0, alt: 90, col: '#ff7756' },
    { id: 'Policía-2', r: 0.009, w: -0.08, ph: 2, alt: 60, col: '#91d7e8' },
    { id: 'Voluntario-3', r: 0.004, w: 0.2, ph: 4, alt: 40, col: '#b79cff' },
  ];
  const decoded = {};
  const kmLat = 111.32, kmLon = 111.32 * Math.cos(C0.lat * Math.PI / 180), RANGE = 1.2; // km del radar
  const TIME_SCALE = 6; // la animación muestra el vuelo 6 veces más rápido
  let lastHex = '';
  function draw(dt, t) {
    g.fillStyle = '#071018'; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, Rpx = Math.min(W, H) / 2 - 30;
    g.strokeStyle = '#1b3a44'; g.lineWidth = 1; for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(cx, cy, (Rpx * i) / 4, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx - Rpx, cy); g.lineTo(cx + Rpx, cy); g.moveTo(cx, cy - Rpx); g.lineTo(cx, cy + Rpx); g.stroke();
    g.fillStyle = '#4b6b78'; g.font = '11px system-ui'; for (let i = 1; i <= 4; i++) g.fillText(`${((RANGE * i) / 4 * 1000).toFixed(0)} m`, cx + 4, cy - (Rpx * i) / 4 + 12);
    if (!REDUCED) { const a = (t * 1.2) % (2 * Math.PI); const grd = g.createConicGradient ? g.createConicGradient(a - 0.6, cx, cy) : null; if (grd) { grd.addColorStop(0, 'rgba(52,211,153,0)'); grd.addColorStop(0.09, 'rgba(52,211,153,.25)'); grd.addColorStop(0.1, 'rgba(52,211,153,0)'); g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, Rpx, 0, 7); g.fill(); } }
    drawPhone(cx, cy);
    for (const d of DR) {
      const ang = d.ph + d.w * t, lat = C0.lat + d.r * Math.sin(ang), lon = C0.lon + d.r * 1.3 * Math.cos(ang);
      // Rumbo desde el norte a partir de la derivada de la trayectoria; la animación va ×6 más rápida que el vuelo.
      const vN = d.r * d.w * Math.cos(ang) * kmLat, vE = -1.3 * d.r * d.w * Math.sin(ang) * kmLon;
      const dir = ((Math.atan2(vE, vN) * 180) / Math.PI + 360) % 360;
      const speed = (Math.hypot(vN, vE) * 1000) / TIME_SCALE;
      // Codificar → 25 bytes → decodificar: lo que se dibuja es lo DECODIFICADO.
      const bytes = encodeLocation({ lat, lon, altGeoM: d.alt + 10 * Math.sin(t + d.ph), heightM: d.alt, directionDeg: Math.round(dir), speedMs: +speed.toFixed(2) });
      const m = decodeOdid(bytes); decoded[d.id] = m; if (d.id === 'Bomberos-1') lastHex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      const x = cx + ((m.lon - C0.lon) * kmLon / RANGE) * Rpx, y = cy - ((m.lat - C0.lat) * kmLat / RANGE) * Rpx;
      g.fillStyle = d.col; g.strokeStyle = d.col; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x, y); const rad = (m.directionDeg * Math.PI) / 180; g.lineTo(x + 22 * Math.sin(rad), y - 22 * Math.cos(rad)); g.stroke();
      g.font = '600 12px system-ui'; g.fillText(`${d.id} · ${Math.round(m.altGeoM)} m`, x + 10, y - 10);
    }
    g.fillStyle = '#9fb2bc'; g.font = '12px system-ui'; g.fillText('Radar del móvil · Remote ID · vuelos INVENTADOS (animación ×6), codificación ODID real', 12, H - 10);
  }
  function drawPhone(x, y) { g.fillStyle = '#f2f4f4'; g.fillRect(x - 6, y - 10, 12, 20); g.fillStyle = '#071018'; g.fillRect(x - 4, y - 7, 8, 13); g.fillStyle = '#cfd8dc'; g.font = '11px system-ui'; g.fillText('tu móvil', x + 10, y + 18); }
  loop(cv, draw);
  setInterval(() => {
    $('#rid-hex').textContent = lastHex ? `Mensaje ODID «Location» de Bomberos-1 (25 B): ${lastHex}` : '—';
    $('#rid-t tbody').innerHTML = DR.map((d) => { const m = decoded[d.id]; return m ? `<tr><td>${d.id}</td><td class="mono">${Math.round(m.altGeoM)} m</td><td class="mono">${String(m.speedMs).replace('.', ',')} m/s</td><td class="mono">${m.directionDeg}°</td></tr>` : ''; }).join('');
  }, 500);

  const mule = muleSortie({ from: { lat: 39.40, lon: -0.43 }, to: { lat: 39.45, lon: -0.38 } });
  $('#mule-kv').innerHTML = `<div><b>${(mule.distanceM / 1000).toFixed(1).replace('.', ',')} km</b><span>pueblo ↔ puesto de mando</span></div><div><b>${String(mule.roundTripMin).replace('.', ',')} min</b><span>ida, intercambio y vuelta</span></div><div><b>${String(mule.deliveryAfterMin).replace('.', ',')} min</b><span>hasta que el puesto recibe</span></div><div><b style="color:${mule.feasible ? 'var(--e)' : 'var(--r)'}">${mule.feasible ? 'Sí' : 'No'}</b><span>¿le llega la batería?</span></div>`;

  const sc = sweepScenario(), sp = planSweep(sc.houses, { base: sc.base }), board = sweepBoard(sc.houses);
  const rank = new Map(board.map((b, i) => [b.id, i]));
  const sw = $('#sw-cv'), gs = sw.getContext('2d');
  const xs = sc.houses.map((h) => h.x), ys = sc.houses.map((h) => h.y), mx = Math.max(...xs) + 30, my = Math.max(...ys) + 30;
  const SX = (x) => 20 + (x / mx) * (sw.width - 40), SY = (y) => 20 + (y / my) * (sw.height - 40);
  const byId = new Map(sc.houses.map((h) => [h.id, h]));
  const routePts = []; for (const s of sp.sorties) { routePts.push(sc.base); for (const id of s.houses) routePts.push(byId.get(id)); routePts.push(sc.base); }
  let segLen = []; let tot = 0; for (let i = 1; i < routePts.length; i++) { const d = Math.hypot(routePts[i].x - routePts[i - 1].x, routePts[i].y - routePts[i - 1].y); segLen.push(d); tot += d; }
  loop(sw, (dt, t) => {
    gs.fillStyle = '#071018'; gs.fillRect(0, 0, sw.width, sw.height);
    gs.strokeStyle = 'rgba(145,215,232,.35)'; gs.lineWidth = 1.5; gs.beginPath(); routePts.forEach((p, i) => (i ? gs.lineTo(SX(p.x), SY(p.y)) : gs.moveTo(SX(p.x), SY(p.y)))); gs.stroke();
    for (const h of sc.houses) { const r = rank.get(h.id), col = r < 5 ? '#ff5b6e' : r < 12 ? '#fbbf24' : '#34d399'; gs.fillStyle = col; gs.fillRect(SX(h.x) - 7, SY(h.y) - 7, 14, 14); gs.fillStyle = '#071018'; gs.font = '700 9px system-ui'; gs.fillText(h.id, SX(h.x) - 6, SY(h.y) + 3); }
    gs.fillStyle = '#f2f4f4'; gs.beginPath(); gs.arc(SX(sc.base.x), SY(sc.base.y), 6, 0, 7); gs.fill(); gs.font = '11px system-ui'; gs.fillText('base', SX(sc.base.x) + 8, SY(sc.base.y) + 4);
    let r = ((t * 60) % tot); for (let i = 0; i < segLen.length; i++) { if (r <= segLen[i]) { const a = routePts[i], b = routePts[i + 1], f = r / segLen[i]; gs.fillStyle = '#ff7756'; gs.beginPath(); gs.arc(SX(a.x + f * (b.x - a.x)), SY(a.y + f * (b.y - a.y)), 5, 0, 7); gs.fill(); break; } r -= segLen[i]; }
    gs.fillStyle = '#9fb2bc'; gs.fillText('rojo = prioridad alta · ámbar = media · verde = baja', 10, sw.height - 6);
  });
  const top = board.slice(0, 3).map((b) => `${b.id} (${b.people.mid} personas probables, daño EMS-98 grado ${b.damage})`).join(', ');
  $('#sw-out').innerHTML = `<span class="mono">planSweep</span>: ${sc.houses.length} edificios en <b>${sp.sorties.length} salidas</b> (cambio de batería en la base), <b>${Math.round(sp.totalS / 60)} min</b> en total. <span class="mono">sweepBoard</span> ordena por personas probables × daño: primero ${top}. El daño lo asigna una persona experta; el barrio es inventado.`;
}
