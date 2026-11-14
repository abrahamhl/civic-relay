/**
 * SENDA · Cordón de cámaras: comprobación perimetral de una hipótesis de emergencia.
 *
 * Alrededor de un suceso (accidente, corte, incendio, inundación) se reparte el entorno en sectores (por defecto 8:
 * N, NE, E, SE, S, SO, O, NO) y se busca en cada uno la cámara pública más cercana. Así se ve de un vistazo:
 *  - qué sectores se pueden COMPROBAR visualmente y cuáles están CIEGOS;
 *  - qué dicen las señales MEDIDAS de cada cámara (imagen viva, movimiento entre capturas, vehículos contados).
 *
 * Veracidad (CLAUDE.md §1):
 *  - Una cámara aporta CONTEXTO e INDICIOS, nunca una confirmación del suceso: no se dice «confirmado».
 *  - Todos los umbrales están en SIGNAL_RULES y son decisiones de SENDA, declaradas y revisables.
 *  - Sin señal medida, la cámara cuenta como «sin medir», no como «normal».
 */
import { haversineM } from './atlas.mjs';

export const SECTORS_8 = Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']);

/** Rumbo inicial (grados desde el norte, 0–360) de a hacia b. */
export function bearingDeg(a, b) {
  const r = Math.PI / 180, φ1 = a.lat * r, φ2 = b.lat * r, Δλ = (b.lon - a.lon) * r;
  const y = Math.sin(Δλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

/**
 * Cordón: reparte las cámaras del radio en sectores centrados en los rumbos cardinales.
 * cams: [{id, lat, lon, ...}] · devuelve sectores con sus cámaras ordenadas por distancia.
 */
export function cameraRing(center, cams, { radiusKm = 15, sectors = 8, perSector = 2 } = {}) {
  if (!(radiusKm > 0) || !(sectors >= 4)) throw new Error('radiusKm > 0 y al menos 4 sectores');
  const width = 360 / sectors, names = sectors === 8 ? SECTORS_8 : Array.from({ length: sectors }, (_, i) => `${Math.round(i * width)}°`);
  const out = names.map((name, i) => ({ i, name, from: (i * width - width / 2 + 360) % 360, to: (i * width + width / 2) % 360, cams: [] }));
  for (const c of cams) {
    const dKm = haversineM(center, c) / 1000; if (dKm > radiusKm) continue;
    const brg = bearingDeg(center, c), k = Math.floor(((brg + width / 2) % 360) / width);
    out[k].cams.push({ ...c, dKm: Math.round(dKm * 100) / 100, bearing: Math.round(brg) });
  }
  for (const s of out) { s.cams.sort((a, b) => a.dKm - b.dKm); s.total = s.cams.length; s.cams = s.cams.slice(0, perSector); }
  const covered = out.filter((s) => s.total > 0);
  return { center: { lat: center.lat, lon: center.lon }, radiusKm, sectors: out, covered: covered.length, blind: out.filter((s) => !s.total).map((s) => s.name), coverage: covered.length / sectors };
}

/**
 * Reglas declaradas para leer una cámara (decisiones de SENDA, no estándares):
 *  - freshMaxAgeS: la imagen se considera VIVA si su Last-Modified tiene como mucho esta antigüedad.
 *  - motionMin: fracción media de cambio de píxeles (gris, 0–1) entre dos capturas para hablar de «movimiento».
 *  - vehiclesFlowMin: vehículos detectados por YOLOX en la captura para hablar de «tráfico presente».
 */
export const SIGNAL_RULES = Object.freeze({ freshMaxAgeS: 600, motionMin: 0.02, vehiclesFlowMin: 3 });

/**
 * Estado de una cámara a partir de señales MEDIDAS:
 * sig = { placeholder?: bool, ageS?: number, motion?: number (0–1), vehicles?: number }
 */
export function classifyCamera(sig, rules = SIGNAL_RULES) {
  if (!sig) return { state: 'SIN_MEDIR', note: 'sin capturas medidas' };
  if (sig.placeholder) return { state: 'SIN_IMAGEN', note: 'la fuente muestra su aviso de «imagen no disponible»' };
  if (!(sig.ageS <= rules.freshMaxAgeS)) return { state: 'DESACTUALIZADA', note: `última imagen hace ${Math.round(sig.ageS ?? NaN)} s (> ${rules.freshMaxAgeS} s)` };
  const moving = Number.isFinite(sig.motion) ? sig.motion >= rules.motionMin : null, traffic = Number.isFinite(sig.vehicles) ? sig.vehicles >= rules.vehiclesFlowMin : null;
  return { state: 'VIVA', moving, traffic, note: `imagen de hace ${Math.round(sig.ageS)} s${Number.isFinite(sig.vehicles) ? ` · ${sig.vehicles} vehículo(s)` : ''}${Number.isFinite(sig.motion) ? ` · cambio ${(100 * sig.motion).toFixed(1)} %` : ''}` };
}

/**
 * Evaluación perimetral: cuántos sectores se pueden comprobar visualmente AHORA y qué indican sus cámaras.
 * signals: Map|objeto id → sig. road (opcional): carretera del suceso para leer las cámaras de esa misma vía.
 * Devuelve frases calculadas, nunca «confirmado».
 */
export function perimeterAssessment(ring, signals = {}, { road = null, rules = SIGNAL_RULES } = {}) {
  const get = (id) => (signals instanceof Map ? signals.get(id) : signals[id]);
  const sectors = ring.sectors.map((s) => { const cams = s.cams.map((c) => ({ ...c, reading: classifyCamera(get(c.id), rules) }));
    return { name: s.name, total: s.total, cams, live: cams.some((c) => c.reading.state === 'VIVA') }; });
  const live = sectors.filter((s) => s.live).map((s) => s.name), measured = sectors.flatMap((s) => s.cams).filter((c) => c.reading.state !== 'SIN_MEDIR');
  const sameRoad = road ? sectors.flatMap((s) => s.cams).filter((c) => c.reading.state === 'VIVA' && c.carretera && norm(c.carretera) === norm(road)) : [];
  const statements = [`Comprobable visualmente ahora en ${live.length} de ${sectors.length} sectores${live.length ? ` (${live.join(', ')})` : ''}.`];
  if (ring.blind.length) statements.push(Number.isFinite(ring.radiusKm) ? `Sectores ciegos (sin cámara en ${ring.radiusKm} km): ${ring.blind.join(', ')}.` : `Sectores sin cámara aportada: ${ring.blind.join(', ')}.`);
  if (!measured.length) statements.push('Ninguna cámara del cordón tiene capturas medidas: solo hay cobertura, no lectura.');
  let roadReading = null;
  if (road) {
    if (!sameRoad.length) roadReading = { verdict: 'SIN_DATOS', text: `No hay cámaras vivas de la ${road} en el cordón.` };
    else {
      const flow = sameRoad.filter((c) => c.reading.traffic || c.reading.moving), still = sameRoad.filter((c) => c.reading.traffic === false && c.reading.moving === false);
      roadReading = flow.length ? { verdict: 'TRAFICO_PRESENTE', text: `En ${flow.length} de ${sameRoad.length} cámara(s) vivas de la ${road} hay vehículos o movimiento: indicio de que la vía no está cortada en ese punto (no lo prueba).` }
        : still.length === sameRoad.length ? { verdict: 'SIN_MOVIMIENTO', text: `Las ${sameRoad.length} cámara(s) vivas de la ${road} no muestran vehículos ni movimiento: compatible con vía vacía o detenida (también con poco tráfico o de noche).` }
          : { verdict: 'NO_CONCLUYENTE', text: `Las cámaras vivas de la ${road} no dan una lectura clara.` };
    }
    statements.push(roadReading.text);
  }
  return { sectors, liveSectors: live, blindSectors: ring.blind, measuredCameras: measured.length, roadReading, statements, rules };
}

const norm = (r) => String(r).toUpperCase().replace(/\s+/g, '').replace(/–/g, '-');
