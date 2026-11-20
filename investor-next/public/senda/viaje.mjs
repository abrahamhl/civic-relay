// SENDA · De Arnhem a San Martín: el viaje real de un mensaje con el núcleo de SENDA.
import { generateIdentity, sealMessage, openMessage, packEnvelope, unpackEnvelope, relayView } from '/senda/core/envelope.mjs';
import { planMultiBearer, shardForPlan, fromBearerFrame, splitShards, BEARERS } from '/senda/core/bearers.mjs';
import { createReassembler } from '/senda/core/erasure.mjs';
import { modulate, airtimeSeconds } from '/senda/core/acoustic-modem.mjs';

const $ = (s) => document.querySelector(s);
const nf = (x, d = 0) => Number(x).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d });
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
const ARN = { lat: 51.985, lon: 5.899 }, SMV = { lat: 40.362, lon: -4.398 };
const R = 6371, rad = (d) => (d * Math.PI) / 180;
const distKm = 2 * R * Math.asin(Math.sqrt(Math.sin(rad(SMV.lat - ARN.lat) / 2) ** 2 + Math.cos(rad(ARN.lat)) * Math.cos(rad(SMV.lat)) * Math.sin(rad(SMV.lon - ARN.lon) / 2) ** 2));

let ID = null, env = null, bytes = null, plan = null;
const OPTS = [
  { id: 'SAT_D2C_SMS', label: 'Satélite directo al móvil', d: 'Solo si su operador ofrece el servicio y el móvil es compatible.' },
  { id: 'RELAY_INTERNET', label: 'Un vecino con Internet y SENDA', d: 'Fibra o antena satelital de un vecino; su móvil hace de pasarela.' },
  { id: 'PHONE_MESH', label: 'Vecinos con SENDA cerca', d: 'De móvil en móvil por Bluetooth o Wi-Fi Direct hasta él.' },
  { id: 'MESHTASTIC', label: 'Nodo de radio LoRa', d: 'Ayuntamiento, protección civil o un particular con un nodo de 868 MHz.' },
  { id: 'APRS', label: 'Un radioaficionado (APRS)', d: 'Las bandas de aficionado no admiten mensajes cifrados.' },
  { id: 'DRONE_MULE', label: 'Dron de emergencias que pasa', d: 'Recoge y entrega mensajes guardados en una salida programada.' },
];
const on = new Set();
$('#opts').innerHTML = OPTS.map((o) => `<label class="opt"><input type="checkbox" data-b="${o.id}"><span><b>${o.label}</b><small>${o.d}</small></span></label>`).join('');
$('#opts').addEventListener('change', (e) => { const b = e.target.dataset.b; if (!b) return; e.target.checked ? on.add(b) : on.delete(b); replan(); });

/* ---------- 1 · cifrar y firmar ---------- */
async function seal() {
  ID ??= { yo: await generateIdentity(), hermano: await generateIdentity() };
  const now = Date.now(), body = $('#msg').value.trim() || 'Estoy bien.';
  env = await sealMessage({ sender: ID.yo, recipient: ID.hermano.publicIdentity, body, priority: 2, ttlS: 7 * 86400, now, kind: 'PERSONAL' });
  bytes = packEnvelope(env);
  const rv = relayView(env, now);
  $('#sealout').innerHTML = `<div class="row"><span>Texto que escribes</span><b>${nf(new TextEncoder().encode(body).length)} bytes</b></div><div class="row"><span>Sobre cifrado y firmado</span><b>${nf(bytes.length)} bytes</b></div><div class="row"><span>Caduca</span><b>en 7 días</b></div>`;
  $('#relayview').innerHTML = Object.entries(rv).map(([k, v]) => `<div class="row"><span>${k}</span><b class="mono">${typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}</b></div>`).join('') + '<p class="note">El texto, el remitente legible y el destinatario legible no aparecen: van cifrados.</p>';
  replan(); await forms();
}
$('#seal').addEventListener('click', seal);

/* ---------- 3 · última milla ---------- */
function replan() {
  const avail = [...on].map((id) => ({ id }));
  const size = bytes?.length ?? 600;
  plan = avail.length ? planMultiBearer(size, avail, { target: 0.99 }) : null;
  const ex = (plan?.excluded ?? (on.has('APRS') ? [{ id: 'APRS', reason: 'Banda de radioaficionado: no admite contenido cifrado' }] : []));
  let html = `<div class="row"><span>Arnhem → San Martín</span><b>${nf(distKm)} km (gran círculo)</b></div><div class="row"><span>Tramo 1: tu móvil → relé SENDA</span><b>Internet: sí</b></div>`;
  if (!plan || !plan.k) {
    html += `<p class="status wait">Pendiente: guardado en el relé</p><p class="t" style="font-size:15px">No hay ningún camino hasta él ahora mismo. El mensaje espera cifrado y sale solo en cuanto aparezca uno (un vecino con SENDA, un coche que pase, un nodo de radio). Tú ves «en camino»; nunca «entregado» sin su acuse firmado.</p>`;
  } else {
    const per = {}; for (const m of plan.messages) per[m.id] = (per[m.id] ?? 0) + m.shards;
    html += `<p class="status ${plan.feasible ? 'ok' : 'wait'}">${plan.feasible ? 'Entregable' : 'Entregable con baja probabilidad'}: ${nf(100 * plan.pDelivery, 1)} %</p>`;
    html += `<div class="row"><span>Fragmentos</span><b>k = ${plan.k} de n = ${plan.n}</b></div>` + Object.entries(per).map(([k, v]) => `<div class="row"><span>${OPTS.find((o) => o.id === k)?.label ?? k}</span><b>${v} fragm.</b></div>`).join('');
    html += `<div class="row"><span>Tiempo para el 99 %</span><b>${Number.isFinite(plan.etaS) ? (plan.etaS < 120 ? `${plan.etaS} s` : `${Math.round(plan.etaS / 60)} min`) : 'no alcanza el 99 %'}</b></div>`;
  }
  for (const e of ex) html += `<p class="note">Excluido: ${OPTS.find((o) => o.id === e.id)?.label ?? e.id}. ${e.reason}.</p>`;
  html += `<p class="note">Plan calculado con <span class="mono">planMultiBearer</span> (Reed-Solomon k de n, probabilidad exacta). Probabilidades de planificación, no medidas de campo.</p>`;
  $('#planout').innerHTML = html; draw();
}

/* ---------- mapa del recorrido ---------- */
const cv = $('#map'), g = cv.getContext('2d'); let t0 = performance.now();
const X = (lon) => 60 + ((lon + 10) / 22) * (cv.width - 120), Y = (lat) => 40 + ((56 - lat) / 19) * (cv.height - 80);
function draw() {
  const W = cv.width, H = cv.height, t = (performance.now() - t0) / 1000; g.fillStyle = '#0a0c0f'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1b2026'; g.lineWidth = 1; for (let lo = -10; lo <= 12; lo += 2) { g.beginPath(); g.moveTo(X(lo), 0); g.lineTo(X(lo), H); g.stroke(); } for (let la = 38; la <= 56; la += 2) { g.beginPath(); g.moveTo(0, Y(la)); g.lineTo(W, Y(la)); g.stroke(); }
  g.fillStyle = '#646c77'; g.font = '12px Inter'; g.fillText('cuadrícula de 2° · sin mapa base (la página no carga teselas externas)', 12, H - 10);
  const a = { x: X(ARN.lon), y: Y(ARN.lat) }, s = { x: X(SMV.lon), y: Y(SMV.lat) }, relay = { x: X(2.2), y: Y(48.9) };
  g.strokeStyle = '#4f8cff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(relay.x, relay.y); g.stroke();
  const ok = plan && plan.k; g.strokeStyle = ok ? '#3fb27f' : '#f0a73a'; g.setLineDash(ok ? [] : [6, 6]); g.beginPath(); g.moveTo(relay.x, relay.y); g.lineTo(s.x, s.y); g.stroke(); g.setLineDash([]);
  const u = (t % 3) / 3, p = u < 0.5 ? { x: a.x + (relay.x - a.x) * u * 2, y: a.y + (relay.y - a.y) * u * 2 } : ok ? { x: relay.x + (s.x - relay.x) * (u - 0.5) * 2, y: relay.y + (s.y - relay.y) * (u - 0.5) * 2 } : relay;
  g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill();
  for (const [q, l, c] of [[a, 'Arnhem · tú (Internet)', '#4f8cff'], [relay, 'Relé SENDA (guarda, no lee)', '#c9ced4'], [s, ok ? 'San Martín · tu hermano' : 'San Martín · sin camino: espera', ok ? '#3fb27f' : '#f0a73a']]) { g.fillStyle = c; g.beginPath(); g.arc(q.x, q.y, 7, 0, 7); g.fill(); g.fillStyle = '#e8eaed'; g.font = '600 13px Inter'; g.fillText(l, q.x + 12, q.y + 4); }
  requestAnimationFrame(draw);
}

/* ---------- 4 · cinco formas + verificación de extremo a extremo ---------- */
async function forms() {
  const now = Date.now();
  const smsPlan = planMultiBearer(bytes.length, [{ id: 'SMS', messages: 40 }], { target: 0.5 });
  const smsFrames = shardForPlan(bytes, { ...smsPlan, messages: smsPlan.messages });
  $('#f-sms-h').textContent = `${smsFrames.length} SMS de hasta 160 caracteres (prefijo «SND1»), con ${smsPlan.k} fragmentos que bastan de ${smsPlan.n}.`;
  $('#f-sms').textContent = smsFrames.slice(0, 3).map((f) => f.frame).join('\n') + (smsFrames.length > 3 ? `\n… (${smsFrames.length - 3} más)` : '');
  const loraPlan = planMultiBearer(bytes.length, [{ id: 'MESHTASTIC', messages: 20 }], { target: 0.5 });
  const loraFrames = shardForPlan(bytes, loraPlan);
  $('#f-lora-h').textContent = `${loraFrames.length} tramas binarias de hasta 200 bytes (k = ${loraPlan.k}).`;
  $('#f-lora').textContent = loraFrames.slice(0, 2).map((f) => hex(f.frame.slice(0, 48)) + ' …').join('\n');
  $('#f-snd-h').textContent = `${nf(airtimeSeconds(bytes.length), 1)} s de audio a 160 bit/s brutos con 16 tonos de 2 a 5 kHz; en la práctica se envía por tramos.`;
  const bits = bytes.length * 8 * 2; // Manchester: 2 símbolos por bit
  $('#f-light-h').textContent = `${nf(bits / 20 / 60, 1)} min a 20 símbolos/s (lo que puede seguir la cámara de otro móvil); pensado para avisos cortos, no para este sobre completo.`;
  // Reconstrucción real: todas las tramas SMS → fragmentos → sobre → abrir con la clave del hermano.
  const ra = createReassembler(); let out = null;
  for (const f of smsFrames) { const b = fromBearerFrame(f.frame); for (const s of splitShards(b)) out = ra.add(s, 'SMS') ?? out; }
  if (!out) { $('#verify').textContent = 'No se pudo reconstruir.'; return; }
  const same = out.data.length === bytes.length && out.data.every((v, i) => v === bytes[i]);
  const opened = await openMessage({ recipient: ID.hermano, envelope: unpackEnvelope(out.data), now, expectedSender: ID.yo });
  const txt = opened.body ?? opened.text ?? JSON.stringify(opened);
  let tamper = 'no probado';
  try { const bad = Uint8Array.from(out.data); bad[bad.length - 5] ^= 1; await openMessage({ recipient: ID.hermano, envelope: unpackEnvelope(bad), now, expectedSender: ID.yo }); tamper = 'NO detectado'; } catch { tamper = 'detectado y descartado'; }
  $('#verify').innerHTML = `<b>Verificado en este navegador.</b> Los ${smsFrames.length} SMS se juntaron en un sobre ${same ? 'idéntico bit a bit' : 'DISTINTO'} al original, la firma es válida y tu hermano lee: «${String(txt).replace(/</g, '&lt;')}». Si se cambia un solo bit por el camino: ${tamper}.`;
  window.__viaje = { same, tamper, frames: smsFrames.length };
}

/* sonido y luz */
$('#f-snd-play').addEventListener('click', () => {
  if (!bytes) return; const sr = 48000, s = modulate(bytes.slice(0, 32), { sampleRate: sr }), c = new (window.AudioContext || window.webkitAudioContext)();
  const buf = c.createBuffer(1, s.length, sr); buf.copyToChannel(Float32Array.from(s, (v) => v * 0.5), 0); const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination); src.start();
});
$('#f-light-play').addEventListener('click', async () => {
  if (!bytes) return; const el = $('#f-light'), sym = []; for (let i = 7; i >= 0; i--) { const bit = (bytes[0] >> i) & 1; sym.push(bit, 1 - bit); }
  for (const v of [1, 0, 1, 0, ...sym, 0]) { el.style.background = v ? '#f5f5f5' : '#111'; await new Promise((r) => setTimeout(r, 50)); }
});

replan(); seal();
// Módulos opcionales: del propio catálogo de portadores.
const MODS = ['MESHTASTIC', 'IRIDIUM_SBD', 'SAT_D2C_SMS', 'QO100', 'APRS', 'DRONE_MULE'];
$('#modt tbody').innerHTML = MODS.map((id) => { const b = BEARERS[id]; return `<tr><td><b>${b.label}</b></td><td>${b.family === 'SATELLITE' ? 'Alcance global' : b.family === 'LORA' ? 'Kilómetros sin infraestructura' : b.family === 'AERIAL' ? 'Lleva mensajes entre zonas aisladas' : 'Alcance regional o global'} · ${b.mtu >= 1024 ? 'mensajes grandes' : `${b.mtu} B por mensaje`}</td><td>${b.hardware}</td><td>${b.encryptionAllowed ? '' : 'Sin cifrado: solo estados públicos firmados. '}${b.note ?? ''}</td></tr>`; }).join('') +
  '<tr><td><b>Accesorio ESP32 (CSI / barrido)</b></td><td>Respiración y presencia por Wi-Fi; censo Bluetooth por planta</td><td>Placa ESP32 (ver <span class="mono">hardware/esp32-survey</span>)</td><td>Falta calibración de campo</td></tr>';
