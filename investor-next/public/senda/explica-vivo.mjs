// Piezas vivas de /senda/explica: portada con red, comparador Sentinel-2, muro de cámaras DGT,
// notas de comunidad (hazard-reports.mjs), cielo en realidad aumentada (orbital.mjs + TLE AMSAT reales),
// mando con firmas ECDSA reales, alerta que se responde y aviso de riada (flood-watch.mjs).
import { clusterReports, assessIncident, HAZARD_KINDS } from '/senda/core/hazard-reports.mjs';
import { parseTleFile, lookAngles } from '/senda/core/orbital.mjs';
import { floodScenario } from '/senda/core/flood-watch.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (x, d = 0) => Number(x).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
function onScreen(el, cb) { let raf = 0, on = false, last = performance.now(); const tick = (t) => { const dt = Math.min(0.05, (t - last) / 1000); last = t; cb(dt, t / 1000); if (on) raf = requestAnimationFrame(tick); }; new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); }).observe(el); }

/* ---------- aparición al hacer scroll y contadores ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('in'); io.unobserve(e.target);
  const c = e.target.dataset.count; if (c != null) { const to = +c, d = +(e.target.dataset.dec ?? 0), t0 = performance.now(), dur = REDUCED ? 1 : 1400;
    const step = (t) => { const u = Math.min(1, (t - t0) / dur), v = to * (1 - (1 - u) ** 3); e.target.textContent = nf(v, d) + (e.target.dataset.suffix ?? ''); if (u < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); } }), { threshold: 0.25 });
$$('.rv, [data-count]').forEach((el) => io.observe(el));

/* ---------- portada: red de móviles que se reconecta sobre la foto ---------- */
{
  const cv = $('#hero-net'), g = cv.getContext('2d');
  let W = 0, H = 0; const fit = () => { W = cv.width = cv.clientWidth * Math.min(2, devicePixelRatio); H = cv.height = cv.clientHeight * Math.min(2, devicePixelRatio); }; fit(); addEventListener('resize', fit);
  let s = 11; const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const N = 46, P = Array.from({ length: N }, () => ({ x: R(), y: 0.35 + R() * 0.6, vx: (R() - 0.5) * 0.01, vy: (R() - 0.5) * 0.006, dead: R() < 0.3 }));
  const pulses = [];
  onScreen(cv, (dt, t) => {
    g.clearRect(0, 0, W, H); const k = Math.min(2, devicePixelRatio);
    for (const p of P) { if (!REDUCED) { p.x += p.vx * dt; p.y += p.vy * dt; } if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0.3 || p.y > 1) p.vy *= -1; }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = P[i], b = P[j], d = Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) / k; if (d < 150) { g.strokeStyle = `rgba(52,211,153,${0.5 * (1 - d / 150)})`; g.lineWidth = k; g.beginPath(); g.moveTo(a.x * W, a.y * H); g.lineTo(b.x * W, b.y * H); g.stroke(); if (!REDUCED && R() < 0.002) pulses.push({ a, b, u: 0 }); } }
    for (const q of pulses) { q.u += dt * 1.4; const x = q.a.x + (q.b.x - q.a.x) * q.u, y = q.a.y + (q.b.y - q.a.y) * q.u; g.fillStyle = '#ffd7a8'; g.beginPath(); g.arc(x * W, y * H, 2.6 * k, 0, 7); g.fill(); }
    for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].u >= 1) pulses.splice(i, 1);
    for (const p of P) { g.fillStyle = p.dead ? 'rgba(255,91,110,.9)' : '#34d399'; g.beginPath(); g.arc(p.x * W, p.y * H, (p.dead ? 2.2 : 3) * k, 0, 7); g.fill(); }
  });
}

/* ---------- comparador Sentinel-2 antes / después ---------- */
{
  const box = $('#s2-cmp'), after = $('#s2-after'), bar = $('#s2-bar');
  const set = (x) => { const r = box.getBoundingClientRect(), u = Math.max(0, Math.min(1, (x - r.left) / r.width)); after.style.clipPath = `inset(0 0 0 ${u * 100}%)`; bar.style.left = `${u * 100}%`; };
  let drag = false; box.addEventListener('pointerdown', (e) => { drag = true; box.setPointerCapture(e.pointerId); set(e.clientX); });
  box.addEventListener('pointermove', (e) => drag && set(e.clientX)); box.addEventListener('pointerup', () => (drag = false));
  box.addEventListener('keydown', (e) => { const r = box.getBoundingClientRect(), cur = parseFloat(bar.style.left || '50') / 100; if (e.key === 'ArrowLeft') set(r.left + (cur - 0.05) * r.width); if (e.key === 'ArrowRight') set(r.left + (cur + 0.05) * r.width); });
  $$('[data-s2]').forEach((b) => b.addEventListener('click', () => { after.src = b.dataset.s2; $('#s2-after-lab').textContent = b.dataset.lab; $$('[data-s2]').forEach((x) => x.classList.toggle('on', x === b)); }));
  if (!REDUCED) { let u = 0.15; const t0 = performance.now(); const intro = (t) => { u = 0.15 + 0.7 * Math.min(1, (t - t0) / 2200); const r = box.getBoundingClientRect(); set(r.left + u * r.width); if (u < 0.85) requestAnimationFrame(intro); };
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); requestAnimationFrame(intro); } }, { threshold: 0.5 }).observe(box); }
}

/* ---------- muro de cámaras públicas DGT (fotos fechadas) ---------- */
{
  const ids = ['1083', '1089', '1125', '1216', '122', '1259', '146', '1474', '154', '158', '1607', '1610', '1635', '169', '174', '180', '183', '191', '790', '825', '934', '943', '967', '990'];
  const wall = $('#cam-wall'), tiles = Array.from({ length: 8 }, (_, i) => { const d = document.createElement('figure'); d.className = 'cam'; d.innerHTML = `<img alt="Cámara pública de tráfico de la DGT" loading="lazy" src="/senda/data/perimetro/cam_${ids[i]}.jpg"><figcaption>DGT · cámara ${ids[i]}</figcaption>`; wall.append(d); return d; });
  let k = 8; if (!REDUCED) setInterval(() => { if (document.hidden) return; const t = tiles[Math.floor(Math.random() * tiles.length)], img = t.querySelector('img'), id = ids[k++ % ids.length]; img.style.opacity = 0; setTimeout(() => { img.src = `/senda/data/perimetro/cam_${id}.jpg`; t.querySelector('figcaption').textContent = `DGT · cámara ${id}`; img.onload = () => (img.style.opacity = 1); }, 400); }, 1800);
}

/* ---------- notas de comunidad: el motor de credibilidad real ---------- */
{
  const base = { lat: 39.4155, lon: -0.4189 }, t0 = Date.UTC(2026, 10, 20, 18, 40);
  let reports = [{ kind: 'CAR_SWEPT', lat: base.lat, lon: base.lon, at: t0, deviceId: 'dev-autora', people: { trapped: 1 } }], n = 0;
  const render = () => {
    const inc = clusterReports(reports)[0], a = assessIncident(inc);
    const st = { RUMOR: ['Sin confirmar', '#fbbf24'], CORROBORATED: ['Corroborado por varias personas', '#91d7e8'], RECON: ['Prioridad de reconocimiento', '#ff7756'] }[a.state];
    $('#cn-p').textContent = `${nf(100 * a.pReal)} %`; $('#cn-bar').style.width = `${100 * a.pReal}%`; $('#cn-bar').style.background = st[1];
    $('#cn-state').textContent = st[0]; $('#cn-state').style.color = st[1];
    $('#cn-why').innerHTML = a.why.map((w) => `<li>${w}</li>`).join('') + `<li>¿Puede emitir una alerta pública? <b>${a.canPublicWarn ? 'sí' : 'no'}</b>: solo una autoridad con credencial firmada.</li>`;
    $('#cn-count').textContent = `${a.reporters} testigo${a.reporters > 1 ? 's' : ''}`;
  };
  $('#cn-yes').addEventListener('click', () => { n++; reports.push({ kind: 'CAR_SWEPT', lat: base.lat + 0.0006 * Math.sin(n), lon: base.lon + 0.0006 * Math.cos(n), at: t0 + n * 90_000, deviceId: `dev-testigo-${n}` }); render(); $('#cn-feed').insertAdjacentHTML('afterbegin', `<li><b>Testigo ${n}</b> confirma desde ${nf(40 + 25 * n)} m · clave distinta</li>`); });
  $('#cn-measure').addEventListener('click', () => { n++; reports.push({ kind: 'RIVER_RISING', lat: base.lat + 0.0004, lon: base.lon - 0.0003, at: t0 + n * 90_000, deviceId: `dev-medida-${n}`, measurement: { rise: { cmPerMin: 1.8, stdErr: 0.3 } } }); render(); $('#cn-feed').insertAdjacentHTML('afterbegin', `<li><b>Foto con regla</b>: el agua sube 1,8 cm/min (medida en la imagen)</li>`); });
  $('#cn-reset').addEventListener('click', () => { reports = reports.slice(0, 1); n = 0; $('#cn-feed').innerHTML = ''; render(); });
  render();
}

/* ---------- cielo en realidad aumentada: satélites reales calculados como una app de estrellas ---------- */
{
  const cv = $('#sky-cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  let obs = { lat: 40.4168, lon: -3.7038, altKm: 0.65, name: 'Madrid (por defecto)' }, sats = [], vis = [], heading = 180, pitch = 25, dragX = null, camOn = false, video = null, oriented = false;
  const FOVH = 80, FOVV = 46;
  fetch('/senda/data/tle/amsat-nasabare-2026-11-20.txt').then((r) => r.text()).then((t) => { sats = parseTleFile(t); compute(); setInterval(compute, 2000); });
  function compute() {
    const now = Date.now();
    vis = sats.map((el) => { try { const a = lookAngles(el, obs, now); return { name: el.name, az: a.azimuthDeg, el: a.elevationDeg, km: a.rangeKm }; } catch { return null; } }).filter((x) => x && x.el > 0).sort((a, b) => b.el - a.el);
    $('#sky-n').textContent = vis.length; $('#sky-where').textContent = obs.name;
    $('#sky-list').innerHTML = vis.slice(0, 6).map((v) => `<li><b>${v.name}</b> <span class="mono">${nf(v.el, 0)}° alto · ${nf(v.az, 0)}° · ${nf(v.km, 0)} km</span></li>`).join('') || '<li>Ninguno sobre el horizonte ahora mismo.</li>';
  }
  const stars = Array.from({ length: 420 }, (_, i) => ({ az: (i * 137.508) % 360, el: ((i * 61.8) % 90), m: (i * 7) % 5 }));
  const proj = (az, el) => { let d = ((az - heading + 540) % 360) - 180; return { x: W / 2 + (d / FOVH) * W, y: H / 2 - ((el - pitch) / FOVV) * H, on: Math.abs(d) < FOVH * 0.6 }; };
  onScreen(cv, (dt, t) => {
    if (!oriented && dragX == null && !REDUCED) heading = (heading + dt * 2) % 360;
    if (camOn && video?.readyState >= 2) g.drawImage(video, 0, 0, W, H); else { const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#02060d'); sky.addColorStop(1, '#0b1a2a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (const s of stars) { const p = proj(s.az, s.el); if (!p.on) continue; g.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * s.m + (REDUCED ? 0 : 0.1 * Math.sin(t * 2 + s.az))})`; g.fillRect(p.x, p.y, 1.2 + s.m * 0.3, 1.2 + s.m * 0.3); } }
    const hy = proj(heading, 0).y; g.fillStyle = 'rgba(4,10,14,.85)'; g.fillRect(0, hy, W, H - hy); g.strokeStyle = 'rgba(145,215,232,.5)'; g.beginPath(); g.moveTo(0, hy); g.lineTo(W, hy); g.stroke();
    g.fillStyle = '#9fb2bc'; g.font = '12px system-ui'; for (const [a, l] of [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SO'], [270, 'O'], [315, 'NO']]) { const p = proj(a, 0); if (p.on) g.fillText(l, p.x - 6, hy + 18); }
    for (const v of vis) { const p = proj(v.az, v.el); if (!p.on) continue; const iss = /ISS/.test(v.name), r = iss ? 9 : 5;
      g.strokeStyle = iss ? '#ff7756' : '#34d399'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, r + (REDUCED ? 0 : 2 * Math.sin(t * 3)), 0, 7); g.stroke(); g.beginPath(); g.moveTo(p.x + r, p.y - r); g.lineTo(p.x + 26, p.y - 22); g.stroke();
      g.fillStyle = '#f2f4f4'; g.font = `${iss ? 700 : 600} 12.5px system-ui`; g.fillText(v.name, p.x + 30, p.y - 26); g.fillStyle = '#9fb2bc'; g.font = '11px ui-monospace,monospace'; g.fillText(`${nf(v.el, 0)}° · ${nf(v.km, 0)} km`, p.x + 30, p.y - 12); }
    { // mini radar de todo el cielo: centro = cénit, borde = horizonte, arriba = norte; el cono es hacia donde miras
      const R0 = 92, cx = W - R0 - 18, cy = R0 + 18; g.fillStyle = 'rgba(5,9,12,.78)'; g.beginPath(); g.arc(cx, cy, R0 + 8, 0, 7); g.fill();
      g.strokeStyle = 'rgba(145,215,232,.35)'; g.lineWidth = 1; for (const k of [1, 2 / 3, 1 / 3]) { g.beginPath(); g.arc(cx, cy, R0 * k, 0, 7); g.stroke(); }
      const hr = (heading - 90) * Math.PI / 180, half = (FOVH / 2) * Math.PI / 180; g.fillStyle = 'rgba(255,119,86,.18)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R0, hr - half, hr + half); g.fill();
      g.fillStyle = '#9fb2bc'; g.font = '10px system-ui'; g.fillText('N', cx - 3, cy - R0 - 1);
      for (const v of vis) { const rr = R0 * (1 - v.el / 90), a = (v.az - 90) * Math.PI / 180, iss = /ISS/.test(v.name); g.fillStyle = iss ? '#ff7756' : '#34d399'; g.beginPath(); g.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), iss ? 4 : 3, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(5,9,12,.7)'; g.fillRect(12, 12, 300, 44); g.fillStyle = '#f2f4f4'; g.font = '600 13px ui-monospace,monospace'; g.fillText(`Mirando al ${nf(heading, 0)}° · ${nf(pitch, 0)}° sobre el horizonte`, 22, 32); g.fillStyle = '#91d7e8'; g.font = '11px system-ui'; g.fillText(camOn ? 'cámara + brújula del móvil' : 'arrastra para mirar alrededor', 22, 48);
  });
  cv.addEventListener('pointerdown', (e) => { dragX = { x: e.clientX, y: e.clientY, h: heading, p: pitch }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (!dragX) return; const r = cv.getBoundingClientRect(); heading = (dragX.h - ((e.clientX - dragX.x) / r.width) * FOVH + 360) % 360; pitch = Math.max(5, Math.min(80, dragX.p + ((e.clientY - dragX.y) / r.height) * FOVV)); });
  cv.addEventListener('pointerup', () => (dragX = null));
  $('#sky-loc').addEventListener('click', () => navigator.geolocation?.getCurrentPosition((p) => { obs = { lat: p.coords.latitude, lon: p.coords.longitude, altKm: (p.coords.altitude ?? 0) / 1000, name: `tu posición (±${nf(p.coords.accuracy)} m)` }; compute(); }, () => ($('#sky-where').textContent = 'permiso de ubicación denegado: sigue Madrid')));
  $('#sky-cam').addEventListener('click', async () => {
    try {
      if (typeof DeviceOrientationEvent?.requestPermission === 'function') await DeviceOrientationEvent.requestPermission();
      addEventListener('deviceorientation', (e) => { const hd = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null); if (hd != null) { heading = hd; oriented = true; } if (e.beta != null) pitch = Math.max(0, Math.min(85, e.beta - 90 + 90 * 0.5)); }, true);
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video = document.createElement('video'); video.playsInline = true; video.muted = true; video.srcObject = st; await video.play(); camOn = true; $('#sky-cam').textContent = 'Cámara activa';
    } catch (err) { $('#sky-cam').textContent = 'Cámara no disponible aquí: usa el móvil'; }
  });
}

/* ---------- mando: unidades en camino y canales firmados de verdad (WebCrypto ECDSA P-256) ---------- */
{
  const cv = $('#mando-cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height, PX_M = 6; // 1 px = 6 m
  const INC = { x: 560, y: 300 };
  const roads = [[[40, 300], [1000, 300]], [[560, 40], [560, 540]], [[120, 520], [380, 300]], [[760, 80], [900, 300]], [[200, 120], [560, 120]]];
  const U = [
    { id: 'B-12', unit: 'Bomberos', ch: 'BOMB', col: '#ff5b6e', kmh: 60, path: [[40, 300], [560, 300]], t0: 3 },
    { id: 'GC-T7', unit: 'Guardia Civil · Tráfico', ch: 'GC', col: '#34d399', kmh: 90, path: [[560, 540], [560, 300]], t0: 1 },
    { id: 'SVA-3', unit: 'Ambulancia SVA', ch: 'SAN', col: '#fbbf24', kmh: 70, path: [[900, 300], [760, 80], [560, 120], [560, 300]], t0: 4 },
    { id: 'V-voluntario', unit: 'Conductora voluntaria (opt-in)', ch: 'CIV', col: '#91d7e8', kmh: 30, path: [[476, 300], [560, 300]], t0: 0.5 },
  ].map((u) => ({ ...u, len: u.path.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - u.path[i][0], p[1] - u.path[i][1]), 0) }));
  const CH = { BOMB: 'Canal Bomberos', GC: 'Canal Guardia Civil', SAN: 'Canal Sanitario', CIV: 'Ciudadanía (zona)', JOINT: 'Canal conjunto · mando unificado' };
  const SCRIPT = [
    [0, 'JOINT', 'CENTRO', 'Incidente: turismo arrastrado en el paso inferior. 1 persona atrapada (aviso ciudadano + 2 testigos).'],
    [0.6, 'CIV', 'CENTRO', 'A la conductora voluntaria a 500 m: ¿puedes confirmar desde un lugar seguro? No te acerques al agua.'],
    [10, 'CIV', 'V-voluntario', 'Confirmo desde el puente: coche con agua por las ventanillas, una persona en el techo. Foto adjunta.'],
    [8, 'GC', 'GC-T7', 'Corto la vía en ambos sentidos en el PK de acceso. Desvío por la ronda norte.'],
    [12, 'BOMB', 'B-12', 'Salimos con equipo de rescate acuático. Pedimos cota del agua.'],
    [14, 'SAN', 'SVA-3', 'En camino. Preparamos hipotermia y posible ahogamiento.'],
    [16, 'JOINT', 'CENTRO', 'Mando unificado: Bomberos rescate, GC perímetro, SVA atención. Persona atrapada informada: «ayuda a 2 min».'],
  ];
  const keys = {}; const enc = new TextEncoder(); const feed = $('#mando-feed'); let T = 0, sent = 0, playing = false;
  const ready = (async () => { for (const id of ['CENTRO', ...U.map((u) => u.id)]) { const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']); const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)); const fp = new Uint8Array(await crypto.subtle.digest('SHA-256', raw)); keys[id] = { ...kp, fp: [...fp.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join('') }; } })();
  async function post([, ch, from, text]) {
    await ready; const msg = enc.encode(`${ch}|${from}|${text}`);
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys[from].privateKey, msg);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys[from].publicKey, sig, msg);
    const u = U.find((x) => x.id === from), col = u?.col ?? '#f2f4f4';
    feed.insertAdjacentHTML('afterbegin', `<li><span class="ch" style="color:${col}">${CH[ch]}</span><b>${from}</b> ${text}<small>${ok ? '✓ firma ECDSA verificada' : '✗ firma no válida'} · clave ${keys[from].fp}… · ${new Uint8Array(sig).length} B</small></li>`);
  }
  const at = (u, d) => { let r = d; for (let i = 1; i < u.path.length; i++) { const a = u.path[i - 1], b = u.path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (r <= L) return { x: a[0] + ((b[0] - a[0]) * r) / L, y: a[1] + ((b[1] - a[1]) * r) / L }; r -= L; } const e = u.path[u.path.length - 1]; return { x: e[0], y: e[1] }; };
  $('#mando-go').addEventListener('click', () => { T = 0; sent = 0; feed.innerHTML = ''; playing = true; });
  onScreen(cv, (dt, t) => {
    if (playing) { T += dt; while (sent < SCRIPT.length && SCRIPT[sent][0] <= T) post(SCRIPT[sent++]); if (T > 30) playing = false; }
    g.fillStyle = '#0a141b'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(56,130,190,.22)'; g.beginPath(); g.ellipse(INC.x, INC.y, 60, 34, 0, 0, 7); g.fill();
    for (const r of roads) { g.strokeStyle = '#22343f'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); r.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); }
    for (let x = 60; x < W; x += 90) for (let y = 160; y < H; y += 80) if (Math.hypot(x - INC.x, y - INC.y) > 90 && Math.abs(y - 300) > 26 && Math.abs(x - 560) > 26) { g.fillStyle = '#111e27'; g.fillRect(x, y, 46, 30); }
    const pulse = REDUCED ? 0 : (t * 1.2) % 1; g.strokeStyle = `rgba(255,119,86,${1 - pulse})`; g.lineWidth = 2; g.beginPath(); g.arc(INC.x, INC.y, 14 + 50 * pulse, 0, 7); g.stroke();
    g.fillStyle = '#ff7756'; g.beginPath(); g.arc(INC.x, INC.y, 8, 0, 7); g.fill(); g.fillStyle = '#f2f4f4'; g.font = '600 12px system-ui'; g.fillText('Persona atrapada (aviso + 2 testigos)', INC.x + 14, INC.y - 14);
    const rows = [];
    for (const u of U) {
      const d = playing || T > 0 ? Math.min(u.len, Math.max(0, T - u.t0) * (u.kmh / 3.6) * 6 / PX_M) : 0, p = at(u, d), left = (u.len - d) * PX_M, eta = left / (u.kmh / 3.6) / 60; // minutos reales a la velocidad declarada
      g.strokeStyle = u.col; g.globalAlpha = 0.35; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(p.x, p.y); let r = d; for (let i = 1; i < u.path.length; i++) { const a = u.path[i - 1], b = u.path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (r < L) g.lineTo(b[0], b[1]); r -= L; } g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      g.fillStyle = u.col; g.beginPath(); g.arc(p.x, p.y, 7, 0, 7); g.fill(); g.fillStyle = '#f2f4f4'; g.font = '600 11.5px system-ui'; g.fillText(u.id, p.x + 10, p.y + 18);
      rows.push(`<li><i style="background:${u.col}"></i><span><b>${u.unit}</b> <span class="mono">${u.id}</span></span><em>${left < 5 ? 'en el lugar' : `${nf(left / 1000, 1)} km · ${eta < 1 ? '<1' : nf(eta)} min`}</em></li>`);
    }
    $('#mando-units').innerHTML = rows.join('');
    g.fillStyle = '#9fb2bc'; g.font = '11.5px system-ui'; g.fillText(`EJERCICIO · mapa esquemático · 1 px = ${PX_M} m · tiempo ×6 · t = ${nf(T * 6)} s`, 12, H - 10);
  });
}

/* ---------- alerta oficial que se responde ---------- */
{
  const ph = $('#alert-phone'), out = $('#alert-out');
  $('#alert-arrive').addEventListener('click', () => { ph.classList.remove('arrived'); void ph.offsetWidth; ph.classList.add('arrived'); navigator.vibrate?.([200, 100, 200, 100, 400]); out.textContent = ''; $$('#alert-phone .ans').forEach((b) => (b.disabled = false)); });
  $$('#alert-phone .ans').forEach((b) => b.addEventListener('click', async () => {
    $$('#alert-phone .ans').forEach((x) => (x.disabled = true));
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const body = JSON.stringify({ alerta: 'EJERCICIO-RIADA-01', respuesta: b.dataset.r, planta: b.dataset.r === 'AYUDA' ? '2º' : null, t: new Date().toISOString() });
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(body)));
    out.innerHTML = `<b>${b.textContent.trim()}</b> → respuesta estructurada de ${body.length} B firmada (${sig.length} B de firma ECDSA). Sale por todos los caminos de la escena «Camino» y el centro la cuenta por planta y por calle. ${b.dataset.r === 'AYUDA' ? 'Tu posición y tu planta van con ella.' : b.dataset.r === 'PUEDO' ? 'El centro puede asignarte una tarea concreta, o no.' : b.dataset.r === 'VEO' ? 'Tu foto entra como nota de comunidad: suma, no decide.' : 'Dejas de contar como «sin noticias».'}`;
  }));
}

/* ---------- aviso de riada aguas arriba ---------- */
{
  const F = floodScenario(), cv = $('#flood-cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const town = F.towns.find((t) => t.id === 'B'), res = F.result.find((r) => r.id === 'B');
  const qMax = Math.max(...town.series, ...F.gaugeUp), N = F.gaugeUp.length;
  const X = (i) => 50 + (i / (N - 1)) * (W - 70), Y = (q) => H - 30 - (q / qMax) * (H - 60);
  let u = 0;
  onScreen(cv, (dt) => {
    u = Math.min(1, u + dt / 6); g.fillStyle = '#071018'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#203240'; g.lineWidth = 1; for (let h = 0; h <= F.hours; h += 6) { const x = X((h * 60) / F.dtMin); g.beginPath(); g.moveTo(x, 20); g.lineTo(x, H - 30); g.stroke(); g.fillStyle = '#9fb2bc'; g.font = '11px system-ui'; g.fillText(`${h} h`, x - 8, H - 12); }
    g.strokeStyle = '#ff5b6e'; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(50, Y(town.threshold)); g.lineTo(W - 20, Y(town.threshold)); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff5b6e'; g.fillText(`desborde en el pueblo (${town.threshold} m³/s)`, 56, Y(town.threshold) - 6);
    const n = Math.floor(u * (N - 1));
    for (const [s, col] of [[F.gaugeUp, '#91d7e8'], [town.series, '#ff7756']]) { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= Math.min(n, s.length - 1); i++) i ? g.lineTo(X(i), Y(s[i])) : g.moveTo(X(i), Y(s[i])); g.stroke(); }
    if (F.up.riseMin != null && n * F.dtMin >= F.up.riseMin) { const x = X(F.up.riseMin / F.dtMin); g.fillStyle = '#91d7e8'; g.beginPath(); g.arc(x, Y(F.gaugeUp[F.up.riseMin / F.dtMin]), 6, 0, 7); g.fill(); g.fillText('aviso: el aforo de cabecera sube rápido', x + 8, 40); }
    if (town.thresholdMin != null && n * F.dtMin >= town.thresholdMin) { const x = X(town.thresholdMin / F.dtMin); g.fillStyle = '#ff7756'; g.beginPath(); g.arc(x, Y(town.threshold), 6, 0, 7); g.fill(); }
  });
  $('#flood-lead').textContent = res?.leadMin != null ? `${res.leadMin} min` : '—';
}
