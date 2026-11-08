/**
 * SENDA · Infraestructura de la DGT en la vía: qué se puede sumar a SENDA, cómo y qué no.
 *
 * Validación (05-11-2026). Radares, paneles, cámaras, estaciones de aforo, postes SOS y balizas V16 son
 * equipos de terceros. Algunos emiten (el radar Doppler emite microondas; la V16, por su red móvil) y
 * todos se comunican con la DGT por canales propios y cerrados. NINGUNO es una pasarela que SENDA pueda
 * usar para transmitir: entrar en ellos o usar su radio sería acceder a un sistema ajeno.
 * Lo que sí se suma es lo que la DGT PUBLICA (ubicaciones, estados, medidas) y lo que se pacte por
 * convenio (DGT 3.0). Con los radares hay además dos límites legales en España: los DETECTORES están
 * prohibidos desde 2014 (multa y 3 puntos) y los INHIBIDORES se sancionan con hasta 6.000 € y 6 puntos.
 * Avisar de la ubicación de un radar fijo publicado por la DGT es lícito, y así lo hacen los navegadores.
 * Decisión de diseño: SENDA no publica controles móviles de la policía. Quiere ser socio de la DGT, no
 * una herramienta para esquivarla.
 */
import { queueTail, shockwaveKmh } from './drive-cases.mjs';

export const DGT_INFRA = Object.freeze([
  { id: 'radar-fijo', name: 'Radar fijo', emits: 'Microondas (Doppler) o láser para medir la velocidad; envía las denuncias a la DGT por su propio canal', gateway: false, senda: 'Ubicación publicada por la DGT (vía, PK, sentido) como zona de control y punto de riesgo, con el límite de velocidad', access: 'PASIVO', legal: 'Avisar de su ubicación publicada es lícito' },
  { id: 'radar-tramo', name: 'Radar de tramo', emits: 'Dos pórticos que calculan la velocidad media entre entrada y salida', gateway: false, senda: 'Tramos publicados: media propia y aviso si supera el límite (nunca sugerir ir por encima del límite)', access: 'PASIVO', legal: 'SENDA no lee matrículas' },
  { id: 'detectar-radar', name: 'Detectar o inhibir las emisiones de un radar', emits: '—', gateway: false, senda: 'Nada', access: 'NUNCA', legal: 'Detectores prohibidos desde 2014 (multa y 3 puntos); inhibidores, hasta 6.000 € y 6 puntos' },
  { id: 'radar-movil', name: 'Radares móviles, helicópteros Pegasus y drones de vigilancia', emits: 'Equipos de control sin ubicación publicada', gateway: false, senda: 'Nada: SENDA no publica controles de la policía', access: 'NUNCA', legal: 'Decisión de diseño de SENDA, no prohibición legal' },
  { id: 'paneles', name: 'Paneles de mensaje variable', emits: 'Texto en la vía; su estado se publica en DATEX II', gateway: false, senda: 'Leer su mensaje (accidente, niebla, retención) y convertirlo en aviso; mostrar avisos de SENDA verificados en los paneles solo con convenio', access: 'PASIVO', legal: 'Escribir en ellos: solo la DGT (convenio DGT 3.0)' },
  { id: 'camaras', name: 'Cámaras de tráfico', emits: 'Imagen hacia el centro de gestión', gateway: false, senda: 'Ubicaciones publicadas; visibilidad y nieve en las que se publican para reutilizarse', access: 'PASIVO', legal: 'Nunca personas ni matrículas' },
  { id: 'aforos', name: 'Estaciones de toma de datos (espiras y sensores)', emits: 'Caudal y velocidad por carril hacia el centro de gestión', gateway: false, senda: 'Caudal y velocidad para localizar el final de una retención y su onda de choque', access: 'PASIVO', legal: 'Disponibilidad abierta en España pendiente de verificar en el NAP; en Países Bajos, NDW publica velocidades' },
  { id: 'v16', name: 'Balizas V16 conectadas', emits: 'Su posición por la red móvil a DGT 3.0', gateway: false, senda: 'Cruzarlas con SENDA: la baliza dice dónde, SENDA dice qué pasa', access: 'CONVENIO', legal: 'Nunca usar su SIM ni su radio' },
  { id: 'postes-sos', name: 'Postes SOS', emits: 'Línea propia con el centro de atención', gateway: false, senda: 'Si existe un listado, el poste más cercano por la vía como salida cuando no hay ninguna red', access: 'PASIVO', legal: 'La DGT anunció en 2010 la retirada de la mayoría y dejar los de poca cobertura; listado actual pendiente' },
  { id: 'dgt30', name: 'Plataforma DGT 3.0', emits: 'Intercambio de datos con vehículos y navegadores', gateway: true, senda: 'El canal oficial para enviar y recibir avisos: el que convierte a SENDA en parte del sistema', access: 'CONVENIO', legal: 'Requiere acuerdo con la DGT' },
]);

const toKmh = (ms) => ms * 3.6;
/** Zona de control publicada a `distM`: deceleración para llegar al límite y aviso (lo mismo que hace un navegador). */
export function speedZoneAdvice({ vKmh, limitKmh, distM }) {
  if (vKmh <= limitKmh) return { over: false, say: null };
  const v = vKmh / 3.6, l = limitKmh / 3.6, a = (v * v - l * l) / (2 * Math.max(1, distM));
  return { over: true, decelMs2: +a.toFixed(2), say: `Límite ${limitKmh} km/h en ${Math.round(distM)} m: reduce ${Math.round(vKmh - limitKmh)} km/h` };
}
/**
 * Radar de tramo: velocidad media hasta ahora. Nunca propone ir por encima del límite para «compensar»:
 * el límite rige en cada punto, no solo en la media.
 */
export function sectionAverage({ travelledM, elapsedS, limitKmh }) {
  const avg = toKmh(travelledM / Math.max(1, elapsedS));
  return { avgKmh: Math.round(avg), over: avg > limitKmh, say: avg > limitKmh ? `Tu media en el tramo es ${Math.round(avg)} km/h y el límite ${limitKmh}: reduce` : null };
}

/**
 * Estaciones de aforo a lo largo de la vía (ordenadas en el sentido de la marcha): dónde empieza la cola
 * y a qué velocidad crece hacia atrás, con los caudales y velocidades de las estaciones a cada lado.
 */
export function detectorQueue(sites, { slowKmh = 30 } = {}) {
  const tail = queueTail(sites.map((x) => ({ s: x.s, vKmh: x.speedKmh })), { slowKmh });
  if (!tail) return null;
  const down = sites.find((x) => x.s === tail.sTail), up = sites.filter((x) => x.s < tail.sTail).sort((a, b) => b.s - a.s)[0];
  const w = up && down && up.speedKmh > down.speedKmh ? shockwaveKmh({ qUp: up.flowVehH, vUp: up.speedKmh, qDown: down.flowVehH, vDown: down.speedKmh }) : null;
  return { sTail: tail.sTail, between: up ? [up.id, down.id] : [down.id], wKmh: w, growing: w != null && w < 0 };
}

/** Palabras de los paneles (es y nl) → peligro SENDA. */
const VMS_WORDS = [
  [/ACCIDENTE|ONGEVAL/, 'CRASH'], [/NIEBLA|MIST/, 'FOG'], [/HIELO|NIEVE|GLADHEID|SNEEUW/, 'ICE'], [/RETENCI[OÓ]N|FILE\b/, 'QUEUE'],
  [/OBRAS|WERK IN UITVOERING/, 'WORKS'], [/CARRIL (IZQ|DCHO|DER|CENTRAL).*CERRADO|CARRIL CERRADO|RIJSTROOK DICHT/, 'LANE_CLOSED'], [/SENTIDO CONTRARIO|SPOOKRIJDER/, 'WRONG_WAY'],
  [/VEH[IÍ]CULO (DETENIDO|PARADO)|PECHGEVAL/, 'STOPPED'], [/ANIMAL|DIEREN/, 'ANIMAL'], [/INCENDIO|BRAND/, 'FIRE'], [/INUNDA|WATEROVERLAST/, 'FLOOD'],
];
export function vmsToHazard(lines) {
  const t = lines.join(' ').toUpperCase(); const hit = VMS_WORDS.find(([re]) => re.test(t));
  return hit ? hit[1] : null;
}
