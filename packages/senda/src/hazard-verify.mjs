/**
 * Verificación de avisos con la cámara de quien pasa (estilo «¿puedes confirmarlo?» de Waze, pero viendo).
 * El reconocimiento lo hace un modelo en el propio móvil (EfficientDet-Lite0, COCO, Apache-2.0); aquí solo
 * se decide qué significan sus detecciones para un aviso. La imagen NUNCA sale del móvil: solo la etiqueta.
 *
 * Límite del modelo (declarado): COCO tiene vehículos, personas, animales y objetos comunes, pero NO piedras,
 * neumáticos, cajas sueltas ni escombros. Esos avisos quedan «no verificables con este modelo».
 * Una cámara que ve un coche no confirma un accidente: solo es «compatible». Nunca se afirma más de lo visto.
 */

export const GROUPS = Object.freeze({
  vehicle: { label: 'Vehículo', classes: ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'train'] },
  person: { label: 'Persona', classes: ['person'] },
  animal: { label: 'Animal', classes: ['dog', 'horse', 'sheep', 'cow', 'cat', 'bird', 'bear', 'elephant', 'zebra', 'giraffe'] },
  object: { label: 'Objeto', classes: ['suitcase', 'backpack', 'handbag', 'umbrella', 'chair', 'bench', 'potted plant', 'sports ball', 'skateboard', 'surfboard', 'skis', 'snowboard', 'bottle'] },
});

/** Clase COCO → nombre en español (solo las que importan en carretera). */
export const ES = Object.freeze({
  car: 'coche', truck: 'camión', bus: 'autobús', motorcycle: 'moto', bicycle: 'bicicleta', train: 'tren', person: 'persona',
  dog: 'perro', horse: 'caballo', sheep: 'oveja', cow: 'vaca', cat: 'gato', bird: 'ave', bear: 'oso', elephant: 'elefante', zebra: 'cebra', giraffe: 'jirafa',
  suitcase: 'maleta', backpack: 'mochila', handbag: 'bolso', umbrella: 'paraguas', chair: 'silla', bench: 'banco', 'potted plant': 'maceta',
  'sports ball': 'balón', skateboard: 'monopatín', surfboard: 'tabla de surf', skis: 'esquís', snowboard: 'tabla de nieve', bottle: 'botella',
});

/** Qué grupos de objetos son compatibles con cada tipo de aviso de SENDA (`REPORT_KINDS`). */
export const EXPECTS = Object.freeze({
  accidente: ['vehicle'], parado: ['vehicle'], arcen: ['vehicle'], retencion: ['vehicle'], animal: ['animal'], obstaculo: ['object'],
  niebla: null, hielo: null, obras: null, // no son objetos: el modelo no puede verificarlos
});

const groupOf = (cls) => Object.keys(GROUPS).find((g) => GROUPS[g].classes.includes(cls)) ?? null;

/**
 * Decide sobre un aviso a partir de las detecciones de varios fotogramas.
 * detections: [{ label, score }] (clase COCO en inglés y confianza 0–1).
 * minScore: umbral de confianza ELEGIDO por quien llama (no hay valor por defecto: no está calibrado).
 * minFrames: cuántos fotogramas deben coincidir (también lo elige quien llama).
 */
export function verifyReport(kind, frames, { minScore, minFrames } = {}) {
  if (!(minScore > 0 && minScore < 1)) throw new Error('minScore es obligatorio (umbral no calibrado: decídelo y decláralo)');
  if (!(minFrames >= 1)) throw new Error('minFrames es obligatorio');
  if (!(kind in EXPECTS)) throw new Error(`tipo de aviso desconocido: ${kind}`);
  const want = EXPECTS[kind];
  const counts = new Map();
  for (const dets of frames) {
    const seen = new Set(dets.filter((d) => d.score >= minScore && groupOf(d.label)).map((d) => d.label));
    for (const l of seen) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const stable = [...counts].filter(([, n]) => n >= minFrames).map(([label, n]) => ({ label, es: ES[label] ?? label, group: groupOf(label), frames: n }))
    .sort((a, b) => b.frames - a.frames);
  const best = (g) => stable.find((s) => s.group === g);
  if (!want) return { verdict: 'NO_VERIFICABLE', reason: 'Este tipo de aviso no es un objeto: el modelo no puede verlo', seen: stable, sharesImage: false };
  const hit = want.map(best).find(Boolean);
  if (hit) return { verdict: 'COMPATIBLE', label: hit.label, es: hit.es, group: hit.group, frames: hit.frames, seen: stable, sharesImage: false,
    note: kind === 'accidente' ? 'Se ve un vehículo; la cámara no puede confirmar que haya un accidente' : null };
  if (kind === 'obstaculo') return { verdict: 'NO_VERIFICABLE', reason: 'El modelo no reconoce piedras, neumáticos ni escombros', seen: stable, sharesImage: false };
  return { verdict: 'NO_VISTO', seen: stable, sharesImage: false };
}
