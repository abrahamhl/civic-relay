/**
 * SENDA Drive · peligros vistos por la cámara del salpicadero (todo en el móvil, sin red).
 *
 * Entrada: detecciones por fotograma (recuadros normalizados 0–1 y clase COCO) con su instante.
 * Salida: objetos seguidos con
 *   - zona (izquierda / tu carril / derecha) por la posición horizontal del recuadro;
 *   - tiempo hasta alcanzarlo (TTC) por EXPANSIÓN del recuadro: si el tamaño aparente s=√área crece,
 *     TTC ≈ s / (ds/dt) (relación clásica de «looming»; no necesita conocer la distancia real);
 *   - movimiento lateral hacia tu carril (posible incorporación o cambio de carril).
 * Nivel de riesgo: ROJO si TTC ≤ tiempo de percepción-reacción de AASHTO (2,5 s, con fuente en road-guard);
 * ÁMBAR si TTC ≤ 2× ese tiempo o si algo entra en tu carril deprisa. El factor 2 y el umbral lateral son
 * REGLAS DE LA APP declaradas, no calibradas con medidas. No sustituye la atención del conductor.
 * No detecta intermitentes ni luces de freno (el modelo no ve eso).
 */
import { AASHTO_SSD } from './road-guard.mjs';

export const RULES = Object.freeze({
  redTtcS: AASHTO_SSD.perceptionReactionS,       // con fuente
  amberTtcS: 2 * AASHTO_SSD.perceptionReactionS, // regla de la app (declarada)
  cutInSpeed: 0.25,                              // anchos de imagen por segundo hacia tu carril (regla de la app)
  egoLane: [0.35, 0.65],                         // franja central de la imagen = tu carril (supuesto de montaje centrado)
  minIoU: 0.3, maxAgeS: 1.0, minHistory: 3, ttcWindow: 4, // TTC con los últimos fotogramas: la expansión se acelera al acercarse
  source: `rojo = percepción-reacción AASHTO ${AASHTO_SSD.perceptionReactionS} s (${AASHTO_SSD.source}); ámbar y lateral = reglas de la app, no calibradas`,
});

export const WATCHED = Object.freeze(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person', 'dog', 'horse', 'cow', 'sheep']);

const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / (a.w * a.h + b.w * b.h - i || 1);
};
const cx = (b) => b.x + b.w / 2;

export function zoneOf(box, rules = RULES) {
  const c = cx(box);
  return c < rules.egoLane[0] ? 'IZQUIERDA' : c > rules.egoLane[1] ? 'DERECHA' : 'TU_CARRIL';
}

/** Pendiente por mínimos cuadrados de y(t). */
function slope(pts) {
  const n = pts.length, mt = pts.reduce((s, p) => s + p.t, 0) / n, my = pts.reduce((s, p) => s + p.v, 0) / n;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.t - mt) * (p.v - my); den += (p.t - mt) ** 2; }
  return den ? num / den : 0;
}

export function createTracker(rules = RULES) {
  let tracks = [], nextId = 1;
  return {
    /** dets: [{label, score, x, y, w, h}] normalizados; t en segundos. Devuelve los objetos con su evaluación. */
    update(dets, t) {
      const live = tracks.filter((k) => t - k.last <= rules.maxAgeS);
      const used = new Set();
      for (const d of dets.filter((d) => WATCHED.includes(d.label))) {
        let best = null, bi = rules.minIoU;
        for (const k of live) { if (used.has(k) || k.label !== d.label) continue; const v = iou(k.box, d); if (v >= bi) { bi = v; best = k; } }
        if (!best) { best = { id: nextId++, label: d.label, hist: [] }; live.push(best); }
        used.add(best);
        best.box = d; best.last = t; best.hist.push({ t, s: Math.sqrt(d.w * d.h), c: cx(d) });
        if (best.hist.length > 12) best.hist.shift();
      }
      tracks = live;
      return tracks.filter((k) => k.last === t).map((k) => assess(k, rules));
    },
    get size() { return tracks.length; },
  };
}

export function assess(k, rules = RULES) {
  const zone = zoneOf(k.box, rules);
  const out = { id: k.id, label: k.label, box: k.box, zone, ttcS: null, lateral: 0, level: 'VERDE', reasons: [] };
  if (k.hist.length < rules.minHistory) return out;
  const ds = slope(k.hist.slice(-rules.ttcWindow).map((h) => ({ t: h.t, v: h.s })));
  const s = k.hist.at(-1).s;
  if (ds > 0) out.ttcS = s / ds;
  const vc = slope(k.hist.slice(-rules.ttcWindow).map((h) => ({ t: h.t, v: h.c })));
  const c = k.hist.at(-1).c, mid = (rules.egoLane[0] + rules.egoLane[1]) / 2;
  const side = c > mid ? 'DERECHA' : 'IZQUIERDA';
  const towardEgo = Math.abs(c - mid) > 0.02 && ((side === 'DERECHA' && vc < 0) || (side === 'IZQUIERDA' && vc > 0));
  out.lateral = vc;
  const closing = out.ttcS !== null;
  if (closing && out.ttcS <= rules.redTtcS && zone === 'TU_CARRIL') { out.level = 'ROJO'; out.reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
  else if (closing && out.ttcS <= rules.amberTtcS) { out.level = 'AMBAR'; out.reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
  if (towardEgo && Math.abs(vc) >= rules.cutInSpeed) { out.level = out.level === 'ROJO' ? 'ROJO' : 'AMBAR'; out.reasons.push(side === 'DERECHA' ? 'se mete desde la derecha' : 'se mete desde la izquierda'); }
  return out;
}

/** El aviso más importante del fotograma (para voz o vibración), o null. */
export function topAlert(objects) {
  const rank = { ROJO: 2, AMBAR: 1, VERDE: 0 };
  return objects.filter((o) => o.level !== 'VERDE').sort((a, b) => rank[b.level] - rank[a.level] || (a.ttcS ?? 99) - (b.ttcS ?? 99))[0] ?? null;
}
