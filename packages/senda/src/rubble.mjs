/**
 * Rescate bajo escombros.
 *
 * 1) PUENTE: una persona atrapada no tiene cobertura, pero alguien encima sí. Su
 *    teléfono (con SENDA y en zona activa) hace de puente: Bluetooth/Wi-Fi Direct hacia
 *    abajo, Internet/SMS/satélite hacia fuera. Lo resuelve el mismo enrutador de contactos.
 * 2) LOCALIZACIÓN: el teléfono atrapado emite balizas BLE (SENDA en modo SOS lo hace
 *    automáticamente). Quien busca camina con su móvil; cada lectura de RSSI en una
 *    posición distinta alimenta una trilateración por mínimos cuadrados.
 * 3) VISTA EN CÁMARA: la posición estimada se proyecta sobre la imagen de la cámara
 *    (realidad aumentada) con su círculo de incertidumbre. La cámara NO ve a través del
 *    muro: muestra dónde está la señal.
 */

/** Modelo log-distancia. n≈2 aire libre; n≈3–4 a través de escombros/hormigón. */
export function rssiToDistanceM(rssi, { txPower1m = -59, n = 3.2 } = {}) {
  return 10 ** ((txPower1m - rssi) / (10 * n));
}

/**
 * Trilateración 2D/3D por Gauss-Newton ponderado.
 * @param {Array<{x:number,y:number,z?:number,rssi:number}>} reads posiciones del buscador (m) y RSSI medido
 * @returns {{x,y,z,errorM,reads}|null}
 */
export function locateBeacon(reads, model = {}) {
  if (reads.length < 3) return null;
  const pts = reads.map((r) => ({ ...r, z: r.z ?? 0, d: rssiToDistanceM(r.rssi, model) }));
  let p = { x: pts.reduce((s, q) => s + q.x / q.d, 0) / pts.reduce((s, q) => s + 1 / q.d, 0),
    y: pts.reduce((s, q) => s + q.y / q.d, 0) / pts.reduce((s, q) => s + 1 / q.d, 0), z: Math.min(...pts.map((q) => q.z)) - 1 };
  for (let it = 0; it < 60; it++) {
    let JtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], Jtr = [0, 0, 0];
    for (const q of pts) {
      const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, r = Math.max(Math.hypot(dx, dy, dz), 1e-3);
      const w = 1 / (q.d * q.d); // lecturas cercanas pesan más (menos ruido relativo)
      const J = [dx / r, dy / r, dz / r], res = r - q.d;
      for (let i = 0; i < 3; i++) { Jtr[i] += w * J[i] * res; for (let j = 0; j < 3; j++) JtJ[i][j] += w * J[i] * J[j]; }
    }
    for (let i = 0; i < 3; i++) JtJ[i][i] += 1e-3; // amortiguación (Levenberg)
    const step = solve3(JtJ, Jtr);
    p = { x: p.x - step[0], y: p.y - step[1], z: Math.min(0, p.z - step[2]) }; // la víctima no está por encima del suelo
    if (Math.hypot(...step) < 1e-4) break;
  }
  const residuals = pts.map((q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) - q.d);
  const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
  return { ...p, errorM: Math.max(0.5, rms * 1.5), reads: pts.length, model: 'LOG_DISTANCE_RSSI' };
}

function solve3(A, b) {
  const m = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    [m[c], m[piv]] = [m[piv], m[c]];
    for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * Proyección de la posición estimada sobre la imagen de la cámara (pinhole).
 * camera: posición (m), yaw/pitch (rad, de los sensores del móvil), fov horizontal y resolución.
 * Devuelve el píxel donde dibujar el marcador y el radio de incertidumbre en píxeles.
 */
export function projectToCamera(target, camera) {
  const { pos, yaw, pitch = 0, hfovRad = 1.2, width = 1080, height = 1920 } = camera;
  const dx = target.x - pos.x, dy = target.y - pos.y, dz = target.z - pos.z;
  const cx = Math.cos(yaw) * dx + Math.sin(yaw) * dy, cy = -Math.sin(yaw) * dx + Math.cos(yaw) * dy; // cx: hacia delante
  const fz = Math.cos(pitch) * cx + Math.sin(pitch) * dz, up = -Math.sin(pitch) * cx + Math.cos(pitch) * dz;
  if (fz <= 0.05) return { visible: false, reason: 'BEHIND_CAMERA' };
  const f = (width / 2) / Math.tan(hfovRad / 2);
  const u = width / 2 - (cy / fz) * f, v = height / 2 - (up / fz) * f;
  const visible = u >= 0 && u <= width && v >= 0 && v <= height;
  return { visible, u, v, depthM: Math.hypot(dx, dy, dz), radiusPx: ((target.errorM ?? 1) / fz) * f, label: 'Señal del teléfono atrapado (estimación)' };
}

/**
 * Elige el mejor teléfono de superficie para hacer de puente con la víctima:
 * buen enlace hacia abajo (RSSI) y al menos una salida hacia fuera.
 */
export function chooseBridge(trappedRssiBySurface, surfaceNodes) {
  const ranked = surfaceNodes
    .filter((n) => n.relayActive && n.uplinks.length)
    .map((n) => ({ ...n, rssi: trappedRssiBySurface[n.id] ?? -Infinity }))
    .filter((n) => n.rssi > -100)
    .sort((a, b) => b.rssi - a.rssi || a.battery - b.battery);
  return ranked[0] ?? null;
}
