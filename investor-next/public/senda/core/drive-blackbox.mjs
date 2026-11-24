/**
 * SENDA Drive · Caja Negra de vuelo en el dispositivo (`senda-drive-blackbox/1`, 0 €, sin red).
 *
 * Registra telemetría compacta en memoria circular (≤ 7 200 muestras = 2 h a 1 Hz, < 2 MB RAM)
 * durante la conducción y la sella con cadena SHA-256 al exportar para estudiar comunicaciones,
 * zonas sin cobertura, consumo real de batería y comportamiento del detector en carretera real.
 *
 * Privacidad y veracidad (CLAUDE.md):
 *  - NO guarda fotogramas de vídeo, ni caras, ni matrículas, ni identificadores de terceros.
 *  - Todo sensor no disponible queda explícitamente como `null` (jamás se inventan datos de batería ni red).
 *  - La salida permanece 100 % local en el móvil hasta que la persona decide guardarla o compartirla.
 */
import { haversineM } from './route-planner.mjs';
import { stoppingDistanceM } from './drive-corridor.mjs';
import { estimatePlanarKinematics } from './drive-physics-v2.mjs';

export const BLACKBOX_SCHEMA = 'senda-drive-blackbox/1';
export const GENESIS_HASH = '0'.repeat(64);

const enc = new TextEncoder();
async function sha256Hex(str) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const numOrNull = (v, d = null) => (typeof v === 'number' && Number.isFinite(v) ? (d != null ? +v.toFixed(d) : v) : null);

/** Canoniza una muestra (sin hashes) para garantizar reproducibilidad en la verificación SHA-256. */
export function canonicalFramePayload(f) {
  return JSON.stringify({
    seq: f.seq,
    t: f.t,
    pos: f.pos,
    accuracyM: f.accuracyM,
    speedMs: f.speedMs,
    headingDeg: f.headingDeg,
    kin: f.kin,
    ssdM: f.ssdM,
    vision: f.vision,
    corridor: f.corridor,
    rf: f.rf,
    battery: f.battery,
    ble: f.ble,
  });
}

/** Resume un viaje grabado con métricas reales (null cuando el sensor no aportó datos). */
export function summarizeBlackBox(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    return {
      frames: 0, durationS: 0, distanceKm: 0, maxSpeedKmh: null, meanSpeedKmh: null,
      maxBrakingMs2: null, maxAccelMs2: null, maxLatG: null, maxNormG: null,
      batteryStartPct: null, batteryEndPct: null, batteryDropPct: null, batteryDrainPctPerHr: null,
      offlineTransitions: 0, deadZoneSamples: 0, deadZones: [],
      visionFrames: 0, adasRedFrames: 0, adasAmberFrames: 0, meanInferMs: null,
      corridorAlertFrames: 0, bleTxMax: 0, bleRxMax: 0, bleRejectedMax: 0,
    };
  }
  const durationS = Math.max(0, +((frames.at(-1).t - frames[0].t) / 1000).toFixed(1));
  let distM = 0, prevPos = null;
  const speeds = [], axVals = [], ayG = [], normG = [], inferVals = [];
  let batStart = null, batEnd = null, batStartT = null, batEndT = null;
  let offlineTransitions = 0, prevOnline = null, deadZoneSamples = 0;
  const deadZones = [];
  let visionFrames = 0, adasRedFrames = 0, adasAmberFrames = 0, corridorAlertFrames = 0;
  let bleTxMax = 0, bleRxMax = 0, bleRejectedMax = 0;

  for (const f of frames) {
    if (Array.isArray(f.pos) && f.pos.length === 2) {
      if (prevPos) {
        const step = haversineM(prevPos, f.pos);
        if (step < 500) distM += step; // descarta saltos GPS aberrantes (>500 m en 1 tick)
      }
      prevPos = f.pos;
    }
    if (f.speedMs != null) speeds.push(f.speedMs * 3.6);
    if (f.kin?.axMs2 != null) axVals.push(f.kin.axMs2);
    if (f.kin?.ayMs2 != null) ayG.push(Math.abs(f.kin.ayMs2) / 9.80665);
    if (f.kin?.aNormG != null) normG.push(f.kin.aNormG);
    if (f.battery?.pct != null) {
      if (batStart == null) { batStart = f.battery.pct; batStartT = f.t; }
      batEnd = f.battery.pct; batEndT = f.t;
    }
    if (f.rf?.online != null) {
      if (prevOnline === true && f.rf.online === false) offlineTransitions++;
      prevOnline = f.rf.online;
      if (f.rf.online === false) {
        deadZoneSamples++;
        if (f.pos && deadZones.length < 200) {
          const last = deadZones.at(-1);
          if (!last || haversineM([last.lon, last.lat], f.pos) >= 100) {
            deadZones.push({ t: f.t, lon: f.pos[0], lat: f.pos[1] });
          }
        }
      }
    }
    if (f.vision && f.vision.active) {
      visionFrames++;
      if (f.vision.level === 'ROJO') adasRedFrames++;
      else if (f.vision.level === 'AMBAR') adasAmberFrames++;
      if (f.vision.inferMs != null) inferVals.push(f.vision.inferMs);
    }
    if (f.corridor?.topCat) corridorAlertFrames++;
    if (f.ble) {
      if (f.ble.tx > bleTxMax) bleTxMax = f.ble.tx;
      if (f.ble.rx > bleRxMax) bleRxMax = f.ble.rx;
      if (f.ble.rejected > bleRejectedMax) bleRejectedMax = f.ble.rejected;
    }
  }

  const batDrop = batStart != null && batEnd != null ? +(batStart - batEnd).toFixed(1) : null;
  const batHours = batStartT != null && batEndT != null ? (batEndT - batStartT) / 3_600_000 : 0;
  const batRate = batDrop != null && batHours >= 1 / 60 ? +(batDrop / batHours).toFixed(2) : null;

  return {
    frames: frames.length,
    durationS,
    distanceKm: +(distM / 1000).toFixed(3),
    maxSpeedKmh: speeds.length ? +Math.max(...speeds).toFixed(1) : null,
    meanSpeedKmh: speeds.length ? +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : null,
    maxBrakingMs2: axVals.length ? +Math.max(0, -Math.min(...axVals)).toFixed(2) : null,
    maxAccelMs2: axVals.length ? +Math.max(0, Math.max(...axVals)).toFixed(2) : null,
    maxLatG: ayG.length ? +Math.max(...ayG).toFixed(3) : null,
    maxNormG: normG.length ? +Math.max(...normG).toFixed(3) : null,
    batteryStartPct: batStart,
    batteryEndPct: batEnd,
    batteryDropPct: batDrop,
    batteryDrainPctPerHr: batRate,
    offlineTransitions,
    deadZoneSamples,
    deadZones,
    visionFrames,
    adasRedFrames,
    adasAmberFrames,
    meanInferMs: inferVals.length ? +(inferVals.reduce((a, b) => a + b, 0) / inferVals.length).toFixed(1) : null,
    corridorAlertFrames,
    bleTxMax,
    bleRxMax,
    bleRejectedMax,
  };
}

/** Crea una instancia de caja negra en memoria circular. */
export function createBlackBox({ maxFrames = 7200, appVersion = 'senda-conducir' } = {}) {
  let active = false, seq = 0, startedUtc = null;
  const frames = [];
  const gnssWin = [];

  return {
    get active() { return active; },
    get count() { return frames.length; },
    get frames() { return frames; },

    start(nowMs = Date.now()) {
      active = true;
      if (!startedUtc) startedUtc = new Date(nowMs).toISOString();
    },

    stop() { active = false; },

    reset() {
      active = false; seq = 0; startedUtc = null;
      frames.length = 0; gnssWin.length = 0;
    },

    /**
     * Registra una muestra de telemetría real (sin píxeles, sin PII, null si falta sensor).
     */
    record({
      t = Date.now(), pos = null, accuracyM = null, speedMs = null, headingDeg = null,
      vision = null, corridor = null, rf = null, battery = null, ble = null,
    } = {}) {
      if (!active) return null;
      const cleanPos = Array.isArray(pos) && Number.isFinite(pos[0]) && Number.isFinite(pos[1])
        ? [+pos[0].toFixed(6), +pos[1].toFixed(6)] : null;
      const spd = numOrNull(speedMs, 2);
      const hdg = numOrNull(headingDeg, 1);
      if (spd != null) {
        gnssWin.push({ t: t / 1000, speedMs: spd, headingDeg: hdg });
        if (gnssWin.length > 5) gnssWin.shift();
      }
      const kin = estimatePlanarKinematics(gnssWin);
      const ssd = stoppingDistanceM(spd);
      const entry = {
        seq: ++seq,
        t: Math.floor(t),
        pos: cleanPos,
        accuracyM: numOrNull(accuracyM, 1),
        speedMs: spd,
        headingDeg: hdg,
        kin,
        ssdM: ssd != null ? +ssd.toFixed(1) : null,
        vision: vision ? {
          active: !!vision.active,
          count: numOrNull(vision.count, 0) ?? 0,
          level: vision.level ?? 'VERDE',
          minTtcS: numOrNull(vision.minTtcS, 2),
          clipped: numOrNull(vision.clipped, 0) ?? 0,
          inferMs: numOrNull(vision.inferMs, 1),
          hz: numOrNull(vision.hz, 1),
        } : null,
        corridor: corridor ? {
          mode: corridor.mode ?? null,
          count: numOrNull(corridor.dedupedCount, 0) ?? 0,
          topCat: corridor.top?.cat ?? null,
          topRoad: corridor.top?.road || null,
          topDistM: numOrNull(corridor.top?.distM, 0),
          topUrgency: corridor.top?.urgency ?? null,
          topSource: corridor.top?.source ?? null,
        } : null,
        rf: rf ? {
          online: typeof rf.online === 'boolean' ? rf.online : null,
          netType: typeof rf.netType === 'string' ? rf.netType : null,
          downlinkMbps: numOrNull(rf.downlinkMbps, 2),
          rttMs: numOrNull(rf.rttMs, 0),
        } : null,
        battery: battery ? {
          pct: numOrNull(battery.pct, 1),
          charging: typeof battery.charging === 'boolean' ? battery.charging : null,
        } : null,
        ble: ble ? {
          tx: numOrNull(ble.tx, 0) ?? 0,
          rx: numOrNull(ble.rx, 0) ?? 0,
          rejected: numOrNull(ble.rejected, 0) ?? 0,
        } : null,
      };
      frames.push(entry);
      if (frames.length > maxFrames) frames.shift();
      return entry;
    },

    /** Sella toda la traza con cadena criptográfica SHA-256 (WebCrypto, sin red). */
    async exportSealed(nowMs = Date.now()) {
      let prevHash = GENESIS_HASH;
      const sealed = [];
      for (const f of frames) {
        const hash = await sha256Hex(`${prevHash}|${canonicalFramePayload(f)}`);
        sealed.push({ ...f, prevHash, hash });
        prevHash = hash;
      }
      return {
        schema: BLACKBOX_SCHEMA,
        appVersion,
        privacy: { sharesRawVideo: false, storesFacesOrPlates: false, automaticUpload: false },
        startedUtc: startedUtc ?? new Date(nowMs).toISOString(),
        exportedUtc: new Date(nowMs).toISOString(),
        genesisHash: GENESIS_HASH,
        chainTipHash: prevHash,
        summary: summarizeBlackBox(frames),
        frames: sealed,
      };
    },
  };
}

/** Verifica criptográficamente una caja negra exportada (detecta cualquier edición o borrado). */
export async function verifyBlackBox(doc) {
  if (!doc || doc.schema !== BLACKBOX_SCHEMA || !Array.isArray(doc.frames)) {
    return { ok: false, count: 0, brokenAt: null, reason: 'esquema no válido' };
  }
  let prev = GENESIS_HASH;
  for (let i = 0; i < doc.frames.length; i++) {
    const f = doc.frames[i];
    if (f.prevHash !== prev) return { ok: false, count: doc.frames.length, brokenAt: i, reason: 'prevHash roto' };
    const expected = await sha256Hex(`${prev}|${canonicalFramePayload(f)}`);
    if (f.hash !== expected) return { ok: false, count: doc.frames.length, brokenAt: i, reason: 'hash alterado' };
    prev = expected;
  }
  if (doc.chainTipHash !== prev) {
    return { ok: false, count: doc.frames.length, brokenAt: doc.frames.length - 1, reason: 'chainTipHash no coincide' };
  }
  return { ok: true, count: doc.frames.length, brokenAt: null, reason: null };
}
