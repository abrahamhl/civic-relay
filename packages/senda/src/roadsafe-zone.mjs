/**
 * SENDA RoadSafe · Plan dinámico de señalización de la zona de incidente.
 *
 * Estructura de áreas (marco FHWA MUTCD Parte 6, «Traffic Incident Management Area»; en España rigen la
 * Instrucción 8.3-IC y la regulación de la DGT, cuyos valores NO se incorporan aquí):
 *   aviso anticipado → transición (si se ocupa carril) → resguardo → espacio del incidente → terminación.
 *
 * Longitudes:
 *  - Resguardo: distancia de frenado (sin reacción) a la velocidad de aproximación con adherencia de
 *    cálculo — FÍSICA.
 *  - Transición (estrechamiento): fórmula MUTCD L = W·S (S ≥ 45 mph, L y W en pies) convertida a métrico:
 *    L[m] = W[m] · S[km/h] / 1,609 — REFERENCIA EXTRANJERA, a sustituir por 8.3-IC en España.
 *  - Aviso anticipado: máximo de (a) referencia MUTCD (≈450 m carretera abierta; ≈1 570 m autovía, suma de
 *    separaciones de la Tabla 6C-1 2009 — a verificar), (b) 3 × distancia de parada a v85, (c) cola
 *    proyectada + distancia de parada. La cola crece: el aviso se MUEVE con ella.
 *  - Cola: onda de choque LWR con diagrama fundamental triangular; capacidad por carril, densidad de
 *    atasco y velocidad de la onda de congestión son HIPÓTESIS típicas declaradas (EXAMPLE_QUEUE_PARAMS; hay que pasarlos en traffic.queueParams).
 *
 * Salidas: áreas con s (m) sobre la vía, polilíneas en sentido de circulación (requisito CIFS), banda de
 * aviso útil para apps/navegadores (ventana 4–90 s de la política), paneles PMV aguas arriba con texto
 * PROPUESTO (aprobación del centro de tráfico obligatoria) y recomendaciones para intervinientes.
 */
import { pointAt, pkAt } from './road-guard.mjs';
import { stoppingDistance, G } from './roadsafe-secondary-risk.mjs';
import { WARNING_POLICY } from './roadsafe-secondary-risk.mjs';

/** Parámetros de cola de EJEMPLO (sin fuente verificada): deben declararse; no son valor por defecto. */
export const EXAMPLE_QUEUE_PARAMS = Object.freeze({ capacityPerLaneVehH: 1900, jamDensityPerLaneVehKm: 140, congestedWaveKmh: 18, provenance: 'HYPOTHETICAL (valores típicos de manual; no verificados)' });
export const MUTCD_REF = Object.freeze({ openRoadAdvanceM: 457, freewayAdvanceM: 1567, note: 'MUTCD 2009 (Cap. 6C/6I, Tabla 6C-1): referencia extranjera, verificar edición vigente.' });

/**
 * Cola por onda de choque (LWR, triangular). Devuelve velocidad de la onda (km/h, negativa = aguas arriba)
 * y longitud de cola a cada minuto, o 0 si la demanda cabe por los carriles abiertos.
 */
export function queueProjection({ flowVehH, lanes = 2, lanesOpen = 1, freeKmh = 100, minutes = [5, 10, 20, 30, 45, 60], params = null } = {}) {
  if (!params) return { forms: null, reason: 'parámetros de cola no declarados (no medidos)', points: [] };
  if (![flowVehH, lanes, lanesOpen, freeKmh].every(Number.isFinite) || lanes <= 0) return { forms: null, reason: 'datos de tráfico insuficientes', points: [] };
  const capOpen = params.capacityPerLaneVehH * Math.max(0, lanesOpen);
  if (flowVehH <= capOpen) return { forms: false, shockKmh: 0, points: minutes.map((t) => ({ t, queueM: 0 })) };
  const q1 = flowVehH, k1 = q1 / freeKmh;                                 // estado aguas arriba (fluido)
  const kJam = params.jamDensityPerLaneVehKm * lanes, q2 = capOpen;         // estado en cola (rama congestionada)
  const k2 = kJam - q2 / params.congestedWaveKmh;
  const w = (q2 - q1) / (k2 - k1);                                          // km/h
  return { forms: true, shockKmh: +w.toFixed(2), points: minutes.map((t) => ({ t, queueM: Math.round(Math.abs(w) * 1000 * t / 60) })), params: params.provenance };
}

const along = (road, s0, s1, dir, stepM = 50) => {
  // puntos de s0 a s1 recorridos en el SENTIDO DE CIRCULACIÓN (dir=+1: s creciente)
  const a = Math.min(s0, s1), b = Math.max(s0, s1), pts = [];
  for (let s = a; s <= b; s += stepM) pts.push({ s, ...pointAt(road, s) });
  if (pts.length === 0 || pts[pts.length - 1].s !== b) pts.push({ s: b, ...pointAt(road, b) });
  return dir > 0 ? pts : pts.reverse();
};

/**
 * Plan de zona. inc: { s, dir:±1, laneBlocked:'SHOULDER'|'PARTIAL'|'FULL', lanes, laneWidthM }
 * traffic: { speedLimitKmh, v85Kmh, flowVehH, wet, night, minutesElapsed }
 * vms: [{ id, s, dir }] posiciones de paneles en la vía (opcional).
 */
export function planIncidentZone(road, inc, traffic = {}, { vms = [] } = {}) {
  const dir = inc.dir === -1 ? -1 : 1, up = (m) => inc.s - dir * m; // aguas arriba = contra el sentido
  const vLim = traffic.speedLimitKmh ?? 100, v85 = traffic.v85Kmh ?? vLim, v = v85 / 3.6;
  const mu = traffic.wet ? 0.45 : 0.75, aEm = 0.9 * mu * G, prt = 1.25; // μ: rango de manual; reacción: Green (2000). La noche NO altera la reacción (sin fuente)
  const dStop = stoppingDistance({ vMs: v, reactS: prt, aEffMs2: aEm });
  const lanes = inc.lanes ?? 2, laneW = inc.laneWidthM ?? 3.5;
  const blocking = inc.laneBlocked === 'PARTIAL' || inc.laneBlocked === 'FULL';
  const lanesOpen = inc.laneBlocked === 'FULL' ? lanes - 1 : inc.laneBlocked === 'PARTIAL' ? lanes - 0.5 : lanes;
  const incidentLen = inc.incidentLengthM ?? 30;
  const bufferM = Math.round((v * v) / (2 * aEm));
  const taperM = blocking ? Math.round((laneW * vLim) / 1.609) : 0;
  const q = queueProjection({ flowVehH: traffic.flowVehH, lanes, lanesOpen, freeKmh: v85, params: traffic.queueParams ?? null });
  const tNow = traffic.minutesElapsed ?? 0;
  const queueNowM = q.forms ? Math.round(Math.abs(q.shockKmh) * 1000 * tNow / 60) : 0;
  const ref = vLim >= 100 ? MUTCD_REF.freewayAdvanceM : MUTCD_REF.openRoadAdvanceM;
  const advanceM = Math.round(Math.max(ref, 3 * dStop, queueNowM + dStop));
  // posiciones (distancias aguas arriba desde el inicio del espacio del incidente)
  const sIncStart = up(0), sBuf = up(bufferM), sTap = up(bufferM + taperM), sAdv = up(bufferM + taperM + advanceM);
  const sTerm = inc.s + dir * (incidentLen + 100);
  const firstHazardUpM = Math.max(queueNowM, 0); // la cola es el primer peligro que encuentra quien llega
  const warnBand = { fromUpM: Math.round(firstHazardUpM + v * WARNING_POLICY.tMinS), toUpM: Math.round(firstHazardUpM + v * WARNING_POLICY.tMaxS), basis: `ventana ${WARNING_POLICY.tMinS}–${WARNING_POLICY.tMaxS} s a v85=${v85} km/h desde el primer peligro (cola o escena)` };
  const areas = [
    { id: 'ADVANCE_WARNING', from: sAdv, to: sTap, lengthM: advanceM, basis: `máx(ref. ${ref} m, 3×parada ${Math.round(3 * dStop)} m, cola ${queueNowM} m + parada)` },
    ...(blocking ? [{ id: 'TRANSITION', from: sTap, to: sBuf, lengthM: taperM, basis: 'L = W·S (MUTCD, referencia extranjera)' }] : []),
    { id: 'BUFFER', from: sBuf, to: sIncStart, lengthM: bufferM, basis: `frenado a v85 con μ=${mu}` },
    { id: 'INCIDENT_SPACE', from: sIncStart, to: inc.s + dir * incidentLen, lengthM: incidentLen, basis: 'vehículos implicados y asistencia' },
    { id: 'TERMINATION', from: inc.s + dir * incidentLen, to: sTerm, lengthM: 100, basis: 'reincorporación' },
  ].map((a) => ({ ...a, from: Math.round(a.from), to: Math.round(a.to), pkFrom: pkAt(road, a.from), pkTo: pkAt(road, a.to), polyline: along(road, a.from, a.to, dir) }));
  const zoneStartS = sAdv;
  const panels = vms.filter((p) => (p.dir ?? dir) === dir && (dir > 0 ? p.s < zoneStartS && p.s >= zoneStartS - 5000 : p.s > zoneStartS && p.s <= zoneStartS + 5000))
    .map((p) => ({ id: p.id, s: p.s, distanceToIncidentM: Math.round(Math.abs(inc.s - p.s)), proposedText: vmsText({ distKm: Math.abs(inc.s - p.s) / 1000, laneBlocked: inc.laneBlocked, queue: q.forms }), status: 'PROPOSED_FOR_OPERATOR_APPROVAL' }));
  return {
    schema: 'senda-roadsafe-zone/1', roadId: road.id, dir, incidentS: inc.s, pk: pkAt(road, inc.s),
    physics: { v85Kmh: v85, mu, prtS: prt, dStopM: Math.round(dStop) },
    queue: { ...q, nowM: queueNowM, minutesElapsed: tNow }, areas, warnBand, panels,
    responders: responderGuidance(inc, { bufferM, blocking }),
    disclaimer: 'Plan PROPUESTO para el centro de tráfico y los intervinientes. No modifica señalización real. Valores extranjeros (MUTCD) a sustituir por la norma española aplicable.',
  };
}

export function vmsText({ distKm, laneBlocked, queue }) {
  const d = distKm < 1 ? `${Math.round(distKm * 10) * 100} M` : `${distKm.toFixed(0)} KM`;
  const l1 = laneBlocked === 'FULL' ? 'CARRIL CERRADO' : laneBlocked === 'PARTIAL' ? 'CARRIL OCUPADO' : 'VEH. DETENIDO';
  // Líneas ≤ 20 caracteres sin cortar palabras (la longitud real depende de cada panel: a validar con el centro).
  return [`${l1} ${d}`, queue ? 'RETENCION PRECAUCION' : 'ARCEN OCUPADO'];
}

function responderGuidance(inc, { bufferM, blocking }) {
  return [
    { to: 'GRUA/ASISTENCIA', text: `Situar el vehículo de bloqueo aguas arriba, dejando ≈${Math.min(bufferM, 60)} m de resguardo si es seguro; luces de emergencia encendidas desde la aproximación.`, basis: 'práctica TIM (vehículo de bloqueo); distancia a validar con 8.3-IC/DGT' },
    { to: 'TAXI/RECOGIDA', text: 'Aproximar con antelación y luces de emergencia; decelerar progresivamente; no frenar en carril; detenerse en el arcén por delante del vehículo averiado si hay espacio, para que los ocupantes no crucen el tráfico.', basis: 'mitigación de C4 (caso de investigación) — HIPÓTESIS a validar con expertos de seguridad vial' },
    { to: 'OCUPANTES', text: 'Esperar tras la barrera o lejos de la calzada, nunca entre vehículos ni en la línea de empuje.', basis: 'C3/C5' },
    ...(blocking ? [{ to: 'CENTRO_DE_TRAFICO', text: 'Carril ocupado: valorar cierre de carril y aviso en paneles aguas arriba.', basis: 'C1' }] : []),
  ];
}

/** Incidente CIFS con la polilínea del área de aviso anticipado (primer punto en sentido de circulación). */
export function zoneCifsPolyline(plan) {
  const adv = plan.areas.find((a) => a.id === 'ADVANCE_WARNING'), inc = plan.areas.find((a) => a.id === 'INCIDENT_SPACE');
  const pts = [...adv.polyline, ...inc.polyline].filter((p, i, a) => i === 0 || p.s !== a[i - 1].s);
  return pts.map((p) => ({ lat: p.lat, lon: p.lon }));
}
