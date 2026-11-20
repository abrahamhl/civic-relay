// SENDA · «Tu hermano no tiene datos, alguien a su lado sí». Ejecuta en el navegador el código real del núcleo:
// sobre E2E (envelope.mjs) + sobre exterior, buzón cegado, sello de trabajo, recibo de custodia y reparto k-de-n
// (stranger-gateway.mjs). Las personas, posiciones y el buzón en memoria son una SIMULACIÓN de la escena.
import * as G from '/senda/core/stranger-gateway.mjs';
import { generateIdentity, sealMessage, packEnvelope, unpackEnvelope, openMessage } from '/senda/core/envelope.mjs';

const $ = (s) => document.querySelector(s);
const cv = $('#dz-cv'); if (!cv) throw new Error('sin sección');
const ctx = cv.getContext('2d'), out = $('#dz-out');
const sleep = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));
const POLICY = { consent: true, acceptSOS: true, acceptPersonal: true, maxKBPerHour: 256, minBatteryPct: 20, maxBlobBytes: 4096, baseBits: 10, sosBits: 4, bytesPerExtraBit: 512 };
const subtle = crypto.subtle;
const ecdh = async () => { const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { privateKey: kp.privateKey, publicJwk: await subtle.exportKey('jwk', kp.publicKey) }; };

const BRO = { x: 250, y: 300, label: 'Tu hermano · sin datos' };
const NEI = [
  { x: 120, y: 140, label: 'Vecina · 4G', uplink: 'CELL', q: 10, bat: 71, consent: true },
  { x: 430, y: 170, label: 'Bar · Wi-Fi', uplink: 'WIFI', q: 13, bat: 100, consent: true },
  { x: 110, y: 450, label: 'Sin permiso', uplink: 'CELL', q: 8, bat: 64, consent: false },
  { x: 420, y: 460, label: 'Batería 12 %', uplink: 'CELL', q: 9, bat: 12, consent: true },
];
const BOX = { x: 680, y: 120, label: 'Buzón (Internet)' }, ME = { x: 800, y: 380, label: 'Tú · Arnhem' };
let st = { phase: 'idle', flights: [], ticks: {}, rings: true, done: false };

function draw(now) {
  ctx.fillStyle = '#0a0c0f'; ctx.fillRect(0, 0, 900, 520);
  ctx.font = '500 16px Inter, sans-serif'; ctx.textAlign = 'center';
  // anillos de baliza de las pasarelas activas
  for (const n of NEI) {
    const active = n.consent && n.bat >= POLICY.minBatteryPct;
    if (active && st.rings) for (const k of [0, 0.5]) { const p = ((now / 1600) + k) % 1; ctx.strokeStyle = `rgba(63,178,127,${0.55 * (1 - p)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, 20 + p * 70, 0, 7); ctx.stroke(); }
    ctx.fillStyle = active ? '#3fb27f' : '#3a4048'; ctx.beginPath(); ctx.roundRect(n.x - 14, n.y - 22, 28, 44, 6); ctx.fill();
    ctx.fillStyle = active ? '#e8eaed' : '#8f97a1'; ctx.fillText(n.label, n.x, n.y + 42);
    if (st.ticks[n.label]) { ctx.fillStyle = '#3fb27f'; ctx.fillText(`✓ ${st.ticks[n.label]}`, n.x, n.y - 32); }
  }
  ctx.fillStyle = '#4f8cff'; ctx.beginPath(); ctx.roundRect(BRO.x - 16, BRO.y - 26, 32, 52, 7); ctx.fill();
  ctx.fillStyle = '#e8eaed'; ctx.fillText(BRO.label, BRO.x, BRO.y + 48);
  // buzón y destinatario
  ctx.strokeStyle = '#30363e'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(560, 20); ctx.lineTo(560, 500); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#8f97a1'; ctx.font = '500 14px Inter, sans-serif'; ctx.fillText('San Martín · radio corta', 280, 30); ctx.fillText('Internet', 730, 30); ctx.font = '500 16px Inter, sans-serif';
  ctx.fillStyle = '#181c21'; ctx.strokeStyle = '#4a525d'; ctx.beginPath(); ctx.roundRect(BOX.x - 70, BOX.y - 30, 140, 60, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8eaed'; ctx.fillText(BOX.label, BOX.x, BOX.y + 6);
  ctx.fillStyle = st.done ? '#3fb27f' : '#4f8cff'; ctx.beginPath(); ctx.roundRect(ME.x - 16, ME.y - 26, 32, 52, 7); ctx.fill();
  ctx.fillStyle = '#e8eaed'; ctx.fillText(ME.label + (st.done ? ' ✓✓' : ''), ME.x, ME.y + 48);
  // trozos en vuelo
  st.flights = st.flights.filter((f) => now - f.t0 < f.dur + 400);
  for (const f of st.flights) {
    const u = Math.min(1, (now - f.t0) / f.dur), x = f.a.x + (f.b.x - f.a.x) * u, y = f.a.y + (f.b.y - f.a.y) * u;
    ctx.fillStyle = f.color; ctx.fillRect(x - 7, y - 7, 14, 14); ctx.fillStyle = '#0a0c0f'; ctx.font = '600 11px Inter'; ctx.fillText(f.tag, x, y + 4); ctx.font = '500 16px Inter, sans-serif';
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
const fly = (a, b, tag, color = '#f0a73a', dur = 900) => { st.flights.push({ a, b, tag, color, t0: performance.now(), dur }); return sleep(dur); };
const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const row = (k, v) => `<div class="row"><span>${k}</span><b>${v}</b></div>`;
const hex = (u8, n = 48) => [...u8.subarray(0, n)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
let lines = [];
const log = (k, v) => { lines.push(row(k, v)); out.innerHTML = lines.join(''); };

async function run() {
  $('#dz-go').disabled = true; lines = []; st = { phase: 'run', flights: [], ticks: {}, rings: true, done: false };
  const now = Date.now(), day = G.dayIndexOf(now);
  const yo = await generateIdentity(), hermano = await generateIdentity(), pa = await ecdh(), pb = await ecdh();
  const sH = await G.deriveMailboxSecret(pb.privateKey, pb.publicJwk, pa.publicJwk), sYo = await G.deriveMailboxSecret(pa.privateKey, pa.publicJwk, pb.publicJwk);
  const texto = 'Estamos bien. Sin cobertura en el pueblo. Mañana subo a la carretera.';
  const env = packEnvelope(await sealMessage({ sender: hermano, recipient: yo.publicIdentity, body: texto, priority: 5, ttlS: 86400, now }));
  const mbox = await G.mailboxId(sH, yo.publicIdentity.fingerprint, day);
  const blob = await G.sealOuter(sH, mbox, env), pieces = G.splitForGateways(blob, 2, 4);
  log('🕓 En el móvil de tu hermano', `sobre E2E ${env.length} B → sobre exterior ${blob.length} B → 4 trozos (bastan 2)`);
  log('Buzón de hoy', `${mbox.slice(0, 16)}… (cambia cada día; solo vosotros sabéis calcularlo)`);
  $('#dz-hex').textContent = hex(pieces[0]) + '\n\nNi el texto, ni quién lo envía, ni a quién va: bytes aleatorios.';

  const server = new Map(), upload = async (m, b) => { server.set(m, [...(server.get(m) ?? []), b]); return true; };
  const gws = [];
  for (const n of NEI) gws.push(await G.createStrangerGateway({ policy: G.createGatewayPolicy(n.consent ? POLICY : { consent: false }), uplinkKind: n.uplink, quality: n.q, slotSeconds: 900, uplink: upload }));
  const heard = [];
  for (let i = 0; i < NEI.length; i++) { const b = await gws[i].beacon(now, NEI[i].bat); if (b) heard.push({ i, b: G.decodeBeacon(b), bytes: b.length }); }
  log('Balizas oídas', `${heard.length} de 4 (${heard.map((h) => `${h.b.uplink}, ${h.bytes} B`).join(' · ')}); la que no dio permiso y la de batería baja no se anuncian`);
  await sleep(500);
  let pi = 0;
  for (const h of heard) {
    for (let r = 0; r < 2; r++, pi++) {
      const piece = pieces[pi], bits = G.stampBits(POLICY, { bytes: piece.length, sos: false }), t0 = performance.now();
      const req = G.prepareHandoff({ mbox, blob: piece, sos: false, beacon: h.b, policyBits: bits }), ms = performance.now() - t0;
      await fly(BRO, NEI[h.i], `${pi + 1}`);
      const res = await gws[h.i].offer(req, now, NEI[h.i].bat), ok = res.accepted && await G.verifyCustodyReceipt(res.receipt, piece);
      st.ticks[NEI[h.i].label] = `${(st.ticks[NEI[h.i].label] ? st.ticks[NEI[h.i].label] + ',' : '')}${pi + 1}`;
      log(`✓ Trozo ${pi + 1} → ${NEI[h.i].label}`, `sello de ${bits} bits (${req.tries} intentos, ${ms.toFixed(0)} ms) · recibo de custodia firmado ${ok ? 'válido' : 'NO válido'}`);
      fly(NEI[h.i], BOX, `${pi + 1}`, '#3fb27f', 1100);
    }
  }
  await sleep(1300);
  const fetch = G.planFetch([await G.mailboxId(sYo, yo.publicIdentity.fingerprint, day)], { decoys: 7 });
  const got = fetch.request.flatMap((m) => server.get(m) ?? []);
  log('Tú recoges', `pides 8 buzones (7 señuelos): quien te sirve acierta cuál es el tuyo con probabilidad ${fetch.pGatewayGuessesReal.toLocaleString('es-ES', { maximumFractionDigits: 3 })} (1 entre 8)`);
  await fly(BOX, ME, '2+', '#4f8cff', 1000);
  const joined = G.joinFromGateways([got[3], got[1]]);
  const opened = await G.openOuter(sYo, fetch.request.find((m) => server.has(m)), joined);
  const msg = await openMessage({ recipient: yo, envelope: unpackEnvelope(opened), now });
  st.done = true;
  log('✓✓ Abierto en Arnhem', `«${esc(msg.body)}» · firma del remitente verificada`);
  $('#dz-go').disabled = false;
}
$('#dz-go').addEventListener('click', () => run().catch((e) => { log('Error', e.message); $('#dz-go').disabled = false; }));
$('#dz-reset').addEventListener('click', () => { st = { phase: 'idle', flights: [], ticks: {}, rings: true, done: false }; lines = []; out.innerHTML = '<p class="note" style="margin:0">Cuatro vecinos: dos prestan su conexión (4G y el Wi-Fi del bar), uno no ha dado permiso y otro tiene poca batería.</p>'; $('#dz-hex').textContent = '—'; });

// Matemática del pueblo: Poisson espacial + Monte Carlo del núcleo.
let tm;
function math() {
  const d = +$('#dz-d').value, r = +$('#dz-r').value; $('#dz-dv').textContent = d.toLocaleString('es-ES'); $('#dz-rv').textContent = r;
  clearTimeout(tm); tm = setTimeout(() => {
    const sc = { ...G.EXAMPLE_VILLAGE, densityPerKm2: d, rangeM: r }, s = G.simulateStrangerRelay(sc, { runs: 1500 }), a = s.availability;
    const t = (x) => (!Number.isFinite(x) ? 'más de 6 h' : x < 120 ? `${Math.round(x)} s` : x < 7200 ? `${Math.round(x / 60)} min` : `${(x / 3600).toFixed(1).replace('.', ',')} h`);
    $('#dz-math').innerHTML = row('Alguien ya al alcance', `${(a.pAtLeastOneNow * 100).toFixed(1).replace('.', ',')} %`) + row('Nuevas pasarelas por hora andando', a.newGatewaysPerHour.toFixed(1).replace('.', ',')) + row('Mensaje fuera (mediana · 9 de cada 10)', `${t(s.p50S)} · ${t(s.p90S)}`) + row('Sale antes de 6 h', `${(s.pWithinHorizon * 100).toFixed(1).replace('.', ',')} %`);
  }, 120);
}
$('#dz-d').addEventListener('input', math); $('#dz-r').addEventListener('input', math); math();
window.__dz = { get done() { return st.done; } };
