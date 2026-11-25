/**
 * SENDA · «Señales a tu alrededor»: resumen y dibujo de las redes Wi-Fi y dispositivos Bluetooth cercanos
 * (lo entrega RadioScan.java sin nombres ni direcciones). Sirve andando, en bici o en coche para ver, y
 * registrar en la caja negra, cuánta «malla» posible hay en cada calle.
 *
 * Veracidad: la intensidad (dBm) es MEDIDA por el móvil. La posición angular del radar es DECORATIVA
 * (un móvil no sabe la dirección de cada emisor) y se dice en pantalla. Las bandas de intensidad son
 * cortes de dibujo de la app, no distancias.
 */
export const STRENGTH_BANDS = Object.freeze([
  { min: -55, label: 'muy fuerte', ring: 0.3 },
  { min: -67, label: 'fuerte', ring: 0.55 },
  { min: -80, label: 'media', ring: 0.8 },
  { min: -Infinity, label: 'débil', ring: 1 },
]); // cortes de la app para dibujar (no son distancias)

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const bandOf = (dbm) => STRENGTH_BANDS.find((b) => dbm >= b.min);

/** Resumen sin identificadores para la interfaz y la caja negra. */
export function summarizeScan(scan) {
  const wifi = Array.isArray(scan?.wifi) ? scan.wifi.filter((w) => Number.isFinite(w.r)) : [];
  const ble = Array.isArray(scan?.ble) ? scan.ble.filter((b) => Number.isFinite(b.r)) : [];
  const byBand = { '2.4': 0, '5': 0, '6': 0 };
  for (const w of wifi) if (byBand[w.g] != null) byBand[w.g]++;
  return {
    wifiN: wifi.length, wifiByBand: byBand,
    wifiBestDbm: wifi.length ? Math.max(...wifi.map((w) => w.r)) : null,
    wifiMedianDbm: median(wifi.map((w) => w.r)),
    bleN: ble.length, bleBestDbm: ble.length ? Math.max(...ble.map((b) => b.r)) : null,
    sendaNear: Number(scan?.sendaNear) || ble.filter((b) => b.s).length,
    wifiFresh: !!scan?.wifiFresh, note: scan?.note || '',
    basis: 'MEDIDO (intensidad) · ángulo decorativo · sin nombres ni direcciones',
  };
}

/** Puntos para dibujar: x,y en [-1,1] (centro = tú). */
export function radarPoints(scan) {
  const pts = [];
  const add = (it, kind) => {
    const band = bandOf(it.r), ang = ((Number(it.a) || 0) * Math.PI) / 180;
    pts.push({ kind, x: band.ring * Math.cos(ang), y: band.ring * Math.sin(ang), dbm: it.r, band: band.label, senda: !!it.s, g: it.g ?? null });
  };
  for (const w of scan?.wifi ?? []) if (Number.isFinite(w.r)) add(w, 'wifi');
  for (const b of scan?.ble ?? []) if (Number.isFinite(b.r)) add(b, 'ble');
  return pts;
}

const COLORS = { wifi24: '#0a84ff', wifi5: '#64d2ff', wifi6: '#bf5af2', ble: '#30d158', senda: '#ff9f0a' };
/** Dibuja el radar en un canvas 2D (tamaño S×S). `sweep` en radianes para la animación. */
export function drawSignalRadar(x, S, pts, sweep = 0) {
  const c = S / 2, R = S * 0.46;
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#06121a'; x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = 'rgba(100,210,255,.25)'; x.lineWidth = 1;
  for (const b of STRENGTH_BANDS) { x.beginPath(); x.arc(c, c, R * b.ring, 0, Math.PI * 2); x.stroke(); }
  const g = x.createLinearGradient?.(c, c, c + R * Math.cos(sweep), c + R * Math.sin(sweep));
  if (g) { g.addColorStop(0, 'rgba(48,209,88,.35)'); g.addColorStop(1, 'rgba(48,209,88,0)'); x.fillStyle = g; }
  x.beginPath(); x.moveTo(c, c); x.arc(c, c, R, sweep - 0.5, sweep); x.closePath(); x.fill();
  for (const p of pts) {
    const col = p.senda ? COLORS.senda : p.kind === 'ble' ? COLORS.ble : p.g === '5' ? COLORS.wifi5 : p.g === '6' ? COLORS.wifi6 : COLORS.wifi24;
    const r = p.senda ? 7 : p.kind === 'ble' ? 3.5 : 4.5;
    x.fillStyle = col; x.beginPath(); x.arc(c + p.x * R, c + p.y * R, r * (S / 300), 0, Math.PI * 2); x.fill();
  }
  x.fillStyle = '#fff'; x.beginPath(); x.arc(c, c, 5 * (S / 300), 0, Math.PI * 2); x.fill();
}
export const RADAR_COLORS = COLORS;

/** Clave estable de un emisor dentro de la sesión (el ángulo ya viene salado desde Android). */
export const blipKey = (p) => `${p.kind}:${Math.round(Math.atan2(p.y, p.x) * 1000)}`;

/** Brillo de un punto según cuánto hace que pasó el haz (persistencia de fósforo, como un radar real). */
export function phosphor(sweep, x, y, decay = 2.2) {
  const ang = Math.atan2(y, x);
  const behind = ((sweep - ang) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); // 0 = el haz acaba de pasar
  return Math.max(0.22, Math.exp(-behind / decay));
}

/**
 * Radar «de videojuego»: fondo de fósforo, estela del haz, anillos con su valor en dBm,
 * puntos que se encienden al paso del haz y destello en los nuevos (`fresh`: Map clave→instante).
 */
export function drawSignalRadarPro(x, S, pts, sweep, { fresh = new Map(), now = 0 } = {}) {
  const c = S / 2, R = S * 0.47, k = S / 300;
  x.clearRect(0, 0, S, S);
  const bg = x.createRadialGradient?.(c, c, R * 0.05, c, c, R);
  if (bg) { bg.addColorStop(0, '#0b2a1c'); bg.addColorStop(1, '#03110b'); x.fillStyle = bg; } else x.fillStyle = '#03110b';
  x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.fill();
  // Retícula
  x.strokeStyle = 'rgba(52,255,153,.22)'; x.lineWidth = 1 * k;
  for (const b of STRENGTH_BANDS) { x.beginPath(); x.arc(c, c, R * b.ring, 0, Math.PI * 2); x.stroke(); }
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; x.beginPath(); x.moveTo(c + Math.cos(a) * R * 0.1, c + Math.sin(a) * R * 0.1); x.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); x.stroke(); }
  x.fillStyle = 'rgba(52,255,153,.55)'; x.font = `600 ${Math.round(9 * k)}px ui-monospace,monospace`;
  const lbl = ['−55', '−67', '−80', 'dBm'];
  STRENGTH_BANDS.forEach((b, i) => x.fillText(lbl[i], c + 4 * k, c - R * b.ring + 11 * k));
  // Estela del haz (abanico con degradado)
  for (let i = 0; i < 24; i++) {
    const a0 = sweep - (i + 1) * 0.035, a1 = sweep - i * 0.035;
    x.fillStyle = `rgba(52,255,153,${0.32 * (1 - i / 24)})`;
    x.beginPath(); x.moveTo(c, c); x.arc(c, c, R, a0, a1); x.closePath(); x.fill();
  }
  x.strokeStyle = 'rgba(160,255,200,.9)'; x.lineWidth = 2 * k;
  x.beginPath(); x.moveTo(c, c); x.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R); x.stroke();
  // Puntos
  for (const p of pts) {
    const col = p.senda ? COLORS.senda : p.kind === 'ble' ? COLORS.ble : p.g === '5' ? COLORS.wifi5 : p.g === '6' ? COLORS.wifi6 : COLORS.wifi24;
    const px = c + p.x * R, py = c + p.y * R, a = phosphor(sweep, p.x, p.y);
    const r = (p.senda ? 7 : p.kind === 'ble' ? 3.6 : 4.6) * k;
    x.globalAlpha = a; x.shadowColor = col; x.shadowBlur = 12 * k * a;
    x.fillStyle = col; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    const t0 = fresh.get(blipKey(p));
    if (t0 != null && now - t0 < 2500) { // destello de punto nuevo
      const f = (now - t0) / 2500; x.globalAlpha = 1 - f; x.strokeStyle = col; x.lineWidth = 2 * k;
      x.beginPath(); x.arc(px, py, r + 18 * k * f, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = 1; x.shadowBlur = 0;
  }
  // Tú, en el centro
  x.fillStyle = '#fff'; x.shadowColor = '#34ff99'; x.shadowBlur = 10 * k;
  x.beginPath(); x.arc(c, c, 5 * k, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0;
  x.strokeStyle = 'rgba(52,255,153,.6)'; x.lineWidth = 2 * k; x.beginPath(); x.arc(c, c, R, 0, Math.PI * 2); x.stroke();
}

/** Mini gráfica de historia (barras) de los últimos barridos. */
export function drawHistory(x, W, H, hist) {
  x.clearRect(0, 0, W, H);
  const n = hist.length; if (!n) return;
  const max = Math.max(1, ...hist.map((h) => h.wifiN + h.bleN)), bw = W / Math.max(n, 12);
  hist.forEach((h, i) => {
    const hw = (h.wifiN / max) * (H - 2), hb = (h.bleN / max) * (H - 2), xx = W - (n - i) * bw;
    x.fillStyle = COLORS.wifi24; x.fillRect(xx, H - hw, bw - 2, hw);
    x.fillStyle = COLORS.ble; x.fillRect(xx, H - hw - hb, bw - 2, hb);
  });
}
