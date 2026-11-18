/**
 * SENDA RoadSafe · Física del impacto: Δv, impulso, momento angular, trayectoria tras el choque y
 * envolvente de peligro (dónde pueden acabar los vehículos y qué carriles pueden quedar afectados).
 *
 * Modelo (cuerpo rígido plano, impulsivo — enfoque clásico de reconstrucción de accidentes):
 *  - Dos vehículos i=1,2 con masa m, momento de inercia de guiñada I = m·k² (k: radio de giro), velocidad
 *    del centro de masas v y velocidad angular ω. Contacto en el punto P con normal n.
 *  - Impulso normal J = −(1+e)·(v_rel·n) / (1/m1 + 1/m2 + (r1×n)²/I1 + (r2×n)²/I2), con v_rel la velocidad
 *    relativa en P (incluye ω×r). Rozamiento tangencial ignorado (hipótesis conservadora documentada).
 *  - Tras el impulso: Δv_i = ±J·n/m_i, Δω_i = ±(r_i×J·n)/I_i  ⇒  conservación del momento lineal y angular.
 *  - Fase posterior: deslizamiento con deceleración μ·g·η_post y frenado de guiñada por rozamiento
 *    (ω decae con dω/dt = −c_ω·μ·g/k), integrada hasta el reposo.
 * Incertidumbre: Monte Carlo sobre e, μ, k, ángulo y punto de contacto ⇒ mapa de ocupación de carriles.
 * Gravedad: Δv por vehículo en bandas ORIENTATIVAS (umbrales HIPOTÉTICOS a calibrar con datos EDR).
 * Nada de esto sustituye una reconstrucción pericial; sirve para PREVER la zona de peligro en segundos.
 */
import { rng, normal, uniform, G } from './roadsafe-secondary-risk.mjs';

const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;

export const VEHICLE_PRESETS = Object.freeze({
  car: { mass: 1500, k: 1.25, length: 4.5, width: 1.8 },
  taxi: { mass: 1650, k: 1.3, length: 4.7, width: 1.8 },
  van: { mass: 2500, k: 1.5, length: 5.3, width: 2.0 },
  hgv: { mass: 18000, k: 3.5, length: 12, width: 2.55 },
}); // masas y radios de giro TÍPICOS (HIPÓTESIS); sustituir por datos del vehículo cuando existan

/**
 * Impacto plano. veh: { mass, k, pos:{x,y}, vel:{x,y}, omega }, contact: { p:{x,y}, n:{x,y} (unitaria de 1→2) }
 * Unidades SI. Devuelve estados posteriores, J, Δv y comprobación de conservación.
 */
export function planarImpact(v1, v2, { p, n }, { e = 0.1 } = {}) {
  const I1 = v1.mass * v1.k ** 2, I2 = v2.mass * v2.k ** 2;
  const r1 = { x: p.x - v1.pos.x, y: p.y - v1.pos.y }, r2 = { x: p.x - v2.pos.x, y: p.y - v2.pos.y };
  const vp1 = { x: v1.vel.x - v1.omega * r1.y, y: v1.vel.y + v1.omega * r1.x }, vp2 = { x: v2.vel.x - v2.omega * r2.y, y: v2.vel.y + v2.omega * r2.x };
  const vrel = { x: vp1.x - vp2.x, y: vp1.y - vp2.y }, vn = dot(vrel, n);
  if (vn <= 0) return { impact: false, reason: 'los cuerpos se separan en el punto de contacto' };
  const denom = 1 / v1.mass + 1 / v2.mass + cross(r1, n) ** 2 / I1 + cross(r2, n) ** 2 / I2;
  const J = (1 + e) * vn / denom, Jv = { x: J * n.x, y: J * n.y };
  const a1 = { ...v1, vel: { x: v1.vel.x - Jv.x / v1.mass, y: v1.vel.y - Jv.y / v1.mass }, omega: v1.omega - cross(r1, Jv) / I1 };
  const a2 = { ...v2, vel: { x: v2.vel.x + Jv.x / v2.mass, y: v2.vel.y + Jv.y / v2.mass }, omega: v2.omega + cross(r2, Jv) / I2 };
  const dv = (a, b) => Math.hypot(a.vel.x - b.vel.x, a.vel.y - b.vel.y);
  // comprobación: momento lineal y angular respecto al origen se conservan
  const Lin = (s) => ({ x: s.mass * s.vel.x, y: s.mass * s.vel.y }), Ang = (s) => s.mass * cross(s.pos, s.vel) + s.mass * s.k ** 2 * s.omega;
  const P0 = { x: Lin(v1).x + Lin(v2).x, y: Lin(v1).y + Lin(v2).y }, P1 = { x: Lin(a1).x + Lin(a2).x, y: Lin(a1).y + Lin(a2).y };
  const L0 = Ang(v1) + Ang(v2), L1 = Ang(a1) + Ang(a2);
  return { impact: true, J: +J.toFixed(1), after: [a1, a2], deltaV: [+dv(a1, v1).toFixed(3), +dv(a2, v2).toFixed(3)], conservation: { linearErr: Math.hypot(P1.x - P0.x, P1.y - P0.y), angularErr: Math.abs(L1 - L0) } };
}

/** Bandas orientativas de gravedad por Δv (km/h). HIPÓTESIS hasta calibrar con datos EDR (p. ej. CISS/NASS). */
export function severityBand(deltaVms) {
  const kmh = deltaVms * 3.6;
  const band = kmh < 10 ? 'LOW' : kmh < 25 ? 'MODERATE' : kmh < 40 ? 'HIGH' : 'SEVERE';
  return { deltaVKmh: +kmh.toFixed(1), band, basis: 'umbrales hipotéticos; la probabilidad de lesión crece de forma monótona con Δv (literatura de reconstrucción); calibrar con EDR' };
}

/**
 * Trayectoria tras el impacto hasta el reposo (Euler semi-implícito). Devuelve la traza del centro y
 * de las 4 esquinas (para la envolvente) y el punto/rumbo de reposo.
 */
export function postImpactTrajectory(s, { mu = 0.7, etaPost = 0.6, cOmega = 0.8, heading = 0, dt = 0.01, maxT = 15 } = {}) {
  let x = s.pos.x, y = s.pos.y, vx = s.vel.x, vy = s.vel.y, w = s.omega, th = heading, t = 0;
  const a = etaPost * mu * G, aw = cOmega * mu * G / Math.max(0.5, s.k), L = (s.length ?? 4.5) / 2, W = (s.width ?? 1.8) / 2;
  const trace = [];
  while (t < maxT && (Math.hypot(vx, vy) > 0.05 || Math.abs(w) > 0.02)) {
    const sp = Math.hypot(vx, vy);
    if (sp > 0) { const k = Math.max(0, sp - a * dt) / sp; vx *= k; vy *= k; }
    w = Math.sign(w) * Math.max(0, Math.abs(w) - aw * dt);
    x += vx * dt; y += vy * dt; th += w * dt; t += dt;
    if (Math.round(t / dt) % 5 === 0) { const c = Math.cos(th), sn = Math.sin(th); trace.push({ t: +t.toFixed(2), x, y, corners: [[L, W], [L, -W], [-L, -W], [-L, W]].map(([u, v]) => ({ x: x + u * c - v * sn, y: y + u * sn + v * c })) }); }
  }
  return { rest: { x: +x.toFixed(2), y: +y.toFixed(2), headingRad: +th.toFixed(3), t: +t.toFixed(2) }, trace, travelM: +Math.hypot(x - s.pos.x, y - s.pos.y).toFixed(2) };
}

/**
 * Envolvente de peligro por Monte Carlo: probabilidad de que cada celda (x = longitudinal, y = lateral)
 * sea barrida por algún vehículo tras el choque. Ejes: x a lo largo de la vía (sentido de circulación),
 * y lateral (0 = borde derecho del carril derecho, positivo hacia la izquierda). Devuelve también la
 * probabilidad de invadir cada carril y el alcance longitudinal p50/p95 aguas abajo.
 */
export function dangerEnvelope(scn, { n = 400, seed = 7, cell = 2, laneWidth = 3.5, lanes = 2 } = {}) {
  const r = rng(seed), hits = new Map(), counts = Array(lanes + 2).fill(0), reach = [];
  const laneOf = (y) => (y < 0 ? 0 : Math.min(lanes + 1, 1 + Math.floor(y / laneWidth)));
  for (let i = 0; i < n; i++) {
    const e = uniform(r, 0.05, 0.3), mu = uniform(r, scn.mu?.[0] ?? 0.55, scn.mu?.[1] ?? 0.8), ang = (scn.angleDeg ?? 0) + 8 * normal(r), off = (scn.offsetM ?? 0) + 0.4 * normal(r);
    const A = { ...scn.striker, k: scn.striker.k * uniform(r, 0.9, 1.1), pos: { x: -scn.striker.length / 2, y: scn.y1 ?? laneWidth / 2 }, vel: { x: scn.v1 * Math.cos(ang * Math.PI / 180), y: scn.v1 * Math.sin(ang * Math.PI / 180) }, omega: 0 };
    const B = { ...scn.struck, k: scn.struck.k * uniform(r, 0.9, 1.1), pos: { x: scn.struck.length / 2, y: scn.y2 ?? laneWidth / 2 }, vel: { x: scn.v2 ?? 0, y: 0 }, omega: 0 };
    const res = planarImpact(A, B, { p: { x: 0, y: (scn.y2 ?? laneWidth / 2) + off }, n: { x: 1, y: 0 } }, { e });
    if (!res.impact) continue;
    const lanesSeen = new Set(), cellsSeen = new Set();
    res.after.forEach((s, k) => {
      const tr = postImpactTrajectory(s, { mu, heading: k === 0 ? ang * Math.PI / 180 : 0 });
      for (const pt of tr.trace) for (const c of pt.corners) { cellsSeen.add(`${Math.floor(c.x / cell)},${Math.floor(c.y / cell)}`); lanesSeen.add(laneOf(c.y)); }
      reach.push(tr.rest.x);
    });
    for (const key of cellsSeen) hits.set(key, (hits.get(key) ?? 0) + 1 / n);
    for (const L of lanesSeen) counts[L]++;
  }
  const q = (p) => { const s = [...reach].sort((a, b) => a - b); return s.length ? +s[Math.floor(p * (s.length - 1))].toFixed(1) : null; };
  return {
    n, cellM: cell, cells: [...hits].map(([k, p]) => { const [cx, cy] = k.split(',').map(Number); return { x: cx * cell, y: cy * cell, p: +p.toFixed(3) }; }).filter((c) => c.p >= 0.01),
    laneInvasion: counts.map((c, L) => ({ lane: L === 0 ? 'SHOULDER_OR_OFFROAD_RIGHT' : L === lanes + 1 ? 'BEYOND_LEFT' : `LANE_${L}`, p: +(c / n).toFixed(3) })),
    restReachM: { p50: q(0.5), p95: q(0.95) },
    basis: 'Monte Carlo de impacto plano + deslizamiento; parámetros HIPOTÉTICOS; no es reconstrucción pericial',
  };
}

/** Del Δv de una llamada/sensor a recomendaciones de despliegue (prioridad, no diagnóstico médico). */
export function triageFromPhysics({ deltaVms, rolledOver = false, airbag = null, occupantsNoResponse = 0 }) {
  const sb = severityBand(deltaVms);
  const flags = []; if (rolledOver) flags.push('VUELCO'); if (airbag === true) flags.push('AIRBAG'); if (occupantsNoResponse) flags.push(`${occupantsNoResponse}_SIN_RESPUESTA`);
  const priority = sb.band === 'SEVERE' || rolledOver || occupantsNoResponse ? 'LIFE' : sb.band === 'HIGH' || airbag ? 'HIGH' : 'STANDARD';
  return { ...sb, flags, priority, note: 'Prioriza la atención y la llamada al 112; no es un diagnóstico.' };
}
