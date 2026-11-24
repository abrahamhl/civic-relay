/**
 * SENDA Drive · peligros vistos por la cámara del salpicadero (todo en el móvil, sin red).
 *
 * Entrada: detecciones por fotograma (recuadros normalizados 0–1 y clase COCO) con su instante.
 * Salida: objetos seguidos con
 *   - zona (izquierda / tu carril / derecha) por la posición horizontal del recuadro;
 *   - tiempo hasta alcanzarlo (TTC) por EXPANSIÓN isotrópica del recuadro (relación de «looming»
 *     en cámara estenopeica: w ∝ 1/D y h ∝ 1/D, sin necesitar la distancia real):
 *       · si el recuadro toca el borde horizontal de la imagen, su ancho w está recortado por el
 *         encuadre → se usa solo la altura h (evita falsos TTC al entrar un coche por un lateral);
 *       · si está libre de bordes, se exige crecimiento en h y en s=√(wh) (tasa = min(ds/s, dh/h)),
 *         que coincide con 1/TTC en acercamiento real y rechaza desoclusiones solo horizontales;
 *       · las pendientes se estiman con la mediana de Theil–Sen (robusta a picos de 1 fotograma);
 *   - movimiento lateral hacia tu carril (con predicción de movimiento para no perder incorporaciones
 *     rápidas a 4 Hz = 250 ms/fotograma, la cadencia real de /senda/conducir);
 *   - continuidad de pista entre clases equivalentes de 4 ruedas (car/truck/bus) ante parpadeo del
 *     detector ligero (EfficientDet-Lite0 int8) y confirmación en 2 fotogramas consecutivos.
 *
 * Nivel de riesgo: ROJO si TTC ≤ tiempo de percepción-reacción de AASHTO (2,5 s, con fuente en road-guard);
 * ÁMBAR si TTC ≤ 2× ese tiempo o si algo entra en tu carril deprisa. El factor 2, el umbral lateral,
 * el margen de borde y la confirmación en 2 fotogramas son REGLAS DE LA APP declaradas, verificadas
 * en regresión sobre el vídeo real Udacity MIT (36 s, 145 fotogramas a 4 Hz), NO calibradas en carretera
 * abierta con flota. No sustituye la atención del conductor. No detecta intermitentes ni luces de freno.
 */
import { AASHTO_SSD } from './road-guard.mjs';

export const RULES = Object.freeze({
  redTtcS: AASHTO_SSD.perceptionReactionS,       // con fuente (AASHTO Green Book)
  amberTtcS: 2 * AASHTO_SSD.perceptionReactionS, // regla de la app (declarada)
  cutInSpeed: 0.25,                              // anchos de imagen por segundo hacia tu carril (regla de la app)
  egoLane: [0.35, 0.65],                         // franja central de la imagen = tu carril (supuesto de montaje centrado)
  minIoU: 0.3, maxAgeS: 1.0, minHistory: 3, ttcWindow: 4, // TTC con los últimos fotogramas: la expansión se acelera al acercarse
  edgeMargin: 0.015,                             // margen normalizado para detectar recorte contra el borde de la imagen (regla de la app)
  confirmFrames: 2,                              // fotogramas seguidos en alerta antes de emitir AMBAR/ROJO (regla de la app)
  fastLateralMinIoU: 0.15,                       // puerta secundaria a 4 Hz si coinciden banda vertical y tamaño (regla de la app)
  source: `rojo = percepción-reacción AASHTO ${AASHTO_SSD.perceptionReactionS} s (${AASHTO_SSD.source}); ámbar, lateral, recorte de borde y confirmación (2 fotogramas) = reglas de la app, no calibradas en carretera abierta (regresión verificada en Udacity MIT 4 Hz)`,
});

export const WATCHED = Object.freeze(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person', 'dog', 'horse', 'cow', 'sheep']);
export const EXTENDED_WATCHED = Object.freeze([...WATCHED, 'traffic light', 'stop sign', 'train']);
export const INFRA_CLASSES = Object.freeze(new Set(['traffic light', 'stop sign']));
export const VRU_CLASSES = Object.freeze(new Set(['person', 'bicycle', 'motorcycle']));
export function classGroup(label) {
  if (INFRA_CLASSES.has(label)) return 'INFRA';
  if (VRU_CLASSES.has(label)) return 'VRU';
  if (label === 'train') return 'RAIL';
  if (['dog', 'horse', 'cow', 'sheep'].includes(label)) return 'ANIMAL';
  return 'VEHICLE';
}
const MOTOR_4W = new Set(['car', 'truck', 'bus']);
const sameGroup = (a, b) => a === b || (MOTOR_4W.has(a) && MOTOR_4W.has(b));

const iou = (a, b) => {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y), x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return i / (a.w * a.h + b.w * b.h - i || 1);
};
const vOverlap = (a, b) => {
  const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h);
  const minH = Math.min(a.h, b.h);
  return minH > 0 ? Math.max(0, y2 - y1) / minH : 0;
};
const cx = (b) => b.x + b.w / 2;

export function zoneOf(box, rules = RULES) {
  const c = cx(box);
  return c < rules.egoLane[0] ? 'IZQUIERDA' : c > rules.egoLane[1] ? 'DERECHA' : 'TU_CARRIL';
}

/** Pendiente robusta de Theil–Sen (mediana de pendientes entre pares): inmune a un pico aislado. */
export function theilSenSlope(pts) {
  const slopes = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dt = pts[j].t - pts[i].t;
      if (dt > 1e-6) slopes.push((pts[j].v - pts[i].v) / dt);
    }
  }
  if (!slopes.length) return 0;
  slopes.sort((a, b) => a - b);
  const m = slopes.length >> 1;
  return slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2;
}

/** Predicción lineal de posición horizontal para mantener pista en incorporaciones rápidas a 4 Hz. */
function predictBox(k, t) {
  if (k.hist.length < 2) return k.box;
  const a = k.hist.at(-2), b = k.hist.at(-1), dt0 = b.t - a.t, dt = t - b.t;
  if (!(dt0 > 1e-6 && dt > 0 && dt <= 1.0)) return k.box;
  const dx = ((b.c - a.c) / dt0) * dt;
  return { x: k.box.x + dx, y: k.box.y, w: k.box.w, h: k.box.h };
}

function matchScore(k, d, t, rules) {
  if (!sameGroup(k.label, d.label)) return 0;
  const best = Math.max(iou(k.box, d), iou(predictBox(k, t), d));
  if (best >= rules.minIoU) return best;
  const s1 = Math.sqrt(k.box.w * k.box.h), s2 = Math.sqrt(d.w * d.h);
  const ratio = s1 && s2 ? Math.min(s1, s2) / Math.max(s1, s2) : 0;
  if (best >= (rules.fastLateralMinIoU ?? 0.15) && ratio >= 0.65 && vOverlap(k.box, d) >= 0.6) return best;
  return 0;
}

function sampleOf(d, t, edge) {
  const hClip = d.x <= edge || (d.x + d.w) >= 1 - edge;
  const vClip = d.y <= edge || (d.y + d.h) >= 1 - edge;
  return { t, s: Math.sqrt(d.w * d.h), w: d.w, h: d.h, c: cx(d), hClip, vClip };
}

export function createTracker(rules = RULES) {
  let tracks = [], nextId = 1;
  const edge = rules.edgeMargin ?? RULES.edgeMargin;
  const allowed = rules.includeInfra ? EXTENDED_WATCHED : WATCHED;
  return {
    /** dets: [{label, score, x, y, w, h}] normalizados; t en segundos. Devuelve los objetos con su evaluación. */
    update(dets, t) {
      const live = tracks.filter((k) => t - k.last <= rules.maxAgeS);
      const valid = dets.filter((d) => allowed.includes(d.label));
      // Emparejamiento global por mejor puntuación (invariante al orden de detecciones)
      const pairs = [];
      for (let di = 0; di < valid.length; di++) {
        for (let ki = 0; ki < live.length; ki++) {
          const sc = matchScore(live[ki], valid[di], t, rules);
          if (sc > 0) pairs.push({ di, ki, sc });
        }
      }
      pairs.sort((a, b) => b.sc - a.sc);
      const usedD = new Set(), usedK = new Set();
      for (const { di, ki } of pairs) {
        if (usedD.has(di) || usedK.has(ki)) continue;
        usedD.add(di); usedK.add(ki);
        const k = live[ki], d = valid[di];
        k.label = d.label; k.box = d; k.last = t;
        k.hist.push(sampleOf(d, t, edge));
        if (k.hist.length > 12) k.hist.shift();
      }
      for (let di = 0; di < valid.length; di++) {
        if (usedD.has(di)) continue;
        const d = valid[di];
        live.push({ id: nextId++, label: d.label, box: d, last: t, streak: 0, hist: [sampleOf(d, t, edge)] });
      }
      tracks = live;
      return tracks.filter((k) => k.last === t).map((k) => assess(k, rules));
    },
    get size() { return tracks.length; },
  };
}

export function assess(k, rules = RULES) {
  const zone = zoneOf(k.box, rules);
  const group = classGroup(k.label);
  const out = { id: k.id, label: k.label, group, box: k.box, zone, ttcS: null, lateral: 0, level: 'VERDE', reasons: [], clipped: false };
  if (INFRA_CLASSES.has(k.label)) { k.streak = 0; return out; }
  if (k.hist.length < rules.minHistory) { k.streak = 0; return out; }
  const win = k.hist.slice(-rules.ttcWindow);
  const anyHClip = win.some((h) => h.hClip);
  const anyVClip = win.some((h) => h.vClip);
  out.clipped = anyHClip || anyVClip;
  const last = win.at(-1);
  let rate = 0;
  if (anyHClip && anyVClip) {
    rate = 0;
  } else if (anyHClip) {
    const dh = theilSenSlope(win.map((h) => ({ t: h.t, v: h.h })));
    rate = last.h > 0 ? dh / last.h : 0;
  } else if (anyVClip) {
    const dw = theilSenSlope(win.map((h) => ({ t: h.t, v: h.w })));
    rate = last.w > 0 ? dw / last.w : 0;
  } else {
    const ds = theilSenSlope(win.map((h) => ({ t: h.t, v: h.s })));
    const dh = theilSenSlope(win.map((h) => ({ t: h.t, v: h.h })));
    const rs = last.s > 0 ? ds / last.s : 0;
    const rh = last.h > 0 ? dh / last.h : 0;
    rate = Math.min(rs, rh);
  }
  if (rate > 0) out.ttcS = 1 / rate;
  const vc = theilSenSlope(win.map((h) => ({ t: h.t, v: h.c })));
  const c = last.c, mid = (rules.egoLane[0] + rules.egoLane[1]) / 2;
  const side = c > mid ? 'DERECHA' : 'IZQUIERDA';
  const towardEgo = Math.abs(c - mid) > 0.02 && ((side === 'DERECHA' && vc < 0) || (side === 'IZQUIERDA' && vc > 0));
  out.lateral = vc;
  const closing = out.ttcS !== null;
  let raw = 'VERDE';
  const reasons = [];
  if (closing && out.ttcS <= rules.redTtcS && zone === 'TU_CARRIL') { raw = 'ROJO'; reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
  else if (closing && out.ttcS <= rules.amberTtcS) { raw = 'AMBAR'; reasons.push(`se acerca: ${out.ttcS.toFixed(1)} s`); }
  if (towardEgo && Math.abs(vc) >= rules.cutInSpeed) { raw = raw === 'ROJO' ? 'ROJO' : 'AMBAR'; reasons.push(side === 'DERECHA' ? 'se mete desde la derecha' : 'se mete desde la izquierda'); }
  k.streak = raw !== 'VERDE' ? (k.streak ?? 0) + 1 : 0;
  const needFrames = rules.confirmFrames ?? RULES.confirmFrames;
  if (k.streak >= needFrames) { out.level = raw; out.reasons = reasons; }
  return out;
}

/** El aviso más importante del fotograma (para voz o vibración), o null. */
export function topAlert(objects) {
  const rank = { ROJO: 2, AMBAR: 1, VERDE: 0 };
  return objects.filter((o) => o.level !== 'VERDE').sort((a, b) => rank[b.level] - rank[a.level] || (a.ttcS ?? 99) - (b.ttcS ?? 99))[0] ?? null;
}

