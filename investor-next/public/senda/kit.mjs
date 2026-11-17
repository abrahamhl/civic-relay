/**
 * SENDA · kit de las páginas de capacidades: lienzos nítidos, bucle de animación y MODO PELÍCULA.
 * ?film=1&viz=<id> deja solo ese lienzo a pantalla completa y lo controla window.SENDA_VIZ.seek(t):
 * así los vídeos se graban desde la propia app, fotograma a fotograma, con el núcleo real.
 */
const Q = new URLSearchParams(location.search);
export const FILM = Q.get('film') === '1', VIZ = Q.get('viz');
export const LANG = Q.get('lang') || (typeof document !== 'undefined' && document.documentElement.lang) || 'es';
export const tr = (es, en) => (LANG === 'en' ? en : es);
export const $ = (s, r = document) => r.querySelector(s);
export const C = { bg: '#071018', p: '#0b141c', l: '#203240', t: '#f2f4f4', m: '#9fb2bc', c: '#ff7756', i: '#91d7e8', e: '#34d399', a: '#fbbf24', v: '#b79cff', r: '#ff5b6e', g: '#5d6e78' };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

/** Prepara un lienzo de tamaño lógico w×h (nítido en pantallas de alta densidad). */
export function canvas(cv, w = 640, h = 600) {
  const r = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.aspectRatio = `${w}/${h}`; cv.dataset.w = w; cv.dataset.h = h;
  const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); cv.__ctx = g; cv.__w = w; cv.__h = h; return g;
}
export function text(g, t, x, y, { c = C.t, f = '13px Inter,system-ui,sans-serif', al = 'left', bl = 'alphabetic' } = {}) { g.fillStyle = c; g.font = f; g.textAlign = al; g.textBaseline = bl; g.fillText(t, x, y); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

/**
 * Registra los dibujos de la página. En modo normal los anima; en modo película solo dibuja cuando
 * se le pide un instante con SENDA_VIZ.seek(t).
 */
export function run(draws) {
  window.SENDA_VIZ = {
    seek: (t, name = VIZ) => (name ? [draws[name]] : Object.values(draws)).forEach((f) => f?.(t)),
    names: Object.keys(draws),
  };
  window.__filmSeek = (t) => window.SENDA_VIZ.seek(t);
  if (FILM) {
    const el = document.querySelector(`[data-viz="${VIZ}"] canvas`);
    if (el) {
      document.querySelector('main')?.style.setProperty('display', 'none');
      document.body.appendChild(el);
      document.body.style.cssText = 'margin:0;background:#05090c;display:grid;place-items:center;width:100vw;height:100vh;overflow:hidden';
      const ar = (el.__w || 640) / (el.__h || 600);
      el.style.cssText = ar >= (640 / 600)
        ? `width:100vw;height:auto;max-height:100vh;aspect-ratio:${el.style.aspectRatio}`
        : `height:100vh;width:auto;max-width:100vw;aspect-ratio:${el.style.aspectRatio}`;
    }
    window.SENDA_VIZ.seek(0); window.SENDA_VIZ_READY = true; return;
  }
  const t0 = performance.now(); const tick = () => { window.SENDA_VIZ.seek((performance.now() - t0) / 1000, null); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  window.SENDA_VIZ_READY = true;
}

// ---------------------------------------------------------------- Render realista (vehículos, vía, marcas)
const PAL = ['#d9dee2', '#9aa4ab', '#2f3a44', '#7a1f24', '#1f3f6b', '#c9c2b4', '#4b5560', '#e9e6df'];
/** Color de carrocería estable para un índice (gris perla, plata, antracita, granate, azul…). */
export const carColor = (i) => PAL[((i % PAL.length) + PAL.length) % PAL.length];
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = (c) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
/**
 * Coche visto desde arriba, con volumen: sombra, carrocería con degradado, lunas, retrovisores, faros y pilotos.
 * (x, y) = centro; `len` en píxeles; `ang` en radianes (0 = mirando a la derecha). `braking` enciende los pilotos.
 */
export function drawCar(g, x, y, { len = 34, ang = 0, color = '#d9dee2', braking = false, lights = false, kind = 'car', hit = false } = {}) {
  const L = kind === 'truck' ? len * 1.9 : len, W = kind === 'truck' ? len * 0.52 : len * 0.46;
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(-L / 2 + 2, -W / 2 + 3, L, W, W * 0.35); g.fill();
  if (lights) { const hl = g.createLinearGradient(L / 2, 0, L / 2 + L * 1.6, 0); hl.addColorStop(0, 'rgba(255,244,214,.38)'); hl.addColorStop(1, 'rgba(255,244,214,0)'); g.fillStyle = hl; g.beginPath(); g.moveTo(L / 2, -W * 0.35); g.lineTo(L / 2 + L * 1.6, -W * 0.9); g.lineTo(L / 2 + L * 1.6, W * 0.9); g.lineTo(L / 2, W * 0.35); g.fill(); }
  if (braking) { const bl = g.createRadialGradient(-L / 2, 0, 1, -L / 2, 0, W * 1.3); bl.addColorStop(0, 'rgba(255,40,40,.75)'); bl.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = bl; g.beginPath(); g.arc(-L / 2, 0, W * 1.3, 0, 7); g.fill(); }
  const body = g.createLinearGradient(0, -W / 2, 0, W / 2); body.addColorStop(0, shade(color, -0.25)); body.addColorStop(0.5, shade(color, 0.18)); body.addColorStop(1, shade(color, -0.3));
  if (kind === 'truck') {
    g.fillStyle = body; g.beginPath(); g.roundRect(-L / 2, -W / 2, L * 0.74, W, 3); g.fill();
    g.fillStyle = shade(color, -0.1); g.beginPath(); g.roundRect(L * 0.26, -W / 2 + 1, L * 0.24, W - 2, 4); g.fill();
    g.fillStyle = '#1b2733'; g.fillRect(L * 0.42, -W / 2 + 3, L * 0.05, W - 6);
  } else {
    g.fillStyle = body; g.beginPath(); g.roundRect(-L / 2, -W / 2, L, W, W * 0.34); g.fill();
    g.fillStyle = 'rgba(16,26,36,.92)';
    g.beginPath(); g.moveTo(L * 0.08, -W * 0.36); g.lineTo(L * 0.24, -W * 0.3); g.lineTo(L * 0.24, W * 0.3); g.lineTo(L * 0.08, W * 0.36); g.closePath(); g.fill();   // parabrisas
    g.beginPath(); g.moveTo(-L * 0.3, -W * 0.33); g.lineTo(-L * 0.38, -W * 0.27); g.lineTo(-L * 0.38, W * 0.27); g.lineTo(-L * 0.3, W * 0.33); g.closePath(); g.fill(); // luna trasera
    g.fillStyle = shade(color, -0.12); g.beginPath(); g.roundRect(-L * 0.3, -W * 0.36, L * 0.38, W * 0.72, 3); g.fill();                                         // techo
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-L * 0.26, -W * 0.3, L * 0.3, W * 0.08);
    g.fillStyle = shade(color, -0.35); g.fillRect(L * 0.05, -W / 2 - 2, 3, 2); g.fillRect(L * 0.05, W / 2, 3, 2);                                                   // retrovisores
  }
  g.fillStyle = '#fff6dc'; g.fillRect(L / 2 - 2, -W * 0.4, 2, W * 0.18); g.fillRect(L / 2 - 2, W * 0.22, 2, W * 0.18);
  g.fillStyle = braking ? '#ff3b3b' : '#7a1a1a'; g.fillRect(-L / 2, -W * 0.42, 2.5, W * 0.2); g.fillRect(-L / 2, W * 0.22, 2.5, W * 0.2);
  if (hit) { g.strokeStyle = '#ff5b6e'; g.lineWidth = 2; g.beginPath(); g.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, W * 0.4); g.stroke(); }
  g.restore();
}
let ASPHALT = null;
function asphalt(g) {
  if (ASPHALT) return ASPHALT; const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#2b3136'; x.fillRect(0, 0, 96, 96);
  let s = 7; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let i = 0; i < 900; i++) { const v = 30 + R() * 40; x.fillStyle = `rgba(${v + 20},${v + 24},${v + 28},${0.25 + R() * 0.35})`; x.fillRect(R() * 96, R() * 96, 1, 1); }
  ASPHALT = g.createPattern(c, 'repeat'); return ASPHALT;
}
/**
 * Calzada con textura de asfalto, arcenes, líneas de borde continuas y separación de carriles discontinua.
 * `vertical` la gira; `offset` desplaza las discontinuas para dar sensación de marcha.
 */
export function drawRoad(g, x, y, w, h, { lanes = 2, vertical = false, offset = 0, shoulder = 0.08, median = false } = {}) {
  g.save(); g.fillStyle = '#1d2a22'; g.fillRect(x, y, w, h);
  g.fillStyle = asphalt(g); g.fillRect(x, y, w, h);
  const across = vertical ? w : h, along = vertical ? h : w, sh = across * shoulder, lane = (across - 2 * sh) / lanes;
  const line = (p, dash) => { g.strokeStyle = 'rgba(240,240,232,.9)'; g.lineWidth = Math.max(1.5, across * 0.012); g.setLineDash(dash ? [along * 0.035, along * 0.03] : []); g.lineDashOffset = dash ? -offset : 0; g.beginPath(); if (vertical) { g.moveTo(x + p, y); g.lineTo(x + p, y + h); } else { g.moveTo(x, y + p); g.lineTo(x + w, y + p); } g.stroke(); };
  g.fillStyle = 'rgba(0,0,0,.18)'; if (vertical) { g.fillRect(x, y, sh, h); g.fillRect(x + w - sh, y, sh, h); } else { g.fillRect(x, y, w, sh); g.fillRect(x, y + h - sh, w, sh); }
  line(sh, false); line(across - sh, false); for (let k = 1; k < lanes; k++) line(sh + k * lane, !(median && k === lanes / 2));
  g.setLineDash([]); g.restore(); return { laneCenter: (k) => sh + lane * (k + 0.5), lane, sh };
}
/** Marca de choque vectorial (estrella de impacto), sin emojis. */
export function drawImpact(g, x, y, r = 10) {
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(255,91,110,.25)'; g.beginPath(); g.arc(0, 0, r * 1.6, 0, 7); g.fill();
  g.fillStyle = '#ff5b6e'; g.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr2 = k % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill();
  g.fillStyle = '#fff1e6'; g.beginPath(); g.arc(0, 0, r * 0.25, 0, 7); g.fill(); g.restore();
}
/** Pin de persona (cabeza y hombros), para escenas con gente; sin caras ni rasgos. */
export function drawPerson(g, x, y, color = '#fbbf24', s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(0, 12, 9, 3, 0, 0, 7); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(0, -8, 5, 0, 7); g.fill(); g.beginPath(); g.roundRect(-7, -2, 14, 13, 6); g.fill(); g.restore();
}
