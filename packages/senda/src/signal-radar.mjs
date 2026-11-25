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
