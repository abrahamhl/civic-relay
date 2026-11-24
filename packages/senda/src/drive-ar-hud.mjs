/**
 * SENDA Drive · Motor de Proyección 3D Monocular, Clasificación Cromática Real y Renderizado AR-HUD + BEV
 * (100 % en el dispositivo, sin red, 0 €, Canvas 2D / WebView compatible).
 *
 * Veracidad física (CLAUDE.md §1):
 *  - La distancia al suelo `Z` usa geometría estenopeica de plano horizontal (`Z = h_cam / tan(pitch + Δθ_y)`)
 *    con parámetros de montaje DECLARADOS (`DEFAULT_CAM_GEOM`, sin calibrar para un coche concreto).
 *  - Los clasificadores de semáforo y luz de freno operan sobre píxeles RGB reales (`ImageData`); si la
 *    resolución o el contraste no bastan, devuelven `UNKNOWN` / `false` (jamás inventan estados).
 *  - Las personas detectadas mantienen máscara de privacidad incluso en la grabación de dashcam.
 */
import { G_STD } from './drive-physics-v2.mjs';

export const DEFAULT_CAM_GEOM = Object.freeze({
  camHeightM: 1.25,     // altura típica parabrisas turismo/SUV (declarada, calibrable por vehículo)
  fovVDeg: 48,          // campo vertical aproximado cámara trasera móvil 16:9 (declarado)
  fovHDeg: 66,          // campo horizontal aproximado cámara trasera móvil 16:9 (declarado)
  horizonY: 0.48,       // línea de horizonte normalizada (0 arriba, 1 abajo)
  pitchDeg: 0,          // inclinación cámara hacia abajo (>0 mirando más abajo)
  laneWidthM: 3.5,      // ancho estándar de carril autopista UE (ES/NL)
  basis: 'ESTIMACION_PINHOLE_PLANO · h_cam=1,25 m, fovV=48° declarados (no calibrado por vehículo)',
});

const DEG = Math.PI / 180;

/**
 * Proyecta un recuadro normalizado `[0..1]` sobre el plano de la calzada (modelo estenopeico plano).
 * Devuelve `{ zM, xM, widthM, thwS, basis }` o `null` si el borde inferior está por encima del horizonte.
 */
export function projectToGround3D(box, { speedMs = null, geom = DEFAULT_CAM_GEOM } = {}) {
  if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.w) || !Number.isFinite(box.h)) {
    return null;
  }
  const fovV = geom.fovVDeg * DEG;
  const fovH = geom.fovHDeg * DEG;
  const pitch = (geom.pitchDeg ?? 0) * DEG;
  const yBot = box.y + box.h;
  const alpha = pitch + (yBot - geom.horizonY) * fovV;
  if (!(alpha > 0.015)) return null;
  const zRaw = geom.camHeightM / Math.tan(alpha);
  const zM = +Math.max(1.5, Math.min(160, zRaw)).toFixed(1);
  const cx = box.x + box.w / 2;
  const xM = +(zM * Math.tan((cx - 0.5) * fovH)).toFixed(2);
  const widthM = +(2 * zM * Math.tan((box.w * fovH) / 2)).toFixed(2);
  const thwS = typeof speedMs === 'number' && Number.isFinite(speedMs) && speedMs > 1
    ? +(zM / speedMs).toFixed(2)
    : null;
  return { zM, xM, widthM, thwS, basis: geom.basis };
}

/** Proyección inversa exacta: coordenadas en el plano de la calzada `(xM, zM)` → píxel `(u, v)`. */
export function project3DToScreen(xM, zM, W, H, geom = DEFAULT_CAM_GEOM) {
  if (!(zM > 0.5)) return null;
  const fovV = geom.fovVDeg * DEG;
  const fovH = geom.fovHDeg * DEG;
  const pitch = (geom.pitchDeg ?? 0) * DEG;
  const u = (0.5 + Math.atan2(xM, zM) / fovH) * W;
  const v = (geom.horizonY + (Math.atan2(geom.camHeightM, zM) - pitch) / fovV) * H;
  return { u, v };
}

/**
 * Clasificador cromático real de semáforos sobre píxeles RGBA del recuadro `traffic light`.
 * Evalúa la energía cromática dominante en el tercio superior (ROJO), medio (ÁMBAR) e inferior (VERDE).
 */
export function classifyTrafficLightPixels(rgba, w, h) {
  if (!rgba || w < 4 || h < 9 || rgba.length < w * h * 4) {
    return { state: 'UNKNOWN', confidence: 0, scores: { red: 0, amber: 0, green: 0 } };
  }
  const t1 = Math.floor(h / 3), t2 = Math.floor((2 * h) / 3);
  let redE = 0, ambE = 0, grnE = 0;
  let n1 = 0, n2 = 0, n3 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2];
      if (y < t1) {
        n1++;
        if (r > 130 && r - Math.max(g, b) > 35) redE += (r - Math.max(g, b)) / 255;
      } else if (y < t2) {
        n2++;
        if (r > 140 && g > 95 && Math.min(r, g) - b > 40) ambE += (Math.min(r, g) - b) / 255;
      } else {
        n3++;
        if (g > 120 && g - Math.max(r, b) > 25) grnE += (g - Math.max(r, b)) / 255;
      }
    }
  }
  const sRed = +(redE / Math.max(1, n1)).toFixed(3);
  const sAmb = +(ambE / Math.max(1, n2)).toFixed(3);
  const sGrn = +(grnE / Math.max(1, n3)).toFixed(3);
  const pairs = [['ROJO', sRed], ['AMBAR', sAmb], ['VERDE', sGrn]].sort((a, b) => b[1] - a[1]);
  const [bestState, bestVal] = pairs[0];
  const secondVal = pairs[1][1];
  if (bestVal < 0.045 || bestVal < secondVal * 1.25) {
    return { state: 'UNKNOWN', confidence: 0, scores: { red: sRed, amber: sAmb, green: sGrn } };
  }
  return {
    state: bestState,
    confidence: +Math.min(1, bestVal / 0.25).toFixed(2),
    scores: { red: sRed, amber: sAmb, green: sGrn },
  };
}

/**
 * Detector cromático real de luces de freno en bandas laterales traseras de un vehículo en TU_CARRIL.
 */
export function detectBrakeLightsPixels(rgba, w, h) {
  if (!rgba || w < 12 || h < 10 || rgba.length < w * h * 4) {
    return { braking: false, redRatio: 0, leftRatio: 0, rightRatio: 0 };
  }
  const y0 = Math.floor(h * 0.32), y1 = Math.floor(h * 0.72);
  const lx1 = Math.max(1, Math.floor(w * 0.30));
  const rx0 = Math.min(w - 1, Math.floor(w * 0.70));
  let lHit = 0, lTot = 0, rHit = 0, rTot = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < lx1; x++) {
      lTot++;
      const i = (y * w + x) * 4;
      if (rgba[i] > 165 && rgba[i] - rgba[i + 1] > 55 && rgba[i] - rgba[i + 2] > 65) lHit++;
    }
    for (let x = rx0; x < w; x++) {
      rTot++;
      const i = (y * w + x) * 4;
      if (rgba[i] > 165 && rgba[i] - rgba[i + 1] > 55 && rgba[i] - rgba[i + 2] > 65) rHit++;
    }
  }
  const leftRatio = +(lHit / Math.max(1, lTot)).toFixed(3);
  const rightRatio = +(rHit / Math.max(1, rTot)).toFixed(3);
  const redRatio = +((leftRatio + rightRatio) / 2).toFixed(3);
  const braking = leftRatio >= 0.05 && rightRatio >= 0.05;
  return { braking, redRatio, leftRatio, rightRatio };
}

const LABELS = {
  car: 'COCHE', truck: 'CAMIÓN', bus: 'BUS', motorcycle: 'MOTO', bicycle: 'BICI',
  person: 'PEATÓN', dog: 'PERRO', horse: 'CABALLO', cow: 'VACA', sheep: 'OVEJA',
  'traffic light': 'SEMÁFORO', 'stop sign': 'STOP', train: 'TREN',
};
const LEVEL_COLOR = { VERDE: '#2ee6a6', AMBAR: '#ffb800', ROJO: '#ff3b30', INFRA: '#38bdf8' };

/**
 * Enriquecimiento de pistas ADAS con proyección 3D monocular (`zM`, `xM`, `thwS`) y opcionalmente
 * análisis cromático real sobre el canvas de vídeo fuente (`sourceCtx`).
 */
export function enrichTracksForHud(objs, { speedMs = null, geom = DEFAULT_CAM_GEOM, sourceCtx = null, W = 0, H = 0 } = {}) {
  return objs.map((o) => {
    const p3 = projectToGround3D(o.box, { speedMs, geom });
    let lightState = null;
    let brakeInfo = null;
    if (sourceCtx && W > 0 && H > 0) {
      const sx = Math.max(0, Math.floor(o.box.x * W));
      const sy = Math.max(0, Math.floor(o.box.y * H));
      const sw = Math.min(W - sx, Math.max(1, Math.floor(o.box.w * W)));
      const sh = Math.min(H - sy, Math.max(1, Math.floor(o.box.h * H)));
      try {
        if (o.label === 'traffic light' && sw >= 4 && sh >= 9) {
          const img = sourceCtx.getImageData(sx, sy, sw, sh);
          lightState = classifyTrafficLightPixels(img.data, sw, sh);
        } else if (o.zone === 'TU_CARRIL' && ['car', 'truck', 'bus'].includes(o.label) && sw >= 16 && sh >= 12) {
          const img = sourceCtx.getImageData(sx, sy, sw, sh);
          brakeInfo = detectBrakeLightsPixels(img.data, sw, sh);
        }
      } catch { /* canvas tainted o sin píxeles */ }
    }
    return { ...o, p3, lightState, brakeInfo };
  });
}

function drawCornerBrackets(x, bx, by, bw, bh, color, lw) {
  const cl = Math.max(8, Math.min(bw, bh) * 0.24);
  x.strokeStyle = color;
  x.lineWidth = lw;
  x.beginPath();
  // Arriba-izq
  x.moveTo(bx, by + cl); x.lineTo(bx, by); x.lineTo(bx + cl, by);
  // Arriba-der
  x.moveTo(bx + bw - cl, by); x.lineTo(bx + bw, by); x.lineTo(bx + bw, by + cl);
  // Abajo-izq
  x.moveTo(bx, by + bh - cl); x.lineTo(bx, by + bh); x.lineTo(bx + cl, by + bh);
  // Abajo-der
  x.moveTo(bx + bw - cl, by + bh); x.lineTo(bx + bw, by + bh); x.lineTo(bx + bw, by + bh - cl);
  x.stroke();
}

/**
 * Renderiza el AR-HUD cibernético completo + carril 3D curvo RSS + vista táctica cenital (BEV)
 * + horizonte artificial IMU directamente sobre un contexto Canvas 2D (`W × H`).
 */
export function renderArHud(x, W, H, state = {}) {
  const {
    tracks = [],
    speedMs = null,
    ssdM = null,
    rssM = null,
    curvature = 0, // κ = a_y / v² en m⁻¹
    imu = null,
    region = 'ES',
    radarTop = null,
    corridorTop = null,
    pos = null,
    aiHz = 4,
    bbActive = false,
    geom = DEFAULT_CAM_GEOM,
  } = state;

  const k = Math.max(0.65, W / 1280);
  const kappa = Math.max(-0.015, Math.min(0.015, Number.isFinite(curvature) ? curvature : 0));
  const halfLane = geom.laneWidthM / 2;

  // ── 1) Alfombra 3D perspectiva de trayectoria + zonas RSS sobre el asfalto ──
  const lead = tracks.filter((o) => o.zone === 'TU_CARRIL' && o.group !== 'INFRA' && o.p3).sort((a, b) => a.p3.zM - b.p3.zM)[0] ?? null;
  const maxZ = lead ? Math.min(65, Math.max(12, lead.p3.zM)) : 60;
  const hasDanger = lead && (lead.level === 'ROJO' || (rssM != null && lead.p3.zM < rssM * 0.6));
  const hasWarn = lead && (lead.level === 'AMBAR' || (rssM != null && lead.p3.zM < rssM));

  const leftPts = [], rightPts = [];
  for (let z = 4; z <= maxZ; z += 4) {
    const cx = 0.5 * kappa * z * z;
    const pL = project3DToScreen(cx - halfLane, z, W, H, geom);
    const pR = project3DToScreen(cx + halfLane, z, W, H, geom);
    if (pL && pR) { leftPts.push({ ...pL, z }); rightPts.push({ ...pR, z }); }
  }
  if (leftPts.length >= 2) {
    x.save();
    x.beginPath();
    x.moveTo(leftPts[0].u, leftPts[0].v);
    for (let i = 1; i < leftPts.length; i++) x.lineTo(leftPts[i].u, leftPts[i].v);
    for (let i = rightPts.length - 1; i >= 0; i--) x.lineTo(rightPts[i].u, rightPts[i].v);
    x.closePath();
    const grad = x.createLinearGradient(0, leftPts[0].v, 0, leftPts.at(-1).v);
    if (hasDanger) {
      grad.addColorStop(0, 'rgba(255,59,48,0.42)');
      grad.addColorStop(1, 'rgba(255,59,48,0.06)');
    } else if (hasWarn) {
      grad.addColorStop(0, 'rgba(255,184,0,0.34)');
      grad.addColorStop(1, 'rgba(255,184,0,0.05)');
    } else {
      grad.addColorStop(0, 'rgba(46,230,166,0.28)');
      grad.addColorStop(0.55, 'rgba(56,189,248,0.16)');
      grad.addColorStop(1, 'rgba(56,189,248,0.02)');
    }
    x.fillStyle = grad;
    x.fill();

    // Rieles luminosos de carril
    const railColor = hasDanger ? '#ff3b30' : hasWarn ? '#ffb800' : '#38bdf8';
    x.strokeStyle = railColor;
    x.lineWidth = 2.6 * k;
    for (const side of [leftPts, rightPts]) {
      x.beginPath();
      x.moveTo(side[0].u, side[0].v);
      for (let i = 1; i < side.length; i++) x.lineTo(side[i].u, side[i].v);
      x.stroke();
    }

    // Marcas de distancia en el asfalto (10 m, 20 m, 40 m)
    x.font = `600 ${Math.round(13 * k)}px "IBM Plex Mono",monospace`;
    x.fillStyle = 'rgba(255,255,255,0.85)';
    for (const tickZ of [10, 20, 40]) {
      if (tickZ > maxZ) continue;
      const cx = 0.5 * kappa * tickZ * tickZ;
      const a = project3DToScreen(cx - halfLane * 0.85, tickZ, W, H, geom);
      const b = project3DToScreen(cx + halfLane * 0.85, tickZ, W, H, geom);
      if (a && b) {
        x.strokeStyle = 'rgba(255,255,255,0.35)';
        x.lineWidth = 1.4 * k;
        x.setLineDash([6 * k, 6 * k]);
        x.beginPath(); x.moveTo(a.u, a.v); x.lineTo(b.u, b.v); x.stroke();
        x.setLineDash([]);
        x.fillText(`${tickZ}m`, b.u + 6 * k, b.v + 4 * k);
      }
    }
    x.restore();
  }

  // ── 2) Identificación completa con corchetes HUD 3D y tarjetas de telemetría ──
  for (const o of tracks) {
    const bx = o.box.x * W, by = o.box.y * H, bw = o.box.w * W, bh = o.box.h * H;
    if (o.label === 'person') {
      x.fillStyle = 'rgba(10,16,22,0.92)';
      x.fillRect(bx, by, bw, bh);
    }
    const isInfra = o.group === 'INFRA';
    let col = isInfra ? LEVEL_COLOR.INFRA : (LEVEL_COLOR[o.level] ?? '#2ee6a6');
    if (o.lightState?.state === 'ROJO') col = '#ff3b30';
    else if (o.lightState?.state === 'AMBAR') col = '#ffb800';
    else if (o.lightState?.state === 'VERDE') col = '#34c759';

    drawCornerBrackets(x, bx, by, bw, bh, col, (o.level === 'VERDE' ? 2.6 : 4.5) * k);

    // Barra de contacto en el plano del suelo
    if (!isInfra) {
      x.fillStyle = col;
      x.fillRect(bx + bw * 0.12, by + bh - 3 * k, bw * 0.76, 3.5 * k);
    }

    // Etiqueta cibernética de clase + distancia 3D + THW + TTC + semáforo/freno
    const baseName = LABELS[o.label] ?? o.label.toUpperCase();
    const parts = [`${baseName} #${o.id}`];
    if (o.lightState && o.lightState.state !== 'UNKNOWN') parts.push(o.lightState.state);
    if (o.p3 && !isInfra) parts.push(`~${o.p3.zM}m`);
    if (o.p3?.thwS != null && !isInfra) parts.push(`THW ${o.p3.thwS}s`);
    if (o.ttcS != null) parts.push(`TTC ${o.ttcS.toFixed(1)}s`);
    if (o.brakeInfo?.braking) parts.push('FRENO');
    if (o.reasons?.some((r) => r.startsWith('se mete'))) parts.push(o.zone === 'DERECHA' ? '◀◀' : '▶▶');

    const txt = parts.join(' · ');
    x.font = `700 ${Math.round(14 * k)}px "IBM Plex Mono",Inter,sans-serif`;
    const pad = 7 * k;
    const tw = x.measureText(txt).width + pad * 2;
    const th = 22 * k;
    const ty = Math.max(4 * k, by - th - 4 * k);
    x.fillStyle = 'rgba(11,18,26,0.84)';
    x.fillRect(bx, ty, tw, th);
    x.fillStyle = col;
    x.fillRect(bx, ty, 3.5 * k, th);
    x.fillStyle = '#f8fafc';
    x.fillText(txt, bx + pad + 2 * k, ty + th - 6 * k);
  }

  // ── 3) Horizonte artificial IMU (balanceo/cabeceo real si existe) ──
  const rollRad = typeof imu?.gamma === 'number' && Number.isFinite(imu.gamma)
    ? Math.max(-25, Math.min(25, imu.gamma)) * DEG : 0;
  x.save();
  x.translate(W * 0.5, H * geom.horizonY);
  x.rotate(-rollRad);
  x.strokeStyle = 'rgba(56,189,248,0.45)';
  x.lineWidth = 1.6 * k;
  x.beginPath();
  x.moveTo(-70 * k, 0); x.lineTo(-22 * k, 0);
  x.moveTo(22 * k, 0); x.lineTo(70 * k, 0);
  x.moveTo(0, -10 * k); x.lineTo(0, 10 * k);
  x.stroke();
  x.restore();

  // ── 4) Panel táctico cenital Bird's-Eye View (BEV) en tiempo real ──
  const bevW = Math.round(Math.min(220 * k, W * 0.24));
  const bevH = Math.round(Math.min(300 * k, H * 0.56));
  const bevX = W - bevW - 14 * k;
  const bevY = 58 * k;
  if (bevW >= 110 && bevH >= 140) {
    x.save();
    x.fillStyle = 'rgba(9,16,24,0.78)';
    x.strokeStyle = 'rgba(56,189,248,0.45)';
    x.lineWidth = 1.5 * k;
    x.fillRect(bevX, bevY, bevW, bevH);
    x.strokeRect(bevX, bevY, bevW, bevH);

    // Cabecera BEV
    x.fillStyle = '#38bdf8';
    x.font = `700 ${Math.round(11 * k)}px "IBM Plex Mono",monospace`;
    x.fillText(`BEV 3D · ${region} · ${aiHz}Hz`, bevX + 8 * k, bevY + 16 * k);

    const egoX = bevX + bevW / 2;
    const egoY = bevY + bevH - 26 * k;
    const zRangeM = 75;
    const pxPerM_Z = (bevH - 52 * k) / zRangeM;
    const pxPerM_X = (bevW - 24 * k) / 16; // ±8 m lateral

    // Carriles de referencia (-5.25, -1.75, +1.75, +5.25 m)
    x.strokeStyle = 'rgba(148,163,184,0.22)';
    x.lineWidth = 1 * k;
    for (const lx of [-5.25, -1.75, 1.75, 5.25]) {
      const px = egoX + lx * pxPerM_X;
      x.beginPath(); x.moveTo(px, bevY + 24 * k); x.lineTo(px, egoY + 12 * k); x.stroke();
    }
    // Arcos de distancia 25m / 50m y zona RSS
    for (const rz of [25, 50]) {
      const py = egoY - rz * pxPerM_Z;
      x.strokeStyle = 'rgba(148,163,184,0.18)';
      x.beginPath(); x.moveTo(bevX + 6 * k, py); x.lineTo(bevX + bevW - 6 * k, py); x.stroke();
      x.fillStyle = 'rgba(148,163,184,0.6)';
      x.fillText(`${rz}m`, bevX + 6 * k, py - 2 * k);
    }
    if (rssM != null && rssM > 2 && rssM <= zRangeM) {
      const py = egoY - rssM * pxPerM_Z;
      x.strokeStyle = 'rgba(255,184,0,0.75)';
      x.setLineDash([4 * k, 4 * k]);
      x.beginPath(); x.moveTo(bevX + 6 * k, py); x.lineTo(bevX + bevW - 6 * k, py); x.stroke();
      x.setLineDash([]);
      x.fillStyle = '#ffb800';
      x.fillText(`RSS ${Math.round(rssM)}m`, bevX + bevW - 62 * k, py - 3 * k);
    }

    // Spline de trayectoria ego en BEV
    x.strokeStyle = railColorOf(hasDanger, hasWarn);
    x.lineWidth = 2.5 * k;
    x.beginPath();
    x.moveTo(egoX, egoY);
    for (let z = 4; z <= 60; z += 4) {
      const sx = egoX + (0.5 * kappa * z * z) * pxPerM_X;
      const sy = egoY - z * pxPerM_Z;
      x.lineTo(sx, sy);
    }
    x.stroke();

    // Objetos 3D proyectados en BEV
    for (const o of tracks) {
      if (!o.p3 || o.group === 'INFRA') continue;
      if (o.p3.zM > zRangeM) continue;
      const ox = Math.max(bevX + 10 * k, Math.min(bevX + bevW - 10 * k, egoX + o.p3.xM * pxPerM_X));
      const oy = egoY - o.p3.zM * pxPerM_Z;
      const col = LEVEL_COLOR[o.level] ?? '#2ee6a6';
      x.fillStyle = col;
      if (o.group === 'VRU') {
        x.beginPath(); x.arc(ox, oy, 5 * k, 0, Math.PI * 2); x.fill();
      } else {
        const bw2 = (o.label === 'truck' || o.label === 'bus' ? 14 : 11) * k;
        const bh2 = (o.label === 'truck' || o.label === 'bus' ? 22 : 16) * k;
        x.fillRect(ox - bw2 / 2, oy - bh2 / 2, bw2, bh2);
      }
    }

    // Indicador de radar o corredor oficial en el borde superior del BEV
    if (radarTop) {
      x.fillStyle = radarTop.overLimit ? '#ff3b30' : '#38bdf8';
      x.fillText(`RADAR ${radarTop.distM}m${radarTop.maxspeed ? ` (${radarTop.maxspeed})` : ''}`, bevX + 8 * k, bevY + 32 * k);
    } else if (corridorTop) {
      x.fillStyle = corridorTop.urgency === 'ROJO' ? '#ff3b30' : '#ffb800';
      x.fillText(`${corridorTop.source} ${corridorTop.distM}m`, bevX + 8 * k, bevY + 32 * k);
    }

    // Vehículo propio (triángulo blanco-cian)
    x.fillStyle = '#ffffff';
    x.beginPath();
    x.moveTo(egoX, egoY - 11 * k);
    x.lineTo(egoX + 7 * k, egoY + 8 * k);
    x.lineTo(egoX, egoY + 4 * k);
    x.lineTo(egoX - 7 * k, egoY + 8 * k);
    x.closePath();
    x.fill();
    x.restore();
  }

  // ── 5) Sello inferior de telemetría de aviación / dashcam ──
  const spdTxt = speedMs == null ? '–' : Math.round(speedMs * 3.6);
  const imuG = imu && (imu.ax != null || imu.ay != null)
    ? `${(Math.hypot(imu.ax ?? 0, imu.ay ?? 0) / G_STD).toFixed(2)}g` : '–';
  const rssTxt = rssM != null ? ` · RSS ${Math.round(rssM)}m` : '';
  const ssdTxt = ssdM != null ? ` · SSD ${Math.round(ssdM)}m` : '';
  const posTxt = pos ? ` · ${pos[1].toFixed(5)},${pos[0].toFixed(5)}` : '';
  const stamp = `SENDA AR-HUD [${region}] · ${spdTxt} km/h${rssTxt}${ssdTxt} · G:${imuG} · ${tracks.length} obj${bbActive ? ' · ●BBv2' : ''}${posTxt}`;
  x.font = `600 ${Math.round(15 * k)}px "IBM Plex Mono",Inter,sans-serif`;
  const stW = x.measureText(stamp).width + 20 * k;
  x.fillStyle = 'rgba(9,16,24,0.78)';
  x.fillRect(0, H - 34 * k, Math.min(W, stW), 34 * k);
  x.fillStyle = '#e2e8f0';
  x.fillText(stamp, 10 * k, H - 11 * k);
}

function railColorOf(danger, warn) {
  return danger ? '#ff3b30' : warn ? '#ffb800' : '#38bdf8';
}
