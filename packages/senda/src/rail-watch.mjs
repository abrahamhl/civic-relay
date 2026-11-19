/**
 * SENDA · Vigilancia ferroviaria con datos que YA existen (prevención, no solo respuesta).
 *
 * Cuatro detectores deterministas, cada uno nacido de un patrón documentado:
 *
 * 1. `trackCircuitWatch` — patrón ADAMUZ (18-01-2026). Según el informe de la Guardia Civil
 *    remitido al juzgado (discutido por Adif y pendiente de confirmación por la CIAF), el
 *    sistema de apoyo al mantenimiento registró una caída brusca de tensión en el circuito de
 *    vía ~22 h antes, pero no hubo alarma porque la tensión siguió por encima del umbral de
 *    ocupación. Un umbral absoluto no ve un ESCALÓN relativo; este detector sí: compara cada
 *    circuito con su propia historia (mediana y MAD) solo con la vía libre y avisa de escalones
 *    persistentes, aunque estén por encima del umbral. Resultado: «inspeccionar», no «rotura».
 * 2. `trackGeometryCrowd` — geometría de vía colaborativa con los acelerómetros de los
 *    teléfonos de los viajeros (línea de investigación publicada: Paixão et al. 2019; TU Delft
 *    2025). Normaliza por viaje (cada móvil y su soporte son distintos) y por velocidad, exige
 *    repetibilidad entre dispositivos distintos y detecta impactos repetidos en el mismo punto
 *    (juntas o soldaduras) y degradación entre periodos.
 * 3. `speedTransitionAudit` — patrón ANGROIS (24-07-2013): bajadas fuertes de velocidad máxima
 *    sin supervisión continua en la aproximación. Ordena los puntos por energía a disipar.
 * 4. `weatherAssetWatch` — patrón GELIDA (20-01-2026): muros y taludes con lluvia acumulada,
 *    estado del activo y avisos del personal (los maquinistas avisaron del temporal ese día).
 *
 * SENDA NO opera trenes ni señalización: propone inspecciones o limitaciones al gestor de la
 * infraestructura, con la evidencia adjunta. Umbrales por defecto = hipótesis configurables.
 */

const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const mad = (a) => { const m = median(a); return 1.4826 * median(a.map((x) => Math.abs(x - m))); };

/* ------------------------------------------------------------------ 1. circuito de vía */
/**
 * @param {Array<{t:number, v:number, occupied?:boolean}>} samples serie de un circuito (t en s, v en V)
 * @returns {{events:Array, thresholdAlarms:number, samplesFree:number}}
 */
export function trackCircuitWatch(samples, { windowN = 36, persistN = 6, minStepV = 0.15, kMad = 6, occupancyThresholdV = 0.78 } = {}) {
  const free = samples.filter((s) => !s.occupied).sort((a, b) => a.t - b.t);
  const events = [];
  let i = windowN;
  while (i + persistN <= free.length) {
    const before = free.slice(i - windowN, i).map((s) => s.v), after = free.slice(i, i + persistN).map((s) => s.v);
    const b = median(before), a = median(after), sigma = Math.max(1e-3, mad(before)), drop = b - a;
    if (drop >= Math.max(minStepV, kMad * sigma) && after.every((v) => v < b - drop / 2)) {
      // ¿Se recupera después? (transitorio por humedad, mantenimiento…) o persiste.
      const later = free.slice(i + persistN, i + persistN + windowN).map((s) => s.v);
      const recovered = later.length >= persistN && median(later) > b - drop / 3;
      events.push({ t: free[i].t, detectedAtT: free[i + persistN - 1].t, beforeV: +b.toFixed(3), afterV: +a.toFixed(3), dropV: +drop.toFixed(3), dropPct: Math.round((100 * drop) / b), sigmas: +(drop / sigma).toFixed(1),
        aboveOccupancyThreshold: a > occupancyThresholdV, thresholdOnlyWouldAlarm: a <= occupancyThresholdV, persistent: !recovered,
        verdict: recovered ? 'TRANSITORIO_REVISAR' : 'ESCALON_PERSISTENTE_INSPECCIONAR_VIA',
        explain: `Escalón de ${drop.toFixed(2)} V (${(drop / sigma).toFixed(0)} σ de su propia historia) con la vía libre${a > occupancyThresholdV ? `; sigue por encima del umbral de ocupación (${occupancyThresholdV} V), por eso un umbral absoluto no avisa` : ''}.` });
      i += windowN; // no repetir el mismo escalón
    } else i++;
  }
  return { events, thresholdAlarms: free.filter((s) => s.v <= occupancyThresholdV).length, samplesFree: free.length };
}

/* ------------------------------------------------------------- 2. geometría colaborativa */
/**
 * @param {Array<{tripId:string, deviceId:string, t:number, samples:Array<{pk:number, v:number, az:number}>}>} trips
 *   pk en metros, v en m/s, az = aceleración vertical sin gravedad (m/s²)
 */
export function trackGeometryCrowd(trips, { binM = 50, minDevices = 3, roughFactor = 1.8, impulseMs2 = 2.0, impulseShare = 0.5, speedExp = 1, splitT = null } = {}) {
  const bins = new Map();
  for (const tr of trips) {
    const per = new Map();
    for (const s of tr.samples) { const b = Math.floor(s.pk / binM); if (!per.has(b)) per.set(b, []); per.get(b).push(s); }
    const rmsBy = new Map();
    for (const [b, ss] of per) rmsBy.set(b, { rms: Math.sqrt(ss.reduce((x, s) => x + s.az * s.az, 0) / ss.length), v: ss.reduce((x, s) => x + s.v, 0) / ss.length, peak: Math.max(...ss.map((s) => Math.abs(s.az))) });
    const tripRms = median([...rmsBy.values()].map((r) => r.rms)), tripV = median([...rmsBy.values()].map((r) => r.v));
    for (const [b, r] of rmsBy) {
      // Rugosidad relativa al propio viaje (cancela móvil y soporte) y corregida por velocidad.
      const idx = r.rms / tripRms / Math.max(0.2, r.v / tripV) ** speedExp;
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push({ idx, peak: r.peak, deviceId: tr.deviceId, t: tr.t });
    }
  }
  const T = splitT ?? median(trips.map((t) => t.t));
  const segments = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([b, xs]) => {
    const devices = new Set(xs.map((x) => x.deviceId)).size;
    const old = xs.filter((x) => x.t < T).map((x) => x.idx), recent = xs.filter((x) => x.t >= T).map((x) => x.idx);
    const impulses = xs.filter((x) => x.peak >= impulseMs2).length;
    return { fromPk: b * binM, toPk: (b + 1) * binM, passes: xs.length, devices, index: +median(xs.map((x) => x.idx)).toFixed(3), spread: +mad(xs.map((x) => x.idx)).toFixed(3),
      recentIndex: recent.length ? +median(recent).toFixed(3) : null, oldIndex: old.length ? +median(old).toFixed(3) : null, impulseShare: +(impulses / xs.length).toFixed(2) };
  });
  const alerts = [];
  for (const s of segments) {
    if (s.devices < minDevices) continue;
    const trend = s.oldIndex && s.recentIndex ? s.recentIndex / s.oldIndex : 1;
    const kinds = [];
    if (s.recentIndex != null && s.recentIndex >= roughFactor) kinds.push('RUGOSIDAD');
    if (s.impulseShare >= impulseShare) kinds.push('IMPACTO_REPETIDO');
    if (trend >= 1.5 && (s.recentIndex ?? 0) >= 1.3) kinds.push('DEGRADACION');
    if (kinds.length) alerts.push({ ...s, trend: +trend.toFixed(2), kinds, confidence: +Math.min(1, s.devices / (2 * minDevices)).toFixed(2),
      action: kinds.includes('IMPACTO_REPETIDO') ? 'Inspección visual y ultrasonidos de juntas/soldaduras en el tramo' : 'Auscultación de geometría en el próximo paso del vehículo de medida' });
  }
  return { segments, alerts, trips: trips.length, devices: new Set(trips.map((t) => t.deviceId)).size, binM };
}

/* -------------------------------------------------------- 3. transiciones de velocidad */
/**
 * @param {Array<{pk:number, vmaxKmh:number, supervised:boolean, name?:string}>} profile
 *   puntos de cambio de velocidad máxima (en sentido de marcha); `supervised` = el sistema de
 *   protección en servicio supervisa de forma continua la reducción hasta ese punto (dato del gestor)
 */
export function speedTransitionAudit(profile, { minDropKmh = 40, serviceDecelMs2 = 0.6 } = {}) {
  const pts = [...profile].sort((a, b) => a.pk - b.pk), out = [];
  for (let i = 1; i < pts.length; i++) {
    const v1 = pts[i - 1].vmaxKmh / 3.6, v2 = pts[i].vmaxKmh / 3.6, drop = pts[i - 1].vmaxKmh - pts[i].vmaxKmh;
    if (drop < minDropKmh) continue;
    const brakingM = (v1 * v1 - v2 * v2) / (2 * serviceDecelMs2);
    out.push({ pk: pts[i].pk, name: pts[i].name ?? null, fromKmh: pts[i - 1].vmaxKmh, toKmh: pts[i].vmaxKmh, dropKmh: drop, supervised: pts[i].supervised,
      energyRatio: +((v1 * v1) / (v2 * v2)).toFixed(2), brakingM: Math.round(brakingM), brakingS: Math.round((v1 - v2) / serviceDecelMs2),
      risk: pts[i].supervised ? 'SUPERVISADA' : drop >= 80 ? 'ALTO_SIN_SUPERVISION' : 'MEDIO_SIN_SUPERVISION' });
  }
  return out.sort((a, b) => Number(a.supervised) - Number(b.supervised) || b.energyRatio - a.energyRatio);
}

/* ---------------------------------------------------------- 4. activos con meteorología */
const KIND_FACTOR = Object.freeze({ MURO: 1.2, TRINCHERA: 1.0, TERRAPLEN: 0.8 });
/**
 * @param {Array<{id, kind:'MURO'|'TRINCHERA'|'TERRAPLEN', pk, condition:1|2|3|4|5, daysSinceInspection:number}>} assets (condition 5 = peor)
 * @param {Object<string,{mm24:number, mm72:number, forecastMm24?:number}>} rain por activo
 * @param {Object<string,number>} staffReports avisos del personal por activo o tramo
 */
export function weatherAssetWatch(assets, rain, staffReports = {}, { mm24Ref = 60, mm72Ref = 120 } = {}) {
  return assets.map((a) => {
    const r = rain[a.id] ?? { mm24: 0, mm72: 0 };
    const rainScore = Math.max(r.mm24 / mm24Ref, r.mm72 / mm72Ref, (r.forecastMm24 ?? 0) / mm24Ref);
    const cond = 0.6 + 0.2 * (a.condition - 1) + Math.min(0.4, a.daysSinceInspection / 900);
    const reports = staffReports[a.id] ?? 0;
    const score = +(rainScore * cond * (KIND_FACTOR[a.kind] ?? 1) + 0.25 * Math.min(reports, 4)).toFixed(2);
    const level = score >= 1.6 ? 3 : score >= 1.1 ? 2 : score >= 0.7 ? 1 : 0;
    return { ...a, ...r, reports, score, level,
      proposal: ['Normal', 'Vigilancia reforzada', 'Inspección antes del próximo tren', 'Proponer limitación de velocidad o cierre al gestor'][level] };
  }).sort((a, b) => b.score - a.score);
}
