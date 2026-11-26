// SENDA · Radar de personas (RD-03D / LD2450). Toda la lógica de protocolo, seguimiento y calibración está en el núcleo probado.
import { CMD, SERIAL, createFrameParser, cleanTargets, createTracker, encodeFrame, radarToLonLat, trackBearingDeg, calibrateRange, calibrateMountYaw } from '/senda/core/mmwave-radar.mjs';
import { compassHeading } from '/senda/core/heading-fusion.mjs';

const $ = (id) => document.getElementById(id);
const COLORS = ['#34d399', '#91d7e8', '#fbbf24', '#ff7756', '#ff5b6e', '#c4b5fd'];
const cv = $('ppi'), ctx = cv.getContext('2d');
let tracker, parser, tracks = [], lastDets = [], source = null, stopFn = null, frames = 0, t0 = performance.now();
let rec = [], recording = false, trace = []; // grabación de bytes crudos con tiempo; trazas de pistas
const calPairs = [], yawPairs = [];
const log = (m) => { const el = $('log'); el.textContent = `${new Date().toISOString().slice(11, 19)}  ${m}\n` + el.textContent.slice(0, 4000); };

function cfg() {
  const n = (id) => Number($(id).value);
  return { minMm: n('minMm'), maxMm: n('maxMm'), mergeMm: n('mergeMm'), gateMm: n('gateMm'), qMmS2: n('qMmS2'), rMm: n('rMm'), maxMissS: n('maxMissS') };
}
function reset() {
  try { tracker = createTracker(cfg()); } catch (e) { log(`Ajuste no válido: ${e.message}`); tracker = null; }
  tracks = []; trace = [];
  parser = createFrameParser(onFrame);
}
for (const id of ['minMm', 'maxMm', 'mergeMm', 'gateMm', 'qMmS2', 'rMm', 'maxMissS']) $(id).addEventListener('change', reset);

function onFrame(raw) {
  frames++;
  let dets;
  try { dets = cleanTargets(raw, cfg()); } catch (e) { log(e.message); return; }
  lastDets = dets;
  if (!tracker) return;
  const tS = (performance.now() - t0) / 1000;
  tracks = tracker.step(dets, tS);
  const pose = poseOrNull();
  for (const tr of tracks) if (!tr.coasting) trace.push({ t: +tS.toFixed(3), id: tr.id, xMm: Math.round(tr.xMm), yMm: Math.round(tr.yMm), speedCms: tr.speedCms, ...(pose ? { lonlat: radarToLonLat(tr, pose).map((v) => +v.toFixed(7)) } : {}) });
  if (trace.length > 20000) trace.splice(0, trace.length - 20000);
  renderTable();
}
function feed(bytes) {
  if (recording) rec.push({ tMs: Math.round(performance.now() - t0), b64: btoa(String.fromCharCode(...bytes)) });
  parser.push(bytes);
}
function setBasis(kind, txt) { $('basisSq').className = `sq ${kind}`; $('basisTxt').textContent = txt; }
function started(kind, label, stop) {
  stopAll(); reset(); t0 = performance.now(); frames = 0; source = kind; stopFn = stop;
  $('stop').disabled = false; $('saveTracks').disabled = false; $('saveRec').disabled = kind !== 'serial';
  setBasis(kind === 'sim' ? 'sim' : kind === 'serial' ? 'real' : 'calc', label); log(label);
}
function stopAll() { if (stopFn) { try { stopFn(); } catch {} } stopFn = null; source = null; $('stop').disabled = true; recording = false; }
$('stop').onclick = () => { stopAll(); setBasis('', 'Parado'); log('Parado'); };

// ---- Radar real por USB: Web Serial (Chrome/Edge escritorio) o USB-OTG nativo en APK Android ----
const hasWebSerial = 'serial' in navigator;
const hasAndroidUsb = !!(window.SendaNative && typeof window.SendaNative.usbList === 'function');
const b64Of = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

if (!hasWebSerial && hasAndroidUsb) {
  $('connect').textContent = 'Conectar radar (USB-OTG Android)';
  $('serialNote').textContent = 'Puente nativo USB-OTG de SENDA Android disponible (CH340, CP210x, FTDI, CDC-ACM a 256000 8N1). Conecte el adaptador por cable OTG.';
} else if (!hasWebSerial) {
  $('connect').disabled = true;
  $('serialNote').textContent = 'Este navegador no tiene Web Serial. Use Chrome/Edge de escritorio, la APK de SENDA Android (USB-OTG) o abra una grabación.';
}

$('connect').onclick = async () => {
  if (!hasWebSerial && hasAndroidUsb) {
    let devs = [];
    try { devs = JSON.parse(window.SendaNative.usbList() || '[]'); } catch (e) { log(`Error listando USB-OTG: ${e.message}`); return; }
    if (!devs.length) { log('No se detectó ningún adaptador USB-serie (CH340/CP210x/FTDI/CDC-ACM). Conecte el cable OTG.'); return; }
    const dev = devs[0];
    let alive = true, iv = null;
    const sendMultiUsb = () => {
      for (const c of [CMD.ENABLE_CONFIG, CMD.MULTI_TARGET, CMD.END_CONFIG]) {
        window.SendaNative.usbWrite(b64Of(c));
      }
    };
    window.sendaUsbSerial = (b64) => { if (alive) feed(unb64(b64)); };
    window.sendaUsbStatus = (ev) => {
      if (!ev) return;
      log(`USB-OTG [${ev.event}]: ${ev.detail}`);
      if (ev.event === 'open' && alive) {
        sendMultiUsb();
        clearInterval(iv);
        iv = setInterval(() => { if (alive) sendMultiUsb(); }, 60_000);
      }
    };
    started('serial', `Radar real por USB-OTG Android (${dev.driver}, 256000 baudios)`, () => {
      alive = false; clearInterval(iv);
      window.sendaUsbSerial = null; window.sendaUsbStatus = null;
      try { window.SendaNative.usbClose(); } catch {}
    });
    recording = true; rec = [];
    if (!window.SendaNative.usbOpen(dev.deviceId)) { stopAll(); setBasis('', 'Error al abrir USB-OTG'); }
    return;
  }
  let port;
  try { port = await navigator.serial.requestPort(); await port.open(SERIAL); } catch (e) { log(`No se abrió el puerto: ${e.message}`); return; }
  let alive = true, reader;
  const writer = port.writable.getWriter();
  const sendMulti = async () => { for (const c of [CMD.ENABLE_CONFIG, CMD.MULTI_TARGET, CMD.END_CONFIG]) { await writer.write(c); await new Promise((r) => setTimeout(r, 50)); } };
  const iv = setInterval(() => { if (alive) sendMulti().catch(() => {}); }, 60_000);
  started('serial', 'Radar real conectado por USB (RD-03D/LD2450, 256000 baudios)', async () => { alive = false; clearInterval(iv); try { await reader?.cancel(); } catch {} try { writer.releaseLock(); } catch {} try { await port.close(); } catch {} });
  recording = true; rec = [];
  await sendMulti().catch((e) => log(`Orden multiobjetivo no enviada: ${e.message}`));
  reader = port.readable.getReader();
  (async () => { try { while (alive) { const { value, done } = await reader.read(); if (done) break; if (value) feed(value); } } catch (e) { if (alive) log(`Lectura interrumpida: ${e.message}`); } finally { try { reader.releaseLock(); } catch {} } })();
};

// ---- Grabación: .jsonl de SENDA (bytes con tiempo) o .bin crudo (intervalo declarado) ----
$('file').onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  const buf = new Uint8Array(await f.arrayBuffer());
  const hash = await sha256hex(buf);
  if (/\.jsonl$|\.txt$/i.test(f.name)) {
    const lines = new TextDecoder().decode(buf).split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((o) => o.b64 != null);
    let i = 0, timer; const start = performance.now();
    started('file', `Grabación (procedencia: la declara quien la grabó): ${f.name} · SHA-256 ${hash.slice(0, 12)}…`, () => clearTimeout(timer));
    const tick = () => { const now = performance.now() - start; while (i < lines.length && lines[i].tMs - lines[0].tMs <= now) { feed(Uint8Array.from(atob(lines[i].b64), (c) => c.charCodeAt(0))); i++; } if (i < lines.length) timer = setTimeout(tick, 15); else log('Fin de la grabación'); };
    tick();
  } else {
    $('binRateRow').hidden = false;
    const ms = Number($('binMs').value);
    if (!(ms > 0)) { log('Un .bin no trae tiempos: escriba el intervalo entre tramas y vuelva a abrirlo.'); $('binMs').focus(); return; }
    let off = 0, timer;
    started('file', `Grabación .bin (procedencia: la declara quien la grabó): ${f.name} · SHA-256 ${hash.slice(0, 12)}… · ${ms} ms por trama (declarado)`, () => clearInterval(timer));
    timer = setInterval(() => { if (off >= buf.length) { clearInterval(timer); log('Fin de la grabación'); return; } feed(buf.subarray(off, off + 30)); off += 30; }, ms);
  }
};

// ---- Simulación declarada: dos personas y un perro que se mueven; el código no sabe cuál es cuál ----
$('demo').onclick = () => {
  let k = 0, timer;
  started('sim', 'SIMULACIÓN: escenario inventado (dos personas y un perro), con ruido de medida inventado de ±80 mm', () => clearInterval(timer));
  const rnd = () => (Math.random() * 2 - 1) * 80;
  timer = setInterval(() => {
    const t = k++ * 0.1;
    const ts = [
      { xMm: -2500 + ((t * 700) % 5000), yMm: 3200 },
      { xMm: 2400 - ((t * 500) % 4800), yMm: 4300 + 300 * Math.sin(t / 2) },
      { xMm: 1500 * Math.cos(t * 0.9), yMm: 2000 + 900 * Math.sin(t * 0.9) },
    ].map((p, i) => ({ xMm: Math.round(p.xMm + rnd()), yMm: Math.round(p.yMm + rnd()), speedCms: Math.round((i === 2 ? -60 : -20) * Math.sin(t + i)), resMm: 360 }));
    feed(encodeFrame(ts));
  }, 100);
};

// ---- Pantalla de radar (PPI) ----
function size() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', size); size();
function draw() {
  const W = cv.clientWidth, H = cv.clientHeight, maxM = Math.max(1, cfg().maxMm / 1000);
  const ox = W / 2, oy = H - 28, R = Math.min(W / 2 - 20, H - 56), s = R / maxM;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#16232b'; ctx.fillStyle = '#5d6e77'; ctx.lineWidth = 1; ctx.font = '11px "IBM Plex Mono",monospace';
  for (let m = 1; m <= Math.floor(maxM); m++) { ctx.beginPath(); ctx.arc(ox, oy, m * s, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.fillText(`${m} m`, ox + 4, oy - m * s + 12); }
  for (let a = -90; a <= 90; a += 30) { const r = (a * Math.PI) / 180; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(r) * R, oy - Math.cos(r) * R); ctx.stroke(); if (a) ctx.fillText(`${a}°`, ox + Math.sin(r) * (R + 4) - 10, oy - Math.cos(r) * (R + 4)); }
  ctx.fillStyle = '#eef3f4'; ctx.fillRect(ox - 9, oy, 18, 5);
  const P = (x, y) => [ox + (x / 1000) * s, oy - (y / 1000) * s];
  ctx.fillStyle = 'rgba(147,167,177,.45)';
  for (const d of lastDets) { const [x, y] = P(d.xMm, d.yMm); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  for (const tr of tracks) {
    const c = COLORS[(tr.id - 1) % COLORS.length];
    ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.beginPath();
    tr.trail.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.globalAlpha = 1;
    const [x, y] = P(tr.xMm, tr.yMm), sig = Math.max(4, (tr.sigmaMm / 1000) * s);
    ctx.strokeStyle = c; ctx.setLineDash(tr.coasting ? [3, 3] : []); ctx.beginPath(); ctx.arc(x, y, sig + 4, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
    const vx = (tr.vxMms / 1000) * s, vy = (tr.vyMms / 1000) * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx, y - vy); ctx.stroke(); // 1 s de avance
    ctx.fillText(`#${tr.id}`, x + 9, y - 8);
  }
  const st = parser?.stats() ?? { ok: 0, bad: 0 }, el = (performance.now() - t0) / 1000;
  $('hud').innerHTML = `<b>${tracks.filter((t) => !t.coasting).length}</b> en movimiento · ${tracks.filter((t) => t.coasting).length} en espera<br>tramas ${st.ok} · corruptas ${st.bad} · ${source ? (st.ok / Math.max(el, 0.001)).toFixed(1) : '0.0'} Hz`;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

function renderTable() {
  $('tracks').innerHTML = tracks.map((tr) => {
    const d = Math.hypot(tr.xMm, tr.yMm) / 1000, a = (Math.atan2(tr.xMm, tr.yMm) * 180) / Math.PI;
    return `<tr><td><span class="sw" style="background:${COLORS[(tr.id - 1) % COLORS.length]}"></span>#${tr.id}${tr.coasting ? ' · en espera' : ''}</td><td class="n mono">${d.toFixed(2)} m</td><td class="n mono">${a.toFixed(0)}°</td><td class="n mono">${tr.speedCms} cm/s</td><td class="n mono">${Math.round(tr.sigmaMm)} mm</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="color:var(--d)">Nadie en movimiento</td></tr>';
}
renderTable();

// ---- Calibración ----
const nearest = () => tracks.filter((t) => !t.coasting).sort((a, b) => Math.hypot(a.xMm, a.yMm) - Math.hypot(b.xMm, b.yMm))[0];
$('calAdd').onclick = () => {
  const tr = nearest(), real = Number($('calTrue').value);
  if (!tr) return log('No hay ninguna persona en movimiento para anotar.');
  if (!(real > 0)) return log('Escriba la distancia real medida con la cinta.');
  calPairs.push({ measuredMm: Math.hypot(tr.xMm, tr.yMm), trueMm: real });
  $('calOut').textContent = `${calPairs.length} pares anotados (último: medido ${Math.round(calPairs.at(-1).measuredMm)} mm, real ${real} mm)`;
};
$('calFit').onclick = () => { try { const c = calibrateRange(calPairs); $('calOut').textContent = `escala ${c.scale} · sesgo ${c.biasMm} mm · residuo ${c.residualRmsMm} mm (n = ${c.n}) · calculado`; } catch (e) { $('calOut').textContent = e.message; } };
$('yawAdd').onclick = () => {
  const tr = tracks.slice().sort((a, b) => b.trail.length - a.trail.length)[0], real = Number($('yawTrue').value);
  if (!tr || tr.trail.length < 10) return log('Hace falta una marcha de al menos 1 s seguida por el radar.');
  if (!Number.isFinite(real) || $('yawTrue').value === '') return log('Escriba el rumbo real de la línea por la que se camina.');
  const hdg = Number($('hdg').value);
  if (!Number.isFinite(hdg) || $('hdg').value === '') return log('Para el montaje hace falta saber hacia dónde mira el radar (sección «Posición en el mapa»).');
  const b = trackBearingDeg(tr.trail); yawPairs.push({ measuredDeg: (b.bearingDeg + hdg) % 360, trueDeg: real });
  const c = calibrateMountYaw(yawPairs);
  $('yawOut').textContent = `marcha medida ${b.bearingDeg.toFixed(1)}° (desvío lateral ${Math.round(b.lateralRmsMm)} mm) · corrección de montaje ${c.mountYawDeg}° ± ${c.circularSpreadDeg}° (n = ${c.n}) · calculado`;
};

// ---- Posición ----
function poseOrNull() {
  const lat = Number($('lat').value), lon = Number($('lon').value), hdg = Number($('hdg').value);
  if ([$('lat').value, $('lon').value, $('hdg').value].some((v) => v === '') || ![lat, lon, hdg].every(Number.isFinite)) return null;
  const yaw = yawPairs.length ? calibrateMountYaw(yawPairs).mountYawDeg : 0;
  return { lat, lon, headingDeg: hdg, mountYawDeg: yaw };
}
$('useGeo').onclick = () => {
  navigator.geolocation?.getCurrentPosition((p) => { $('lat').value = p.coords.latitude.toFixed(6); $('lon').value = p.coords.longitude.toFixed(6); $('geoNote').textContent = `GPS ± ${Math.round(p.coords.accuracy)} m (medido por el equipo).`; }, (e) => { $('geoNote').textContent = `Sin GPS: ${e.message}`; }, { enableHighAccuracy: true, maximumAge: 0 });
  const on = (ev) => { const h = compassHeading(ev, { screenAngle: screen.orientation?.angle ?? 0 }); if (h) { $('hdg').value = h.headingDeg.toFixed(1); removeEventListener('deviceorientationabsolute', on); removeEventListener('deviceorientation', on); $('geoNote').textContent += ` Brújula ${h.headingDeg.toFixed(0)}° (${h.mode}); apunte el equipo como el radar.`; } };
  addEventListener('deviceorientationabsolute', on); addEventListener('deviceorientation', on);
};

// ---- Exportar con huella ----
async function sha256hex(data) { const d = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
async function download(name, text) {
  const bytes = new TextEncoder().encode(text), h = await sha256hex(bytes);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click();
  log(`${name} · SHA-256 ${h}`);
}
$('saveRec').onclick = () => { if (!rec.length) return log('Aún no hay bytes grabados.'); download(`senda-radar-${Date.now()}.jsonl`, rec.map((r) => JSON.stringify(r)).join('\n') + '\n'); };
$('saveTracks').onclick = () => {
  const basis = source === 'sim' ? 'SIMULATION' : source === 'serial' ? 'MEASURED' : 'RECORDING';
  const byId = new Map(); for (const p of trace) { if (!byId.has(p.id)) byId.set(p.id, []); byId.get(p.id).push(p); }
  const features = [...byId].map(([id, pts]) => ({ type: 'Feature', properties: { track: id, basis, sensor: 'RD-03D/LD2450', points: pts.length, radarFrameMm: pts.map((p) => [p.t, p.xMm, p.yMm, p.speedCms]) }, geometry: pts[0].lonlat ? { type: 'LineString', coordinates: pts.map((p) => p.lonlat) } : null }));
  download(`senda-trazas-${Date.now()}.geojson`, JSON.stringify({ type: 'FeatureCollection', basis, note: basis === 'SIMULATION' ? 'Escenario inventado: no es una medida.' : basis === 'MEASURED' ? 'Trazas medidas por el radar conectado en esta sesión.' : 'Trazas de una grabación: su procedencia la declara quien la grabó.', features }, null, 1));
};
