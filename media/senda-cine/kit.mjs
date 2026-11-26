// Utilidades compartidas del motor de cine (sin dependencias de las escenas).
import * as THREE from '/media/senda-film/cinema/vendor/three.module.min.js';
export const C = { bg: '#04080b', ink: '#eef3f4', gray: '#93a7b1', ember: '#ff7756', mint: '#34d399', sky: '#91d7e8', sun: '#fbbf24', rose: '#ff5b6e' };

export const W = 1920, H = 1080;
const ov = document.getElementById('ov');
export const g = ov.getContext('2d');

// Grano de película: una textura de ruido fija que se desplaza con el fotograma (determinista).
export const grain = document.createElement('canvas'); grain.width = grain.height = 256;
{ const gx = grain.getContext('2d'), id = gx.createImageData(256, 256); let s = 1234567;
  for (let i = 0; i < id.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = s & 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } gx.putImageData(id, 0, 0); }

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (p, a, b) => clamp((p - a) / (b - a));
export function font(px, w = 600, mono = false) { return `${w} ${px}px ${mono ? '"IBM Plex Mono", monospace' : 'Inter, system-ui, sans-serif'}`; }
export function text(s, x, y, { px = 32, w = 600, color = C.ink, align = 'left', alpha = 1, mono = false, shadow = true } = {}) {
  g.save(); g.globalAlpha = alpha; g.font = font(px, w, mono); g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = color;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 18; }
  g.fillText(s, x, y); g.restore();
}
export function wrap(s, maxW, px, w = 600) { g.font = font(px, w); const out = []; let line = ''; for (const word of s.split(' ')) { const t = line ? line + ' ' + word : word; if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
export function panel(x, y, w, h, alpha = 0.72, r = 10) { g.save(); g.globalAlpha = alpha; g.fillStyle = '#081016'; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); g.globalAlpha = alpha * 0.9; g.strokeStyle = 'rgba(147,167,177,.25)'; g.lineWidth = 1.5; g.stroke(); g.restore(); }
export function project(v3, camera) { const v = v3.clone().project(camera); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 }; }
export { THREE };

