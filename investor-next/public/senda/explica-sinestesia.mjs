// Sinestesia cibernética y mapa de la plataforma para /senda/explica.
// - Datos por sonido con el módem real de SENDA (acoustic-modem.mjs): se oye, se ve el espectrograma y se decodifica.
// - El paso real de la ISS (TLE AMSAT) y su desplazamiento Doppler en 145,825 MHz, convertido en sonido.
// - Espectrograma en vivo del micrófono.
// - Conmutador Guía / Ciencia y diagrama vivo de la plataforma.
import { modulate, demodulate, airtimeSeconds } from '/senda/core/acoustic-modem.mjs';
import { parseTleFile, predictPasses, lookAngles } from '/senda/core/orbital.mjs';

const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (x, d = 0) => Number(x).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
let AC = null; const ctx = () => (AC ??= new (window.AudioContext || window.webkitAudioContext)());

/* ---------- FFT radix-2 (in situ) para los espectrogramas ---------- */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
const heat = (v) => { const t = Math.max(0, Math.min(1, v)); return [Math.round(255 * Math.min(1, t * 1.6)), Math.round(255 * Math.max(0, t * 1.6 - 0.45)), Math.round(120 * (1 - t) + 80 * Math.max(0, t - 0.8))]; };

/* ---------- 1. un mensaje que se oye, se ve y se decodifica ---------- */
{
  const cv = $('#ac-cv'), g = cv.getContext('2d'), SR = 48000;
  let samples = null, noisy = null, playHead = -1, t0 = 0, dur = 0;
  function spectrogram(x) {
    const N = 1024, hop = 384, cols = Math.floor((x.length - N) / hop), fMax = 6000, bins = Math.floor((fMax / SR) * N), img = g.createImageData(cv.width, cv.height);
    const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)), mags = [];
    let mx = 1e-9;
    for (let c = 0; c < cols; c++) { const re = new Float32Array(N), im = new Float32Array(N); for (let i = 0; i < N; i++) re[i] = x[c * hop + i] * win[i]; fft(re, im); const col = new Float32Array(bins); for (let b = 0; b < bins; b++) { col[b] = Math.log10(1e-6 + Math.hypot(re[b], im[b])); mx = Math.max(mx, col[b]); } mags.push(col); }
    const mn = mx - 3.2;
    for (let px = 0; px < cv.width; px++) { const col = mags[Math.floor((px / cv.width) * cols)]; for (let py = 0; py < cv.height; py++) { const b = Math.floor((1 - py / cv.height) * (bins - 1)), [r, gg, bb] = heat((col[b] - mn) / (mx - mn)), k = 4 * (py * cv.width + px); img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = bb; img.data[k + 3] = 255; } }
    return img;
  }
  let img = null;
  function render() {
    if (img) g.putImageData(img, 0, 0); else { g.fillStyle = '#071018'; g.fillRect(0, 0, cv.width, cv.height); }
    g.fillStyle = '#cfd8dc'; g.font = '12px system-ui'; for (const f of [2000, 3000, 4000, 5000]) { const y = cv.height * (1 - f / 6000); g.fillText(`${f / 1000} kHz`, 8, y + 4); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(50, y); g.lineTo(cv.width, y); g.stroke(); }
    if (playHead >= 0) { const x = playHead * cv.width; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cv.height); g.stroke(); }
  }
  function encode() {
    const txt = $('#ac-text').value.slice(0, 60) || 'SOS';
    const data = new TextEncoder().encode(txt);
    samples = modulate(data, { sampleRate: SR });
    const snr = +$('#ac-noise').value; let s = 99; const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    noisy = Float32Array.from(samples, (v) => { let u = 0, w = 0; while (!u) u = R(); while (!w) w = R(); return v + snr * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); });
    img = spectrogram(noisy); dur = noisy.length / SR; render();
    const r = demodulate(noisy, { sampleRate: SR });
    const ok = r && new TextDecoder().decode(r.payload) === txt;
    $('#ac-out').innerHTML = `${data.length} bytes → <b>${nf(dur, 1)} s</b> de audio (16 tonos entre 2 y 5 kHz, Hamming + CRC-32). Ruido añadido σ = ${nf(snr, 2)}: ${r ? `<b style="color:${ok ? 'var(--mint)' : 'var(--rose)'}">decodificado ${ok ? 'idéntico' : 'distinto'}</b> («${new TextDecoder().decode(r.payload)}»), ${r.corrected} correcciones` : '<b style="color:var(--rose)">no decodificable: SENDA lo descarta, nunca entrega basura</b>'}.`;
  }
  $('#ac-make').addEventListener('click', encode);
  $('#ac-noise').addEventListener('input', () => { $('#ac-noise-v').textContent = nf(+$('#ac-noise').value, 2); });
  $('#ac-noise').addEventListener('change', encode);
  $('#ac-play').addEventListener('click', () => {
    if (!noisy) encode(); const c = ctx(), buf = c.createBuffer(1, noisy.length, SR); buf.copyToChannel(Float32Array.from(noisy, (v) => Math.max(-1, Math.min(1, v * 0.6))), 0);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start(); t0 = c.currentTime;
    const tick = () => { playHead = (c.currentTime - t0) / dur; render(); if (playHead < 1) requestAnimationFrame(tick); else { playHead = -1; render(); } }; requestAnimationFrame(tick);
  });
  encode();
}

/* ---------- 2. el próximo paso de la ISS y su Doppler, hecho sonido ---------- */
{
  const cv = $('#iss-cv'), g = cv.getContext('2d'), F = 145.825e6, OBS = { lat: 40.4168, lon: -3.7038, altKm: 0.65 };
  let curve = null, pass = null;
  fetch('/senda/data/tle/amsat-nasabare-2026-11-20.txt').then((r) => r.text()).then((t) => {
    const iss = parseTleFile(t).find((e) => /ISS/.test(e.name)); if (!iss) { $('#iss-out').textContent = 'La ISS no está en la instantánea.'; return; }
    const now = Date.now(), ps = predictPasses(iss, OBS, { from: now, to: now + 2 * 86400_000, stepS: 15, minElevationDeg: 10 });
    pass = ps[0]; if (!pass) { $('#iss-out').textContent = 'Sin pasos sobre Madrid en 48 h por encima de 10°.'; return; }
    const from = pass.start - 120_000, to = pass.end + 120_000; curve = [];
    for (let tt = from; tt <= to; tt += 5000) { const a = lookAngles(iss, OBS, tt); curve.push({ t: tt, el: a.elevationDeg, dop: a.computeDopplerShiftHz(F) }); }
    const dmax = Math.max(...curve.map((c) => Math.abs(c.dop)));
    const when = new Date(pass.start).toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    $('#iss-out').innerHTML = `Próximo paso sobre Madrid: <b>${when}</b> (hora peninsular), altura máxima <b>${nf(pass.maxElevationDeg)}°</b>, ${nf((pass.end - pass.start) / 60000, 1)} min sobre 10°. El receptor debe corregir hasta <b>±${nf(dmax / 1000, 1)} kHz</b> en 145,825 MHz.`;
    draw(-1);
  });
  function draw(u) {
    const W = cv.width, H = cv.height; g.fillStyle = '#071018'; g.fillRect(0, 0, W, H); if (!curve) return;
    const dmax = Math.max(...curve.map((c) => Math.abs(c.dop))), X = (i) => 40 + (i / (curve.length - 1)) * (W - 60), Yd = (d) => H / 2 - (d / dmax) * (H / 2 - 30), Ye = (e) => H - 20 - (Math.max(0, e) / 90) * (H - 50);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(40, H / 2); g.lineTo(W - 20, H / 2); g.stroke();
    g.strokeStyle = 'rgba(145,215,232,.5)'; g.lineWidth = 1.5; g.beginPath(); curve.forEach((c, i) => (i ? g.lineTo(X(i), Ye(c.el)) : g.moveTo(X(i), Ye(c.el)))); g.stroke();
    g.strokeStyle = '#ff7756'; g.lineWidth = 2.5; g.beginPath(); curve.forEach((c, i) => (i ? g.lineTo(X(i), Yd(c.dop)) : g.moveTo(X(i), Yd(c.dop)))); g.stroke();
    g.fillStyle = '#ff7756'; g.font = '12px system-ui'; g.fillText(`Doppler: +${nf(dmax / 1000, 1)} kHz al acercarse`, 46, 22); g.fillText(`−${nf(dmax / 1000, 1)} kHz al alejarse`, 46, H - 26); g.fillStyle = '#91d7e8'; g.fillText('altura sobre el horizonte', W - 170, 22);
    if (u >= 0) { const x = 40 + u * (W - 60); g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, 10); g.lineTo(x, H - 10); g.stroke(); }
  }
  $('#iss-play').addEventListener('click', () => {
    if (!curve) return; const c = ctx(), o = c.createOscillator(), gn = c.createGain(), T = 8, dmax = Math.max(...curve.map((k) => Math.abs(k.dop)));
    o.type = 'sine'; gn.gain.value = 0.0001; o.connect(gn).connect(c.destination); const t0 = c.currentTime;
    curve.forEach((k, i) => o.frequency.setValueAtTime(880 + (k.dop / dmax) * 400, t0 + (i / (curve.length - 1)) * T));
    gn.gain.exponentialRampToValueAtTime(0.18, t0 + 0.2); gn.gain.setValueAtTime(0.18, t0 + T - 0.3); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + T);
    o.start(t0); o.stop(t0 + T); const tick = () => { const u = (c.currentTime - t0) / T; draw(Math.min(1, u)); if (u < 1) requestAnimationFrame(tick); else draw(-1); }; requestAnimationFrame(tick);
  });
}

/* ---------- 3. ver el sonido del aire en vivo (micrófono) ---------- */
{
  const cv = $('#mic-cv'), g = cv.getContext('2d'); let an = null, data = null, x = 0;
  g.fillStyle = '#071018'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#93a7b1'; g.font = '13px system-ui'; g.fillText('Pulsa «Escuchar» y reproduce el mensaje desde otro móvil: verás sus 16 tonos.', 16, cv.height / 2);
  $('#mic-go').addEventListener('click', async () => {
    try { const c = ctx(), st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } }); an = c.createAnalyser(); an.fftSize = 2048; c.createMediaStreamSource(st).connect(an); data = new Uint8Array(an.frequencyBinCount); $('#mic-go').textContent = 'Escuchando'; loop(); }
    catch { $('#mic-go').textContent = 'Micrófono no disponible'; }
  });
  function loop() {
    an.getByteFrequencyData(data); const bins = Math.floor((6000 / ctx().sampleRate) * 2 * data.length);
    for (let py = 0; py < cv.height; py++) { const b = Math.floor((1 - py / cv.height) * (bins - 1)), [r, gg, bb] = heat(data[b] / 255); g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(x, py, 2, 1); }
    x = (x + 2) % cv.width; g.fillStyle = '#fff'; g.fillRect(x, 0, 1, cv.height); requestAnimationFrame(loop);
  }
}

/* ---------- 4. conmutador Guía / Ciencia ---------- */
{
  const btn = $('#mode-btn'); let sci = false;
  try { sci = localStorage.getItem('senda-explica-ciencia') === '1'; } catch {}
  const apply = () => { document.body.classList.toggle('mode-sci', sci); btn.textContent = sci ? 'Modo: Ciencia' : 'Modo: Guía'; btn.setAttribute('aria-pressed', String(sci)); };
  btn.addEventListener('click', () => { sci = !sci; try { localStorage.setItem('senda-explica-ciencia', sci ? '1' : '0'); } catch {} apply(); });
  apply();
}

/* ---------- 5. la plataforma: datos que fluyen entre capas ---------- */
{
  const cv = $('#plat-cv'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  const L = [
    { y: 70, name: 'FUENTES', col: '#91d7e8', n: ['Copernicus Sentinel', 'Cámaras DGT · TfL', 'Sismos USGS · EMSC', 'Alertas CAP', 'TLE AMSAT', 'Horarios GTFS', 'Testigos'] },
    { y: 200, name: 'NÚCLEO SENDA', col: '#ff7756', n: ['Cifrado y firma', 'k de n Reed-Solomon', 'Garantía de entrega', 'Fusión y credibilidad', 'Previsión de apagón', 'Física de fuego y agua', 'CAP 1.2 · auditoría'] },
    { y: 330, name: 'CAMINOS', col: '#34d399', n: ['Bluetooth · Wi-Fi Direct', 'Sonido', 'SMS', 'Satélite al móvil', 'LoRa', 'Iridium', 'Dron · autobús · coche'] },
    { y: 460, name: 'SUPERFICIES', col: '#fbbf24', n: ['SENDA Campo (PWA)', 'Android', 'iOS Drive', 'Centro · Consola', 'Command Center', 'SENDA Live', 'Accesorio ESP32'] },
  ];
  const pos = (li, i) => ({ x: 80 + (i / (L[li].n.length - 1)) * (W - 160), y: L[li].y });
  let s = 5; const R = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const parts = [];
  const io = new IntersectionObserver(([e]) => (on = e.isIntersecting)); let on = false; io.observe(cv); let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t; requestAnimationFrame(frame); if (!on) return;
    g.fillStyle = '#04080b'; g.fillRect(0, 0, W, H);
    for (let li = 0; li < 3; li++) for (let i = 0; i < L[li].n.length; i++) for (let j = 0; j < L[li + 1].n.length; j++) { const a = pos(li, i), b = pos(li + 1, j); g.strokeStyle = 'rgba(255,255,255,.035)'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
    if (!REDUCED && R() < 0.5) { const li = Math.floor(R() * 3); parts.push({ li, i: Math.floor(R() * 7), j: Math.floor(R() * 7), u: 0, col: L[li].col }); }
    for (const p of parts) { p.u += dt * 0.9; const a = pos(p.li, p.i), b = pos(p.li + 1, p.j), x = a.x + (b.x - a.x) * p.u, y = a.y + (b.y - a.y) * p.u; g.fillStyle = p.col; g.globalAlpha = Math.sin(Math.PI * Math.min(1, p.u)); g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); g.globalAlpha = 1; }
    for (let k = parts.length - 1; k >= 0; k--) if (parts[k].u >= 1) parts.splice(k, 1);
    L.forEach((l, li) => { g.fillStyle = l.col; g.font = '700 11px ui-monospace,monospace'; g.fillText(l.name, 14, l.y - 26);
      l.n.forEach((name, i) => { const p = pos(li, i); g.fillStyle = '#04080b'; g.beginPath(); g.arc(p.x, p.y, 9, 0, 7); g.fill(); g.strokeStyle = l.col; g.lineWidth = 2; g.stroke(); g.fillStyle = '#e6edf0'; g.font = '12px system-ui'; const w = g.measureText(name).width; g.fillText(name, p.x - w / 2, p.y + 26); }); });
  }
  requestAnimationFrame(frame);
}

/* ---------- 6. la respiración vista en el Wi-Fi: subportadoras × tiempo ---------- */
import('/senda/core/through-wall.mjs').then(({ synthesizeCsi }) => {
  const cv = $('#csi-mini'), g = cv.getContext('2d'), fr = synthesizeCsi({ rpm: 14, person: true, seed: 5, seconds: 30 }), nS = fr[0].length;
  const mean = Array.from({ length: nS }, (_, k) => fr.reduce((a, r) => a + r[k], 0) / fr.length), img = g.createImageData(cv.width, cv.height);
  let mx = 1e-9; for (const r of fr) for (let k = 0; k < nS; k++) mx = Math.max(mx, Math.abs(r[k] - mean[k]));
  for (let x = 0; x < cv.width; x++) { const r = fr[Math.floor((x / cv.width) * fr.length)]; for (let y = 0; y < cv.height; y++) { const k = Math.floor((y / cv.height) * nS), [R, G, B] = heat(0.5 + (0.5 * (r[k] - mean[k])) / mx), i = 4 * (y * cv.width + x); img.data[i] = R; img.data[i + 1] = G; img.data[i + 2] = B; img.data[i + 3] = 255; } }
  g.putImageData(img, 0, 0); g.fillStyle = 'rgba(4,8,11,.75)'; g.fillRect(0, cv.height - 26, cv.width, 26); g.fillStyle = '#e6edf0'; g.font = '12px system-ui';
  g.fillText('52 subportadoras Wi-Fi × 30 s · las bandas son 7 respiraciones (14/min) · señal SINTÉTICA', 10, cv.height - 9);
});
