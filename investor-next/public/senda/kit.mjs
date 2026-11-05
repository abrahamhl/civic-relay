/**
 * SENDA · kit de las páginas de capacidades: lienzos nítidos, bucle de animación y MODO PELÍCULA.
 * ?film=1&viz=<id> deja solo ese lienzo a pantalla completa y lo controla window.SENDA_VIZ.seek(t):
 * así los vídeos se graban desde la propia app, fotograma a fotograma, con el núcleo real.
 */
const Q = new URLSearchParams(location.search);
export const FILM = Q.get('film') === '1', VIZ = Q.get('viz');
export const $ = (s, r = document) => r.querySelector(s);
export const C = { bg: '#071018', p: '#0b141c', l: '#203240', t: '#f2f4f4', m: '#9fb2bc', c: '#ff7756', i: '#91d7e8', e: '#34d399', a: '#fbbf24', v: '#b79cff', r: '#ff5b6e', g: '#5d6e78' };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

/** Prepara un lienzo de tamaño lógico w×h (nítido en pantallas de alta densidad). */
export function canvas(cv, w = 640, h = 600) {
  const r = FILM ? 1 : Math.min(2, devicePixelRatio || 1);
  cv.width = w * r; cv.height = h * r; cv.style.aspectRatio = `${w}/${h}`; cv.dataset.w = w; cv.dataset.h = h;
  const g = cv.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return g;
}
export function text(g, t, x, y, { c = C.t, f = '13px Inter,system-ui,sans-serif', al = 'left', bl = 'alphabetic' } = {}) { g.fillStyle = c; g.font = f; g.textAlign = al; g.textBaseline = bl; g.fillText(t, x, y); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

/**
 * Registra los dibujos de la página. En modo normal los anima; en modo película solo dibuja cuando
 * se le pide un instante con SENDA_VIZ.seek(t).
 */
export function run(draws) {
  window.SENDA_VIZ = { seek: (t, name = VIZ) => (name ? [draws[name]] : Object.values(draws)).forEach((f) => f?.(t)), names: Object.keys(draws) };
  if (FILM) {
    const el = document.querySelector(`[data-viz="${VIZ}"] canvas`);
    if (el) { document.querySelector('main')?.style.setProperty('display', 'none'); document.body.appendChild(el); document.body.style.cssText = 'margin:0;background:#05090c;display:grid;place-items:center;height:100vh;overflow:hidden'; el.style.cssText = `max-width:100vw;max-height:100vh;width:auto;height:100vh;aspect-ratio:${el.style.aspectRatio}`; }
    window.SENDA_VIZ.seek(0); window.SENDA_VIZ_READY = true; return;
  }
  const t0 = performance.now(); const tick = () => { window.SENDA_VIZ.seek((performance.now() - t0) / 1000, null); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  window.SENDA_VIZ_READY = true;
}
