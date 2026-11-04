/**
 * SENDA · Demostraciones en vivo (portada y vídeos).
 * Cada demo es una función del estado y del tiempo, render(t): la web la anima con el reloj y el
 * vídeo la avanza fotograma a fotograma. Todas calculan con el núcleo probado (/senda/core):
 * nada de lo que se ve es una animación inventada al margen del cálculo.
 */
import { planMultiBearer } from '../core/bearers.mjs';
import { generateIdentity, sealMessage, openMessage, relayView } from '../core/envelope.mjs';
import { b64, unb64 } from '../core/b64.mjs';
import { cellsFromBuilding, fuseOccupancy } from '../core/occupancy.mjs';
import { demoTower } from '../core/rescue-scenario.mjs';
import { probabilityColor } from '../core/vision-layers.mjs';
import { syntheticLandscape, arrivalTimes, assessAssets } from '../core/wildfire.mjs';
import { syntheticTrackCircuit, syntheticPassengerTrips } from '../core/rail-watch-scenario.mjs';
import { trackCircuitWatch, trackGeometryCrowd } from '../core/rail-watch.mjs';
import { propagateKeplerJ2, gmst, lookAngles } from '../core/orbital.mjs';

export const C = { bg: '#05090c', panel: '#0b141c', line: '#203240', text: '#f2f4f4', muted: '#9fb2bc', coral: '#ff7756', ice: '#91d7e8', green: '#34d399', amber: '#fbbf24', red: '#ff5b6e', violet: '#e879f9', cyan: '#22d3ee' };

const I18N = {
  es: { msg: 'SOS + posición + ≈6 s de voz Codec2', of: 'de', one: 'fuente', noCov: 'SIN COBERTURA', room: 'Sala 112 · familia', rebuilt: 'MENSAJE RECONSTRUIDO', waiting: 'esperando fragmentos', exact: 'cálculo exacto', single: 'mejor canal solo', shards: 'fragmentos', newSend: 'Nuevo envío', none: 'Activa al menos un canal',
    B: { CELL_DATA: 'Datos móviles', PHONE_MESH: 'Vecinos (Bluetooth · sonido)', SMS: 'SMS', SAT_D2C_SMS: 'Satélite directo al móvil', MESHTASTIC: 'LoRa', IRIDIUM_SBD: 'Iridium', DRONE_MULE: 'Dron mula' },
    sender: 'Emisor', mule: 'Mula / relé', receiver: 'Destinatario', cantRead: 'transporta, no puede leer', verified: 'firma verificada · descifrado', rejected: 'RECHAZADO: manipulación detectada', sealing: 'cifrando…', send: 'Cifrar y enviar', tamper: 'Manipular 1 byte en la mula', msgLabel: 'Mensaje',
    ev: { resp: 'Respuesta «atrapado» (3B)', phone: 'Teléfono sin respuesta (4D)', baro: 'Barómetro en ese teléfono', csi: 'Respiración por Wi-Fi CSI (planta 3)', knock: 'Golpes oídos (4D)', dog: 'Perro sin marcaje (2D)' },
    floor: 'P', top: 'Dónde buscar primero', rule: '«≥98 %» solo con 2 familias de evidencia', sources: 'fuentes',
    wind: 'Viento (km/h)', dir: 'Hacia (°)', tapFire: 'Toca el mapa para cambiar el foco', arrives: 'fuego', deadline: 'avisar antes de', antenna: 'antena cae', outOfReach: 'fuera de alcance', alert: 'ALERTA', noAntenna: 'sin antena', viaOffline: 'por canales sin red', viaMobile: 'por red móvil',
    stepV: 'Escalón de tensión (V)', threshold: 'umbral de ocupación', detected: 'SENDA: escalón → inspeccionar vía', hoursBefore: 'h antes', thrNone: 'umbral absoluto: sin alarma', thrToo: 'también salta el umbral', crowd: 'Geometría de vía con móviles de viajeros', impact: 'impacto repetido', degr: 'degradación',
    speed: 'Velocidad del tiempo', visible: 'satélites visibles sobre 15° desde El Tiemblo', next: 'próximo contacto en', iridium: 'Constelación tipo Iridium: 66 satélites, 6 planos, 86,4°, ~780 km (posiciones ilustrativas)', center: 'Centrar en España' },
  en: { msg: 'SOS + position + ≈6 s of Codec2 voice', of: 'of', one: 'source', noCov: 'NO COVERAGE', room: '112 room · family', rebuilt: 'MESSAGE REBUILT', waiting: 'waiting for shards', exact: 'exact calculation', single: 'best single channel', shards: 'shards', newSend: 'New send', none: 'Enable at least one channel',
    B: { CELL_DATA: 'Mobile data', PHONE_MESH: 'Neighbours (Bluetooth · sound)', SMS: 'SMS', SAT_D2C_SMS: 'Satellite direct-to-phone', MESHTASTIC: 'LoRa', IRIDIUM_SBD: 'Iridium', DRONE_MULE: 'Drone mule' },
    sender: 'Sender', mule: 'Mule / relay', receiver: 'Recipient', cantRead: 'carries it, cannot read it', verified: 'signature verified · decrypted', rejected: 'REJECTED: tampering detected', sealing: 'encrypting…', send: 'Encrypt and send', tamper: 'Tamper 1 byte at the mule', msgLabel: 'Message',
    ev: { resp: '“Trapped” reply (3B)', phone: 'Silent phone (4D)', baro: 'Barometer on that phone', csi: 'Breathing via Wi-Fi CSI (floor 3)', knock: 'Knocks heard (4D)', dog: 'Dog search, no alert (2D)' },
    floor: 'F', top: 'Search here first', rule: '“≥98 %” only with 2 evidence families', sources: 'sources',
    wind: 'Wind (km/h)', dir: 'Towards (°)', tapFire: 'Tap the map to move the ignition', arrives: 'fire', deadline: 'warn before', antenna: 'mast lost', outOfReach: 'out of reach', alert: 'ALERT', noAntenna: 'no mast', viaOffline: 'via no-network channels', viaMobile: 'via mobile network',
    stepV: 'Voltage step (V)', threshold: 'occupancy threshold', detected: 'SENDA: step → inspect track', hoursBefore: 'h earlier', thrNone: 'absolute threshold: no alarm', thrToo: 'threshold also fires', crowd: 'Track geometry from passengers’ phones', impact: 'repeated impact', degr: 'degradation',
    speed: 'Time speed', visible: 'satellites above 15° over El Tiemblo', next: 'next contact in', iridium: 'Iridium-like constellation: 66 satellites, 6 planes, 86.4°, ~780 km (illustrative positions)', center: 'Centre on Spain' },
  nl: { msg: 'SOS + positie + ≈6 s Codec2-spraak', of: 'van', one: 'bron', noCov: 'GEEN DEKKING', room: '112-meldkamer · familie', rebuilt: 'BERICHT HERSTELD', waiting: 'wacht op fragmenten', exact: 'exacte berekening', single: 'beste enkel kanaal', shards: 'fragmenten', newSend: 'Opnieuw sturen', none: 'Zet minstens één kanaal aan',
    B: { CELL_DATA: 'Mobiele data', PHONE_MESH: 'Buren (Bluetooth · geluid)', SMS: 'SMS', SAT_D2C_SMS: 'Satelliet naar telefoon', MESHTASTIC: 'LoRa', IRIDIUM_SBD: 'Iridium', DRONE_MULE: 'Drone-koerier' },
    sender: 'Afzender', mule: 'Koerier / relais', receiver: 'Ontvanger', cantRead: 'vervoert, kan niet lezen', verified: 'handtekening geverifieerd · ontsleuteld', rejected: 'GEWEIGERD: manipulatie gedetecteerd', sealing: 'versleutelen…', send: 'Versleutel en verstuur', tamper: 'Wijzig 1 byte bij de koerier', msgLabel: 'Bericht',
    ev: { resp: 'Antwoord “ingesloten” (3B)', phone: 'Stille telefoon (4D)', baro: 'Barometer in die telefoon', csi: 'Ademhaling via wifi-CSI (verdieping 3)', knock: 'Kloppen gehoord (4D)', dog: 'Hond zonder melding (2D)' },
    floor: 'V', top: 'Hier eerst zoeken', rule: '“≥98 %” alleen met 2 bewijsfamilies', sources: 'bronnen',
    wind: 'Wind (km/u)', dir: 'Richting (°)', tapFire: 'Tik op de kaart om de brandhaard te verplaatsen', arrives: 'vuur', deadline: 'waarschuw vóór', antenna: 'mast valt uit', outOfReach: 'buiten bereik', alert: 'ALARM', noAntenna: 'geen mast', viaOffline: 'via kanalen zonder netwerk', viaMobile: 'via mobiel netwerk',
    stepV: 'Spanningssprong (V)', threshold: 'bezettingsdrempel', detected: 'SENDA: sprong → spoor inspecteren', hoursBefore: 'u eerder', thrNone: 'absolute drempel: geen alarm', thrToo: 'drempel gaat ook af', crowd: 'Spoorgeometrie via telefoons van reizigers', impact: 'herhaalde klap', degr: 'verslechtering',
    speed: 'Tijdsnelheid', visible: 'satellieten boven 15° vanaf El Tiemblo', next: 'volgend contact over', iridium: 'Iridium-achtige constellatie: 66 satellieten, 6 vlakken, 86,4°, ~780 km (illustratief)', center: 'Centreer op Spanje' },
};

/* ---------------------------------------------------------------- utilidades */
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
export function hash(a, b) { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }
const nf = (lang, x, d = 0) => (Number.isFinite(x) ? x.toLocaleString(lang === 'en' ? 'en-GB' : lang, { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');
const pct = (lang, p, d = 1) => `${nf(lang, p * 100, d)} %`;
const hm = (min) => (Number.isFinite(min) ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}` : '—');

function txt(g, s, x, y, { size = 14, color = C.text, weight = 600, align = 'left', base = 'alphabetic', mono = false, alpha = 1 } = {}) {
  g.globalAlpha = alpha; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  g.font = `${weight} ${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Inter, system-ui, sans-serif'}`;
  g.fillText(s, x, y); g.globalAlpha = 1;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function glow(g, x, y, r, color, a = 0.9) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, color + '00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); }
function wrap(g, s, maxW) { const words = String(s).split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); } e.append(...kids); return e; }
function chip(label, checked, onchange) { const i = el('input', { type: 'checkbox', checked, on: { change: () => onchange(i.checked) } }); return el('label', { className: 'sd-chip' }, i, ' ', label); }
function slider(label, min, max, step, value, oninput, fmt = (v) => v) {
  const o = el('output', {}, fmt(value)), i = el('input', { type: 'range', min, max, step, value, on: { input: () => { o.textContent = fmt(+i.value); oninput(+i.value); } } });
  return el('label', { className: 'sd-slider' }, el('span', {}, label), i, o);
}
const button = (label, onclick, cls = '') => el('button', { type: 'button', className: 'sd-btn ' + cls, on: { click: onclick } }, label);

/** Lienzo con DPR; `fixed` = tamaño fijo para vídeo. */
function surface(host, aspect, fixed) {
  const cv = el('canvas', { className: 'sd-canvas', role: 'img' }); host.prepend(cv);
  const g = cv.getContext('2d'); const s = { cv, g, W: 0, H: 0 };
  s.resize = () => {
    const dpr = fixed ? fixed.dpr || 1 : Math.min(2, globalThis.devicePixelRatio || 1);
    const W = fixed ? fixed.w : Math.max(280, host.clientWidth), a = typeof aspect === 'function' ? aspect(W) : aspect, H = fixed ? fixed.h : a === 0 ? Math.max(200, host.clientHeight) : Math.round(W / a);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = fixed ? `${W}px` : '100%'; if (aspect) cv.style.aspectRatio = `${W} / ${H}`; else cv.style.height = '100%';
    g.setTransform(dpr, 0, 0, dpr, 0, 0); s.W = W; s.H = H;
  };
  s.resize(); return s;
}
const bg = (g, W, H) => { g.fillStyle = C.bg; g.fillRect(0, 0, W, H); };

/* ================================================================ 0. héroe: malla de teléfonos */
function heroDemo(host, o) {
  const s = surface(host, 0, o.fixed); const N = 70;
  const nodes = Array.from({ length: N }, (_, i) => ({ x: hash(i, 1), y: hash(i, 2), vx: hash(i, 3) - 0.5, vy: hash(i, 4) - 0.5 }));
  return { surface: s, set() {}, render(t) {
    const { g, W, H } = s; bg(g, W, H);
    const P = nodes.map((n) => ({ x: ((n.x + n.vx * t * 0.01) % 1 + 1) % 1 * W, y: ((n.y + n.vy * t * 0.01) % 1 + 1) % 1 * H }));
    const R = Math.min(W, H) * 0.28;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y); if (d < R) { g.strokeStyle = `rgba(145,215,232,${0.22 * (1 - d / R)})`; g.lineWidth = 1; g.beginPath(); g.moveTo(P[i].x, P[i].y); g.lineTo(P[j].x, P[j].y); g.stroke(); } }
    for (let k = 0; k < 6; k++) { // mensajes que saltan de teléfono en teléfono
      const a = Math.floor(hash(k, Math.floor(t / 2.5 + k * 0.37)) * N), b = Math.floor(hash(k + 9, Math.floor(t / 2.5 + k * 0.37)) * N);
      const f = ((t / 2.5 + k * 0.37) % 1); const x = lerp(P[a].x, P[b].x, f), y = lerp(P[a].y, P[b].y, f);
      glow(g, x, y, 14, k % 2 ? C.coral : C.green, 0.9);
    }
    for (const p of P) { g.fillStyle = C.ice; g.globalAlpha = 0.7; g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 6.3); g.fill(); g.globalAlpha = 1; }
    const tx = W * 0.84, ty = H * 0.3, on = Math.floor(t * 1.2) % 2; // antena caída
    g.strokeStyle = on ? C.red : '#5a2a30'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty + 40); g.lineTo(tx, ty); g.moveTo(tx - 14, ty + 40); g.lineTo(tx, ty); g.lineTo(tx + 14, ty + 40); g.stroke();
    g.beginPath(); g.moveTo(tx - 18, ty - 10); g.lineTo(tx + 18, ty + 26); g.moveTo(tx + 18, ty - 10); g.lineTo(tx - 18, ty + 26); g.stroke();
  } };
}

/* ================================================================ 1. red sin cobertura: k-de-n */
const NET_IDS = ['CELL_DATA', 'PHONE_MESH', 'SMS', 'SAT_D2C_SMS', 'MESHTASTIC', 'IRIDIUM_SBD', 'DRONE_MULE'];
const NET_COL = { CELL_DATA: C.muted, PHONE_MESH: C.green, SMS: '#a3e635', SAT_D2C_SMS: C.ice, MESHTASTIC: C.amber, IRIDIUM_SBD: C.cyan, DRONE_MULE: C.violet };
function netDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, (w) => (w < 640 ? 1.05 : 16 / 9), o.fixed);
  const st = { on: new Set(['SAT_D2C_SMS', 'MESHTASTIC', 'IRIDIUM_SBD']), seed: 3, bytes: 600, plan: null, t0: 0, lastT: 0 };
  const compute = () => { st.plan = st.on.size ? planMultiBearer(st.bytes, [...st.on].map((id) => ({ id })), { target: 0.99 }) : null; st.t0 = st.lastT; s.cv.setAttribute('aria-label', st.plan?.feasible ? `k ${st.plan.k} / n ${st.plan.n} · P ${pct(o.lang, st.plan.pDelivery)}` : L.none); };
  if (!o.fixed) host.append(el('div', { className: 'sd-controls' }, ...NET_IDS.map((id) => chip(L.B[id], st.on.has(id), (v) => { v ? st.on.add(id) : st.on.delete(id); compute(); })), button(L.newSend, () => { st.seed++; st.t0 = st.lastT; })));
  compute();
  return { surface: s, set(p) { if (p.on) st.on = new Set(p.on); if (p.seed != null) st.seed = p.seed; compute(); }, render(t) {
    st.lastT = t; const { g, W, H } = s; bg(g, W, H); const lt = Math.max(0, t - st.t0) % 10;
    const nar = W < 640, sx = nar ? 30 : W * 0.09, rx = nar ? W - 30 : W * 0.91, top = H * (nar ? 0.32 : 0.2), bot = H * 0.8;
    // emisor y receptor
    glow(g, sx, H / 2, 46, C.coral, 0.35); rr(g, sx - 16, H / 2 - 28, 32, 56, 7); g.fillStyle = C.panel; g.fill(); g.strokeStyle = C.coral; g.lineWidth = 2; g.stroke();
    txt(g, L.noCov, nar ? 8 : sx, H / 2 + 50, { size: nar ? 10 : 11, color: C.red, align: nar ? 'left' : 'center', weight: 800 });
    const plan = st.plan;
    if (!plan || !plan.messages) { txt(g, L.none, W / 2, H / 2, { size: 18, align: 'center', color: C.amber }); return; }
    const ids = [...new Set(plan.messages.map((m) => m.id))];
    let got = 0; const k = plan.k;
    ids.forEach((id, li) => {
      const y = ids.length === 1 ? H / 2 : lerp(top, bot, li / (ids.length - 1)), col = NET_COL[id];
      g.strokeStyle = col + '55'; g.lineWidth = 1.5; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(sx + 24, H / 2); g.bezierCurveTo(W * 0.3, y, W * 0.7, y, rx - 24, H / 2); g.stroke(); g.setLineDash([]);
      txt(g, `${L.B[id]} · p ${nf(o.lang, plan.messages.find((m) => m.id === id).p, 2)}`, W * 0.5, y - 9, { size: 12, color: col, align: 'center' });
      plan.messages.filter((m) => m.id === id).forEach((m, j) => {
        const ok = hash(st.seed * 97 + li, j) < m.p, start = 0.3 + j * 0.45 + li * 0.12, dur = 1.4 + 2.6 * Math.log10(1 + m.latencyS) / 3;
        for (let q = 0; q < m.shards; q++) {
          const k0 = clamp((lt - start - q * 0.12) / dur, 0, 1); if (k0 <= 0) continue;
          const e = ease(k0), u = 1 - e, bx = u * u * u * (sx + 24) + 3 * u * u * e * W * 0.3 + 3 * u * e * e * W * 0.7 + e * e * e * (rx - 24);
          const by = u * u * u * (H / 2) + 3 * u * u * e * y + 3 * u * e * e * y + e * e * e * (H / 2);
          if (!ok && k0 > 0.55) { const f = clamp((k0 - 0.55) * 4, 0, 1); txt(g, '×', bx, by + f * 20, { size: 16, color: C.red, align: 'center', alpha: 1 - f }); continue; }
          if (k0 >= 1) { got++; continue; }
          glow(g, bx, by, 12, col, 0.8); g.fillStyle = col; g.fillRect(bx - 3, by - 3, 6, 6);
        }
      });
    });
    const done = got >= k, rcol = done ? C.green : C.ice;
    glow(g, rx, H / 2, done ? 70 : 40, rcol, done ? 0.5 : 0.25); rr(g, rx - 22, H / 2 - 22, 44, 44, 10); g.fillStyle = C.panel; g.fill(); g.strokeStyle = rcol; g.lineWidth = 2; g.stroke();
    const ra = nar ? 'right' : 'center', rxl = nar ? W - 8 : rx;
    txt(g, L.room, rxl, H / 2 + 44, { size: nar ? 10 : 11, color: C.muted, align: ra });
    for (let i = 0; i < k; i++) { g.fillStyle = i < got ? C.green : C.line; g.fillRect(rx - 22 + (i * 44) / k + 1, H / 2 + 26 - 0, 44 / k - 2, 5); }
    txt(g, done ? L.rebuilt : `${Math.min(got, k)}/${k} · ${L.waiting}`, rxl, H / 2 + 62, { size: nar ? 10 : 12, color: done ? C.green : C.muted, align: ra, weight: 800 });
    const hs = nar ? 11 : Math.max(12, W / 70);
    txt(g, `${L.msg} · ${st.bytes} B`, W / 2, 24, { size: hs - 1, align: 'center', color: C.muted });
    const l1 = `k = ${k} ${L.of} n = ${plan.n} ${L.shards}   ·   P = ${pct(o.lang, plan.pDelivery, 2)} (${L.exact})`, l2 = `${L.single}: ${pct(o.lang, plan.bestSingleBearer.p, 0)}   ·   ${nf(o.lang, plan.costEUR, 0)} €`;
    if (W >= 760) txt(g, `${l1}   ·   ${l2}`, W / 2, 24 + hs + 8, { size: hs, align: 'center', weight: 800, color: plan.feasible ? C.text : C.amber });
    else { txt(g, l1, W / 2, 24 + hs + 8, { size: hs, align: 'center', weight: 800, color: plan.feasible ? C.text : C.amber }); txt(g, l2, W / 2, 24 + 2 * hs + 14, { size: hs - 1, align: 'center', color: C.muted }); }
  } };
}

/* ================================================================ 2. cifrado real extremo a extremo */
function cryptoDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, (w) => (w < 640 ? 1.1 : 2), o.fixed);
  const st = { text: o.lang === 'en' ? 'Trapped in 3B, two people, I can hear the rescuers' : o.lang === 'nl' ? 'Ingesloten in 3B, twee personen, ik hoor de redders' : 'Atrapados en 3B, somos dos, oigo a los bomberos', env: null, view: null, opened: null, error: null, busy: true, ids: null, t0: 0, lastT: 0 };
  const seal = async (tamper = false) => {
    st.busy = true; st.error = null; st.opened = null;
    st.ids ??= { a: await generateIdentity(), b: await generateIdentity() };
    if (!tamper || !st.env) st.env = await sealMessage({ sender: st.ids.a, recipient: st.ids.b.publicIdentity, body: st.text, priority: 0, ttlS: 86400, now: Date.now(), kind: 'SOS' });
    let env = st.env;
    if (tamper) { const ct = unb64(env.ct); ct[Math.floor(ct.length / 2)] ^= 0x01; env = { ...env, ct: b64(ct) }; }
    st.view = relayView(env, Date.now());
    try { st.opened = (await openMessage({ recipient: st.ids.b, envelope: env, now: Date.now() })).body; } catch (e) { st.error = String(e.message || e.name || e); }
    st.busy = false; st.t0 = st.lastT; st.tampered = tamper;
    s.cv.setAttribute('aria-label', st.error ? L.rejected : `${L.verified}: ${st.opened}`);
  };
  if (!o.fixed) {
    const inp = el('input', { type: 'text', value: st.text, maxLength: 120, className: 'sd-input', 'aria-label': L.msgLabel });
    host.append(el('div', { className: 'sd-controls' }, inp, button(L.send, () => { st.text = inp.value || st.text; st.env = null; seal(false); }, 'is-primary'), button(L.tamper, () => seal(true), 'is-danger')));
  }
  seal(false);
  return { surface: s, ready: () => !st.busy, set(p) { if (p.text) { st.text = p.text; st.env = null; } return seal(!!p.tamper); }, render(t) {
    st.lastT = t; const { g, W, H } = s; bg(g, W, H); const lt = Math.max(0, t - st.t0);
    const cols = [W * 0.17, W * 0.5, W * 0.83], cw = W * 0.29, y0 = H * 0.16, ch = H * 0.62;
    const titles = [L.sender, L.mule, L.receiver], colors = [C.coral, C.amber, st.error ? C.red : C.green];
    cols.forEach((x, i) => { rr(g, x - cw / 2, y0, cw, ch, 14); g.fillStyle = C.panel; g.fill(); g.strokeStyle = colors[i] + '88'; g.lineWidth = 1.5; g.stroke(); txt(g, titles[i], x, y0 - 10, { size: 13, color: colors[i], align: 'center', weight: 800 }); });
    const fs = Math.max(11, W / 75);
    g.font = `600 ${fs + 2}px Inter`; wrap(g, `«${st.text}»`, cw - 28).slice(0, 6).forEach((l, i) => txt(g, l, cols[0] - cw / 2 + 14, y0 + 30 + i * (fs + 7), { size: fs + 2 }));
    if (st.env) {
      const ct = unb64(st.env.ct), rows = Math.floor((ch - 70) / (fs + 4));
      const per = clamp(Math.floor((cw - 16) / (fs * 1.85)), 4, 12); for (let r = 0; r < rows; r++) { let line = ''; for (let c = 0; c < per; c++) line += ct[(r * per + c + Math.floor(lt * 18)) % ct.length].toString(16).padStart(2, '0') + ' '; txt(g, line, cols[1], y0 + 26 + r * (fs + 4), { size: fs - 1, mono: true, color: C.amber, align: 'center', alpha: 0.35 + 0.65 * ((r + Math.floor(lt * 6)) % rows === 0 ? 1 : 0.5) }); }
      const v = st.view; txt(g, `${L.cantRead}`, cols[1], y0 + ch - 34, { size: fs, align: 'center', color: C.text, weight: 700 });
      txt(g, `id ${v.id.slice(0, 8)}… · ${v.kind} · ${v.sizeBytes} B`, cols[1], y0 + ch - 14, { size: fs - 1, align: 'center', color: C.muted, mono: true });
    }
    const k = clamp(lt / 2.2, 0, 1), px = k < 0.5 ? lerp(cols[0] + cw / 2, cols[1] - cw / 2, k * 2) : lerp(cols[1] + cw / 2, cols[2] - cw / 2, (k - 0.5) * 2);
    if (k < 1) { glow(g, px, y0 + ch / 2, 20, C.amber, 0.9); txt(g, '🔒', px, y0 + ch / 2 + 6, { size: 16, align: 'center' }); }
    if (st.busy) txt(g, L.sealing, cols[2], y0 + ch / 2, { size: fs + 2, align: 'center', color: C.muted });
    else if (k >= 1) {
      if (st.error) { glow(g, cols[2], y0 + ch / 2, cw * 0.5, C.red, 0.25); g.font = `800 ${fs + 3}px Inter`; wrap(g, L.rejected, cw - 28).forEach((l, i) => txt(g, l, cols[2], y0 + ch / 2 - 10 + i * (fs + 8), { size: fs + 3, align: 'center', color: C.red, weight: 800 })); }
      else { g.font = `600 ${fs + 2}px Inter`; wrap(g, `«${st.opened}»`, cw - 28).slice(0, 5).forEach((l, i) => txt(g, l, cols[2] - cw / 2 + 14, y0 + 30 + i * (fs + 7), { size: fs + 2 })); txt(g, `✓ ${L.verified}`, cols[2], y0 + ch - 16, { size: fs, align: 'center', color: C.green, weight: 800 }); }
    }
    txt(g, 'ECDH P-256 · AES-256-GCM · ECDSA P-256 · WebCrypto', W / 2, H - 14, { size: fs, align: 'center', color: C.muted, mono: true });
  } };
}

/* ================================================================ 3. ver lo que no se ve: fusión */
function fusionDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, (w) => (w < 640 ? 0.62 : 1.6), o.fixed);
  const building = demoTower({ levels: 6 }), cells = cellsFromBuilding(building), C_ = (id) => cells.find((c) => c.id === id).center;
  const st = { ev: { resp: true, phone: true, baro: false, csi: true, knock: false, dog: false }, fusion: null };
  const compute = () => {
    const e = st.ev, persons = [
      { id: 'r1', homeCell: '3B', ...(e.resp ? { status: 'TRAPPED', reportedCell: '3B' } : {}) }, { id: 'r2', homeCell: '3B' },
      { id: 'r3', homeCell: '4D', ...(e.phone ? { phoneFix: { ...C_('4D'), errorM: 3, ...(e.baro ? { baroZ: C_('4D').z } : {}) } } : {}) },
      { id: 'r4', homeCell: '1A', status: 'SAFE' }, { id: 'r5', homeCell: '2C', status: 'AWAY' }, { id: 'r6', homeCell: '5B' }, { id: 'r7', homeCell: '2D' }];
    const cellEvidence = [];
    if (e.csi) cellEvidence.push({ family: 'BODY_RF', at: { ...C_('3B'), y: (C_('3B').y + C_('3D').y) / 2, x: C_('3B').x + 2 }, radiusM: 7, detected: true });
    if (e.knock) cellEvidence.push({ family: 'ACOUSTIC', at: C_('4D'), radiusM: 5, detected: true });
    if (e.dog) cellEvidence.push({ family: 'SEARCH', at: C_('2D'), radiusM: 5, detected: false });
    const cellRisk = Object.fromEntries(cells.map((c) => [c.id, c.floor >= 2 && c.floor <= 4 ? 1 : 0.4]));
    st.fusion = fuseOccupancy({ cells, persons, cellEvidence, cellRisk });
    const t = st.fusion.ranked[0]; s.cv.setAttribute('aria-label', `${t.id}: ${pct(o.lang, t.p)} [${pct(o.lang, t.lo, 0)}–${pct(o.lang, t.hi, 0)}]`);
  };
  if (!o.fixed) host.append(el('div', { className: 'sd-controls' }, ...Object.keys(st.ev).map((k) => chip(L.ev[k], st.ev[k], (v) => { st.ev[k] = v; compute(); }))));
  compute();
  return { surface: s, set(p) { Object.assign(st.ev, p); compute(); }, render(t) {
    const { g, W, H } = s; bg(g, W, H); const f = st.fusion;
    const narrow = W < H * 1.2, bx = W * 0.06, bw = narrow ? W * 0.82 : W * 0.5, by = H * (narrow ? 0.05 : 0.1), bh = H * (narrow ? 0.56 : 0.8), cw = bw / 4, chh = bh / 6, dx = cw * 0.35, dy = -chh * 0.3;
    // caras superior y lateral para dar volumen
    g.fillStyle = '#0a1a14'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx, by + dy); g.lineTo(bx + bw + dx, by + dy); g.lineTo(bx + bw, by); g.fill();
    g.fillStyle = '#07130f'; g.beginPath(); g.moveTo(bx + bw, by); g.lineTo(bx + bw + dx, by + dy); g.lineTo(bx + bw + dx, by + bh + dy); g.lineTo(bx + bw, by + bh); g.fill();
    const scan = by + ((Math.sin(t * 1.1) + 1) / 2) * bh, units = ['A', 'B', 'C', 'D'];
    for (const c of f.cells) {
      const col = units.indexOf(c.unit), row = 5 - c.floor, x = bx + col * cw, y = by + row * chh, pc = probabilityColor(c.p);
      const near = Math.max(0, 1 - Math.abs(y + chh / 2 - scan) / (chh * 1.2));
      g.fillStyle = `rgba(${pc.r},${pc.g},${pc.b},${0.35 + 0.55 * c.p + 0.1 * near})`; g.fillRect(x + 2, y + 2, cw - 4, chh - 4);
      g.strokeStyle = c.risk >= 1 ? 'rgba(255,91,110,.55)' : 'rgba(0,255,156,.35)'; g.lineWidth = 1; g.strokeRect(x + 2, y + 2, cw - 4, chh - 4);
      if (c.badge98) { g.strokeStyle = C.amber; g.lineWidth = 3; g.strokeRect(x + 3, y + 3, cw - 6, chh - 6); glow(g, x + cw / 2, y + chh / 2, cw * 0.6, C.amber, 0.25 + 0.15 * Math.sin(t * 4)); }
      txt(g, c.id, x + 8, y + 16, { size: 11, color: c.p > 0.55 ? '#3a1a10' : C.muted, weight: 800 });
      txt(g, pct(o.lang, c.p, 0), x + cw / 2, y + chh / 2 + 7, { size: Math.max(12, cw / 4.5), align: 'center', weight: 800, color: c.p > 0.55 ? '#140804' : C.text });
    }
    g.strokeStyle = 'rgba(0,255,156,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 8, scan); g.lineTo(bx + bw + dx + 8, scan); g.stroke(); glow(g, bx + bw / 2, scan, bw * 0.4, '#00ff9c', 0.08);
    const cellXY = (id) => { const c = f.cells.find((q) => q.id === id); return { x: bx + units.indexOf(c.unit) * cw + cw / 2, y: by + (5 - c.floor) * chh + chh / 2 }; };
    if (st.ev.csi) { const p = { x: bx + bw + dx * 0.5, y: cellXY('3B').y }; for (let r = 0; r < 3; r++) { const k = ((t * 0.8 + r / 3) % 1); g.strokeStyle = C.violet; g.globalAlpha = 1 - k; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 8 + k * cw * 1.3, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); g.globalAlpha = 1; } g.fillStyle = C.violet; g.fillRect(p.x - 5, p.y - 5, 10, 10); }
    if (st.ev.phone) { const p = cellXY('4D'); g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath(); g.arc(p.x + cw * 0.3, p.y - chh * 0.2, 6 + 4 * Math.sin(t * 5), 0, 6.3); g.stroke(); }
    if (st.ev.knock) { const p = cellXY('4D'); for (let r = 0; r < 3; r++) { const k = (t * 1.5 + r / 3) % 1; g.strokeStyle = C.amber; g.globalAlpha = 1 - k; g.beginPath(); g.arc(p.x - cw * 0.3, p.y, 4 + k * 22, 0, 6.3); g.stroke(); g.globalAlpha = 1; } }
    if (st.ev.dog) { const p = cellXY('2D'); txt(g, '🐕', p.x + cw * 0.28, p.y + chh * 0.32, { size: 16, align: 'center' }); }
    // panel de prioridades
    const px = narrow ? W * 0.06 : W * 0.62, fs = Math.max(12, W / 62), ly0 = narrow ? H * 0.68 : H * 0.21;
    txt(g, L.top, px, ly0 - H * (narrow ? 0.03 : 0.08), { size: fs + 4, weight: 800, color: C.ice });
    f.ranked.slice(0, narrow ? 4 : 5).forEach((c, i) => {
      const y = ly0 + i * (fs * 3.1), pc = probabilityColor(c.p);
      g.fillStyle = pc.css; g.fillRect(px, y - fs, 8, fs * 2.2);
      txt(g, `${L.floor}${c.floor} ${c.unit}  ${pct(o.lang, c.p)}${c.badge98 ? '  ≥98 %' : ''}`, px + 16, y + 2, { size: fs + 2, weight: 800, color: c.badge98 ? C.amber : C.text });
      txt(g, `[${pct(o.lang, c.lo, 0)} – ${pct(o.lang, c.hi, 0)}] · ${c.families.length} ${c.families.length === 1 ? L.one : L.sources}`, px + 16, y + fs + 6, { size: fs - 1, color: C.muted });
    });
    txt(g, L.rule, px, H * (narrow ? 0.985 : 0.93), { size: fs - 1, color: C.amber, weight: 700 });
  } };
}

/* ================================================================ 4. incendio forestal */
const FUEL_RGB = { 0: [38, 92, 150], 1: [160, 146, 92], 2: [96, 108, 66], 3: [48, 76, 50], 4: [128, 124, 120], 5: [176, 174, 168] };
function fireDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, (w) => (w < 760 ? 1.05 : 3 / 2), o.fixed), Ld = syntheticLandscape(), G = Ld.grid;
  const st = { wind: 30, dir: 15, ign: { x: 30, y: 20 }, T: null, assets: null, clock0: 0, lastT: 0, minPerS: 7 };
  const UP = 4, base = document.createElement('canvas'); base.width = G.w * UP; base.height = G.h * UP; const bgc = base.getContext('2d'), img = bgc.createImageData(base.width, base.height);
  const E = (x, y) => { const x0 = clamp(Math.floor(x), 0, G.w - 1), y0 = clamp(Math.floor(y), 0, G.h - 1), x1 = Math.min(G.w - 1, x0 + 1), y1 = Math.min(G.h - 1, y0 + 1), fx = x - x0, fy = y - y0, e = G.elev;
    return lerp(lerp(e[y0 * G.w + x0], e[y0 * G.w + x1], fx), lerp(e[y1 * G.w + x0], e[y1 * G.w + x1], fx), fy); };
  for (let py = 0; py < base.height; py++) for (let px = 0; px < base.width; px++) {
    const x = px / UP, y = py / UP, i = clamp(Math.floor(y), 0, G.h - 1) * G.w + clamp(Math.floor(x), 0, G.w - 1);
    const sx = (E(x + 0.5, y) - E(x - 0.5, y)) / 100, sy = (E(x, y + 0.5) - E(x, y - 0.5)) / 100, el0 = E(x, y);
    const shade = clamp(0.8 - (sx + sy) * 1.1 + (el0 - 700) / 1200, 0.35, 1.3), c = FUEL_RGB[G.fuel[i]], contour = Math.abs(((el0 + 1000) % 50) - 25) < 0.9 ? 0.82 : 1;
    img.data.set([c[0] * shade * contour, c[1] * shade * contour, c[2] * shade * contour, 255], (py * base.width + px) * 4);
  }
  bgc.putImageData(img, 0, 0);
  const compute = () => { st.T = arrivalTimes(G, [st.ign], { windKmh: st.wind, windToDeg: st.dir }); st.assets = assessAssets(G, st.T, Ld.towns, Ld.towers); st.clock0 = st.lastT; const a = st.assets[0]; s.cv.setAttribute('aria-label', a ? `${a.name}: ${L.arrives} ${hm(a.arrivalMin)}, ${L.antenna} ${hm(a.commsLossMin)}` : ''); };
  if (!o.fixed) {
    host.append(el('div', { className: 'sd-controls' }, slider(L.wind, 0, 60, 5, st.wind, (v) => { st.wind = v; compute(); }), slider(L.dir, 0, 345, 15, st.dir, (v) => { st.dir = v; compute(); }, (v) => `${v}°`), el('span', { className: 'sd-hint' }, L.tapFire)));
    s.cv.addEventListener('pointerdown', (ev) => { const r = s.cv.getBoundingClientRect(), m = mapBox(s.W, s.H); const x = Math.floor(((ev.clientX - r.left) * (s.W / r.width) - m.x) / m.c), y = Math.floor(((ev.clientY - r.top) * (s.H / r.height) - m.y) / m.c); if (x >= 0 && y >= 0 && x < G.w && y < G.h) { st.ign = { x, y }; compute(); } });
  }
  const mapBox = (W, H) => { const c = Math.min(W / G.w, (H * (W < 760 ? 0.8 : 0.78)) / G.h); return { c, x: (W - c * G.w) / 2, y: H * 0.02 }; };
  compute();
  return { surface: s, set(p) { Object.assign(st, p); compute(); }, render(t) {
    st.lastT = t; const { g, W, H } = s; bg(g, W, H); const m = mapBox(W, H), c = m.c;
    const span = 300, now = ((t - st.clock0) * st.minPerS) % (span + 40);
    g.imageSmoothingEnabled = true; g.drawImage(base, m.x, m.y, c * G.w, c * G.h);
    const T = st.T;
    for (let i = 0; i < T.length; i++) {
      const a = T[i]; if (!(a <= now)) continue;
      const x = m.x + (i % G.w) * c, y = m.y + ((i / G.w) | 0) * c, age = now - a;
      if (age > 25) { g.fillStyle = `rgba(20,14,12,${clamp(0.55 + age / 600, 0, 0.82)})`; g.fillRect(x, y, c + 0.5, c + 0.5); }
      else { const fl = hash(i, Math.floor(t * 12)); g.fillStyle = `rgba(255,${Math.round(90 + 140 * fl * (1 - age / 25))},40,${0.95 - age / 40})`; g.fillRect(x, y, c + 0.5, c + 0.5); }
    }
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1; g.beginPath(); // isócronas cada hora
    for (let y = 0; y < G.h - 1; y++) for (let x = 0; x < G.w - 1; x++) { const a = T[y * G.w + x]; if (!(a <= now)) continue; const b1 = Math.floor(a / 60); for (const [nx, ny] of [[x + 1, y], [x, y + 1]]) { const bb = T[ny * G.w + nx]; if (Number.isFinite(bb) && Math.floor(bb / 60) !== b1) { if (nx > x) { g.moveTo(m.x + nx * c, m.y + y * c); g.lineTo(m.x + nx * c, m.y + (y + 1) * c); } else { g.moveTo(m.x + x * c, m.y + ny * c); g.lineTo(m.x + (x + 1) * c, m.y + ny * c); } } } }
    g.stroke();
    glow(g, m.x + (st.ign.x + 0.5) * c, m.y + (st.ign.y + 0.5) * c, c * 3, C.coral, 0.9);
    for (const tw of Ld.towers) { // antenas
      const a = st.assets && T[tw.y * G.w + tw.x] - 10, lost = now >= a, x = m.x + (tw.x + 0.5) * c, y = m.y + (tw.y + 0.5) * c;
      g.strokeStyle = lost ? C.red : C.ice; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y + 9); g.lineTo(x, y - 9); g.lineTo(x + 6, y + 9); g.stroke();
      if (lost) { txt(g, '✕', x + 9, y - 4, { size: 13, color: C.red, weight: 800 }); }
    }
    for (const tn of Ld.towns) {
      const a = st.assets.find((q) => q.id === tn.id), x = m.x + (tn.x + 0.5) * c, y = m.y + (tn.y + 0.5) * c;
      if (Number.isFinite(a.sendByMin) && now >= a.sendByMin && now < a.sendByMin + 45) { const k = (now - a.sendByMin) / 45; g.strokeStyle = a.antennaFirst ? C.cyan : C.green; g.globalAlpha = 1 - k; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 8 + k * c * 14, 0, 6.3); g.stroke(); g.globalAlpha = 1; txt(g, L.alert, x, y - 14 - k * 10, { size: 12, align: 'center', weight: 800, color: a.antennaFirst ? C.cyan : C.green }); }
      g.fillStyle = C.text; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); txt(g, tn.name, x + 9, y + 4, { size: 12, weight: 800 });
    }
    // viento y reloj
    const wx = m.x + 40, wy = m.y + 34, ang = (st.dir * Math.PI) / 180; g.strokeStyle = C.text; g.lineWidth = 2.5; g.beginPath(); g.moveTo(wx - 18 * Math.cos(ang), wy - 18 * Math.sin(ang)); g.lineTo(wx + 18 * Math.cos(ang), wy + 18 * Math.sin(ang)); g.stroke();
    g.beginPath(); g.arc(wx + 18 * Math.cos(ang), wy + 18 * Math.sin(ang), 4, 0, 6.3); g.fillStyle = C.text; g.fill();
    txt(g, `${st.wind} km/h`, wx, wy + 34, { size: 12, align: 'center', weight: 700 }); txt(g, `T + ${hm(now)}`, m.x + c * G.w - 10, m.y + 24, { size: 16, align: 'right', weight: 800, mono: true });
    // tabla de poblaciones
    const ty = m.y + c * G.h + 22, fs = Math.max(11, W / 80), colW = (W - 20) / 3;
    if (W < 760) { st.assets.forEach((a, i) => { const col = a.status === 'FUERA_DE_ALCANCE' ? C.muted : a.antennaFirst ? C.cyan : C.green; txt(g, a.status === 'FUERA_DE_ALCANCE' ? `${a.name} · ${L.outOfReach}` : `${a.name} · ${L.arrives} ${hm(a.arrivalMin)} · ${L.antenna} ${hm(a.commsLossMin)} → ${a.antennaFirst ? L.viaOffline : L.viaMobile}`, 10, ty + i * (fs + 9), { size: fs, color: col, weight: 700 }); }); return; }
    st.assets.forEach((a, i) => {
      const x = 10 + i * colW, col = a.status === 'FUERA_DE_ALCANCE' ? C.muted : a.antennaFirst ? C.cyan : C.green;
      txt(g, a.name, x, ty, { size: fs + 2, weight: 800, color: col });
      if (a.status === 'FUERA_DE_ALCANCE') { txt(g, L.outOfReach, x, ty + fs + 6, { size: fs, color: C.muted }); return; }
      txt(g, `${L.arrives} ${hm(a.arrivalMin)} · ${L.deadline} ${hm(a.deadlineMin)}`, x, ty + fs + 6, { size: fs, color: C.text });
      txt(g, `${L.antenna} ${hm(a.commsLossMin)} → ${a.antennaFirst ? L.viaOffline : L.viaMobile}`, x, ty + 2 * fs + 12, { size: fs, color: col, weight: 700 });
    });
  } };
}

/* ================================================================ 5. vía: circuito y geometría */
function railDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, 16 / 10, o.fixed);
  const st = { stepV: 0.7, tc: null, res: null, geo: null, t0: 0, lastT: 0 };
  const compute = () => { st.tc = syntheticTrackCircuit({ stepV: st.stepV }); st.res = trackCircuitWatch(st.tc.samples, { occupancyThresholdV: st.tc.thresholdV }); st.t0 = st.lastT; s.cv.setAttribute('aria-label', st.res.events.length ? L.detected : L.thrNone); };
  const geoLater = () => { st.geo = trackGeometryCrowd(syntheticPassengerTrips({ trips: 36, devices: 18 })); };
  if (o.fixed) geoLater(); else setTimeout(geoLater, 400);
  if (!o.fixed) host.append(el('div', { className: 'sd-controls' }, slider(L.stepV, 0, 1.3, 0.05, st.stepV, (v) => { st.stepV = v; compute(); }, (v) => nf(o.lang, v, 2))));
  compute();
  return { surface: s, set(p) { Object.assign(st, p); compute(); }, render(t) {
    st.lastT = t; const { g, W, H } = s; bg(g, W, H); const fs = Math.max(11, W / 75);
    // vía y tren
    const ry = H * 0.12; g.strokeStyle = '#6b7b86'; g.lineWidth = 2; for (const d of [-5, 5]) { g.beginPath(); g.moveTo(0, ry + d); g.lineTo(W, ry + d); g.stroke(); }
    for (let x = (t * 120) % 22 - 22; x < W; x += 22) { g.strokeStyle = '#3a4a55'; g.beginPath(); g.moveTo(x, ry - 9); g.lineTo(x, ry + 9); g.stroke(); }
    const trx = ((t * 0.18) % 1.4 - 0.2) * W; rr(g, trx, ry - 16, W * 0.2, 14, 4); g.fillStyle = C.ice; g.fill(); for (let w = 0; w < 8; w++) { g.fillStyle = C.bg; g.fillRect(trx + 8 + w * W * 0.023, ry - 13, W * 0.012, 5); }
    const cx0 = W * 0.55; g.strokeStyle = C.amber; g.lineWidth = 2; g.strokeRect(cx0 - 40, ry - 12, 80, 24); txt(g, 'CdV', cx0, ry + 26, { size: 11, color: C.amber, align: 'center', weight: 800 });
    // gráfica 48 h
    const gx = W * 0.07, gw = W * 0.9, gy = H * 0.24, gh = H * 0.46, Tm = 48 * 3600, cursor = (((t - st.t0) % 14) / 12) * Tm;
    const X = (tt) => gx + (gw * tt) / Tm, Y = (v) => gy + gh - (gh * v) / 2.2;
    g.strokeStyle = C.line; g.lineWidth = 1; for (const v of [0, 1, 2]) { g.beginPath(); g.moveTo(gx, Y(v)); g.lineTo(gx + gw, Y(v)); g.stroke(); txt(g, `${v} V`, gx - 6, Y(v) + 4, { size: 10, color: C.muted, align: 'right' }); }
    for (let hh = 0; hh <= 48; hh += 12) txt(g, `${hh} h`, X(hh * 3600), gy + gh + 16, { size: 10, color: C.muted, align: 'center' });
    g.strokeStyle = C.amber; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(gx, Y(st.tc.thresholdV)); g.lineTo(gx + gw, Y(st.tc.thresholdV)); g.stroke(); g.setLineDash([]);
    txt(g, `${L.threshold} ${nf(o.lang, st.tc.thresholdV, 2)} V`, gx + 6, Y(st.tc.thresholdV) - 6, { size: fs - 1, color: C.amber });
    g.strokeStyle = C.ice; g.lineWidth = 1.8; g.beginPath(); let first = true;
    for (const p of st.tc.samples) { if (p.t > cursor) break; if (p.occupied) continue; first ? g.moveTo(X(p.t), Y(p.v)) : g.lineTo(X(p.t), Y(p.v)); first = false; }
    g.stroke();
    g.fillStyle = 'rgba(159,178,188,.4)'; for (const p of st.tc.samples) { if (p.t > cursor) break; if (p.occupied) g.fillRect(X(p.t) - 1, Y(p.v) - 1, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(X(cursor), gy); g.lineTo(X(cursor), gy + gh); g.stroke();
    const e = st.res.events[0], thrFires = st.tc.samples.some((p) => !p.occupied && p.v <= st.tc.thresholdV && p.t <= cursor);
    if (e && cursor >= e.detectedAtT) {
      const x = X(e.detectedAtT); g.strokeStyle = C.red; g.lineWidth = 3; g.beginPath(); g.moveTo(x, gy - 6); g.lineTo(x, gy + gh); g.stroke(); glow(g, x, Y(e.afterV), 30, C.red, 0.5);
      txt(g, `${L.detected} · ${nf(o.lang, (st.tc.accidentAtS - e.detectedAtT) / 3600, 1)} ${L.hoursBefore}`, Math.min(x + 8, gx + gw - 330), gy + 8, { size: fs + 1, color: C.red, weight: 800 });
      txt(g, '⚠', cx0, ry - 22, { size: 18, color: C.red, align: 'center' });
    }
    txt(g, thrFires ? L.thrToo : L.thrNone, gx + gw, gy + gh - 8, { size: fs, color: thrFires ? C.amber : C.muted, align: 'right', weight: 700 });
    // geometría colaborativa
    const sy = H * 0.84, sh = H * 0.07; txt(g, L.crowd, gx, sy - 8, { size: fs, color: C.ice, weight: 700 });
    if (st.geo) {
      const segs = st.geo.segments, Lm = segs.at(-1).toPk;
      for (const sg of segs) { const v = clamp(((sg.recentIndex ?? sg.index) - 0.8) / 2, 0, 1); g.fillStyle = `rgb(${Math.round(52 + 203 * v)},${Math.round(211 - 120 * v)},${Math.round(153 - 60 * v)})`; g.fillRect(gx + (gw * sg.fromPk) / Lm, sy, Math.max(1, (gw * 50) / Lm), sh); }
      for (const a of st.geo.alerts.filter((q, i, arr) => i === 0 || q.fromPk - arr[i - 1].fromPk > 100)) { const x = gx + (gw * a.fromPk) / Lm; txt(g, '▲', x, sy + sh + 14, { size: 12, color: C.red, align: 'center' }); txt(g, `PK ${nf(o.lang, a.fromPk / 1000, 1)} · ${a.kinds.includes('IMPACTO_REPETIDO') ? L.impact : L.degr}`, x, sy + sh + 28, { size: fs - 1, color: C.text, align: 'center' }); }
    }
  } };
}

/* ================================================================ 6. satélites sobre el globo */
const RE = 6371, OBS = { lat: 40.41, lon: -4.5 }, EPOCH = Date.UTC(2026, 10, 4, 12);
const IRIDIUM = Array.from({ length: 66 }, (_, k) => { const p = Math.floor(k / 11), s = k % 11; return { name: `IRI-${p}${s}`, norad: 90000 + k, epoch: EPOCH, inc: (86.4 * Math.PI) / 180, raan: (p * 31.6 * Math.PI) / 180, ecc: 0.0002, argp: 0, M: ((s * 360) / 11 + (p % 2) * 16.4) * (Math.PI / 180), nRevDay: 14.34 }; });
let LAND = null;
function orbitDemo(host, o) {
  const L = I18N[o.lang], s = surface(host, 4 / 3, o.fixed);
  const st = { lon0: -4.5, lat0: 32, speed: 60, drag: null, lastT: 0, cache: { sec: -1 } };
  if (!LAND) fetch('/geo/land-110m.json').then((r) => r.json()).then((j) => { LAND = j.rings; }).catch(() => {});
  if (!o.fixed) {
    host.append(el('div', { className: 'sd-controls' }, slider(L.speed, 1, 600, 1, st.speed, (v) => { st.speed = v; }, (v) => `×${v}`), button(L.center, () => { st.lon0 = -4.5; st.lat0 = 32; })));
    s.cv.addEventListener('pointerdown', (e) => { st.drag = { x: e.clientX, y: e.clientY }; s.cv.setPointerCapture(e.pointerId); });
    s.cv.addEventListener('pointermove', (e) => { if (!st.drag) return; st.lon0 -= (e.clientX - st.drag.x) * 0.4; st.lat0 = clamp(st.lat0 + (e.clientY - st.drag.y) * 0.4, -80, 80); st.drag = { x: e.clientX, y: e.clientY }; });
    s.cv.addEventListener('pointerup', () => { st.drag = null; });
  }
  const D = Math.PI / 180;
  const basis = () => { const la = st.lat0 * D, lo = st.lon0 * D; return { f: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], e: [-Math.sin(lo), Math.cos(lo), 0], n: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)] }; };
  const ecef = (lat, lon, r = 1) => [r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.cos(lat * D) * Math.sin(lon * D), r * Math.sin(lat * D)];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return { surface: s, set(p) { Object.assign(st, p); }, render(t) {
    st.lastT = t; const { g, W, H } = s; bg(g, W, H); const B = basis(), R = Math.min(W, H) * 0.36, cx = W / 2, cy = H * 0.47;
    const P = (v) => ({ x: cx + R * dot(v, B.e), y: cy - R * dot(v, B.n), z: dot(v, B.f) });
    const time = EPOCH + t * st.speed * 1000;
    const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); gr.addColorStop(0, '#12324a'); gr.addColorStop(1, '#061520'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, 6.3); g.fill();
    glow(g, cx, cy, R * 1.15, C.ice, 0.08);
    g.strokeStyle = 'rgba(145,215,232,.12)'; g.lineWidth = 1;
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); let pen = false; for (let lo = -180; lo <= 180; lo += 5) { const p = P(ecef(la, lo)); if (p.z > 0) { pen ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); pen = true; } else pen = false; } g.stroke(); }
    for (let lo = -180; lo < 180; lo += 30) { g.beginPath(); let pen = false; for (let la = -90; la <= 90; la += 5) { const p = P(ecef(la, lo)); if (p.z > 0) { pen ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); pen = true; } else pen = false; } g.stroke(); }
    if (LAND) { g.fillStyle = 'rgba(52,211,153,.22)'; g.strokeStyle = 'rgba(52,211,153,.6)'; for (const ring of LAND) { g.beginPath(); let pen = false, vis = 0; for (let i = 0; i < ring.length; i += 2) { const p = P(ecef(ring[i + 1], ring[i])); if (p.z > 0) { vis++; pen ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); pen = true; } else pen = false; } if (vis > 2) g.stroke(); } }
    const gm = gmst(time); let visible = 0; const ob = P(ecef(OBS.lat, OBS.lon));
    const pts = IRIDIUM.map((el_) => { const e = propagateKeplerJ2(el_, time); const x = Math.cos(gm) * e.x + Math.sin(gm) * e.y, y = -Math.sin(gm) * e.x + Math.cos(gm) * e.y; return { el: el_, p: P([x / RE, y / RE, e.z / RE]), elev: lookAngles(el_, OBS, time).elevationDeg }; });
    for (const q of pts) { const hidden = q.p.z < 0 && Math.hypot(q.p.x - cx, q.p.y - cy) < R; if (hidden) continue; const up = q.elev >= 15; if (up) { visible++; g.strokeStyle = C.cyan; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ob.x, ob.y); g.lineTo(q.p.x, q.p.y); g.stroke(); glow(g, q.p.x, q.p.y, 14, C.cyan, 0.8); } g.fillStyle = up ? C.cyan : C.ice; g.beginPath(); g.arc(q.p.x, q.p.y, up ? 3.5 : 2, 0, 6.3); g.fill(); }
    if (ob.z > 0) { glow(g, ob.x, ob.y, 16, C.coral, 0.9); g.fillStyle = C.coral; g.beginPath(); g.arc(ob.x, ob.y, 4, 0, 6.3); g.fill(); txt(g, 'El Tiemblo', ob.x + 8, ob.y - 8, { size: 12, weight: 800 }); }
    const sec = Math.floor(time / 30000);
    if (st.cache.sec !== sec) { let nextS = null; if (!visible) for (let dt = 30; dt <= 3600; dt += 30) { if (IRIDIUM.some((e) => lookAngles(e, OBS, time + dt * 1000).elevationDeg >= 15)) { nextS = dt; break; } } st.cache = { sec, nextS }; }
    const fs = Math.max(12, W / 55);
    txt(g, `${visible} ${L.visible}`, 16, H - 46, { size: fs + 2, weight: 800, color: visible ? C.cyan : C.amber });
    txt(g, visible ? 'Iridium SBD · 340 B' : `${L.next} ${st.cache.nextS != null ? Math.round(st.cache.nextS / 60) + ' min' : '—'}`, 16, H - 24, { size: fs, color: C.muted });
    txt(g, L.iridium, W - 12, 20, { size: fs - 2, color: C.muted, align: 'right' });
    txt(g, `UTC ${new Date(time).toISOString().slice(11, 19)} · ×${st.speed}`, W - 12, H - 24, { size: fs, color: C.muted, align: 'right', mono: true });
  } };
}

const FACTORY = { hero: heroDemo, net: netDemo, crypto: cryptoDemo, fusion: fusionDemo, fire: fireDemo, rail: railDemo, orbit: orbitDemo };
export function createDemo(kind, host, { lang = 'es', fixed = null } = {}) { return FACTORY[kind](host, { lang: I18N[lang] ? lang : 'es', fixed }); }

/** Monta todas las demos [data-demo] de la página: animación solo cuando están a la vista. */
export function mountAll(root = document, lang = 'es') {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, live = new Set(), all = [];
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? live.add(e.target._demo) : live.delete(e.target._demo))), { rootMargin: '120px' });
  for (const host of root.querySelectorAll('[data-demo]')) {
    if (host._demo) continue;
    try { const d = createDemo(host.dataset.demo, host, { lang }); host._demo = d; all.push(d); io.observe(host); d.render(reduce ? 6 : 0); }
    catch (e) { host.append(el('p', { className: 'sd-hint' }, String(e.message || e))); }
  }
  const t0 = performance.now();
  const loop = (now) => { const t = reduce ? 6 : (now - t0) / 1000; for (const d of live) d.render(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => all.forEach((d) => { d.surface.resize(); d.render(6); }), 150); });
  return all;
}
