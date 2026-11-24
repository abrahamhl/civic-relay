/**
 * SENDA Drive · Caja Negra de vuelo sin recortes (`senda-drive-blackbox/2`, 0 €, sin red).
 *
 * Registra telemetría completa de calibración en el dispositivo (por defecto ≤ 14 400 muestras = 4 h a 1 Hz)
 * y la sella con cadena SHA-256 al exportar para estudiar comunicaciones, cobertura, consumo de batería,
 * pistas ADAS completas (para re-ejecutar umbrales offline), IMU 3 ejes, distancias RSS, radares oficiales
 * fijos/tramo y latencia RTT de sonda cooperativa BLE.
 *
 * Privacidad y veracidad (CLAUDE.md):
 *  - NO guarda fotogramas de vídeo, ni caras, ni matrículas, ni identificadores de terceros.
 *  - Todo sensor no disponible queda explícitamente como `null` (jamás se inventan datos).
 *  - La salida permanece 100 % local en el móvil hasta que la persona decide guardarla o compartirla.
 */
import { haversineM } from './route-planner.mjs';
import { stoppingDistanceM } from './drive-corridor.mjs';
import {
  G_STD,
  EXAMPLE_RSS_PARAMS,
  estimatePlanarKinematics,
  rssLongitudinalSameDir,
  rssLongitudinalOppositeDir,
} from './drive-physics-v2.mjs';

export const BLACKBOX_SCHEMA = 'senda-drive-blackbox/2';
export const SUPPORTED_SCHEMAS = Object.freeze(['senda-drive-blackbox/1', 'senda-drive-blackbox/2']);
export const GENESIS_HASH = '0'.repeat(64);

const enc = new TextEncoder();
async function sha256Hex(str) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const numOrNull = (v, d = null) => (typeof v === 'number' && Number.isFinite(v) ? (d != null ? +v.toFixed(d) : v) : null);

function cleanImu(imu) {
  if (!imu || typeof imu !== 'object') return null;
  const out = {
    ax: numOrNull(imu.ax, 3),
    ay: numOrNull(imu.ay, 3),
    az: numOrNull(imu.az, 3),
    gx: numOrNull(imu.gx, 2),
    gy: numOrNull(imu.gy, 2),
    gz: numOrNull(imu.gz, 2),
    alpha: numOrNull(imu.alpha, 1),
    beta: numOrNull(imu.beta, 1),
    gamma: numOrNull(imu.gamma, 1),
  };
  return Object.values(out).some((v) => v != null) ? out : null;
}

function cleanTracks(tracks) {
  if (!Array.isArray(tracks)) return null;
  return tracks.map((o) => ({
    id: o.id ?? null,
    label: o.label ?? null,
    zone: o.zone ?? null,
    box: o.box
      ? [numOrNull(o.box.x, 4), numOrNull(o.box.y, 4), numOrNull(o.box.w, 4), numOrNull(o.box.h, 4)]
      : (Array.isArray(o.box) ? o.box.map((v) => numOrNull(v, 4)) : null),
    ttcS: numOrNull(o.ttcS, 2),
    lateral: numOrNull(o.lateral, 3),
    level: o.level ?? 'VERDE',
    clipped: !!o.clipped,
    reasons: Array.isArray(o.reasons) ? o.reasons.slice(0, 4) : [],
  }));
}

function cleanCorridorItems(items) {
  if (!Array.isArray(items)) return null;
  return items.map((i) => ({
    cat: i.cat ?? null,
    road: i.road || null,
    distM: numOrNull(i.distM, 0),
    urgency: i.urgency ?? null,
    source: i.source ?? null,
  }));
}

function computeRssSnapshot(speedMs) {
  if (speedMs == null || speedMs < 0) return null;
  const sameDirMovingM = rssLongitudinalSameDir({ vRearMs: speedMs, vFrontMs: speedMs }, EXAMPLE_RSS_PARAMS).dMinM;
  const sameDirStoppedM = rssLongitudinalSameDir({ vRearMs: speedMs, vFrontMs: 0 }, EXAMPLE_RSS_PARAMS).dMinM;
  const oppDirM = rssLongitudinalOppositeDir({ v1Ms: speedMs, v2Ms: speedMs }, EXAMPLE_RSS_PARAMS).dMinM;
  return {
    sameDirMovingM: +sameDirMovingM.toFixed(1),
    sameDirStoppedM: +sameDirStoppedM.toFixed(1),
    oppDirM: +oppDirM.toFixed(1),
    basis: EXAMPLE_RSS_PARAMS.basis,
  };
}

/** Canoniza una muestra (sin hashes) para garantizar reproducibilidad en la verificación SHA-256. */
export function canonicalFramePayload(f, schema = BLACKBOX_SCHEMA) {
  if (schema === 'senda-drive-blackbox/1') {
    return JSON.stringify({
      seq: f.seq, t: f.t, pos: f.pos, accuracyM: f.accuracyM, speedMs: f.speedMs,
      headingDeg: f.headingDeg, kin: f.kin, ssdM: f.ssdM, vision: f.vision,
      corridor: f.corridor, rf: f.rf, battery: f.battery, ble: f.ble,
    });
  }
  return JSON.stringify({
    seq: f.seq,
    t: f.t,
    pos: f.pos,
    accuracyM: f.accuracyM,
    altM: f.altM,
    altAccuracyM: f.altAccuracyM,
    speedMs: f.speedMs,
    headingDeg: f.headingDeg,
    kin: f.kin,
    imu: f.imu,
    ssdM: f.ssdM,
    rss: f.rss,
    vision: f.vision,
    corridor: f.corridor,
    radar: f.radar,
    rf: f.rf,
    battery: f.battery,
    ble: f.ble,
    bleProbe: f.bleProbe,
    osint: f.osint,
  });
}

/** Resume un viaje grabado con métricas reales (null cuando el sensor no aportó datos). */
export function summarizeBlackBox(frames) {
  if (!Array.isArray(frames) || !frames.length) {
    return {
      frames: 0, durationS: 0, distanceKm: 0, maxSpeedKmh: null, meanSpeedKmh: null,
      maxBrakingMs2: null, maxAccelMs2: null, maxLatG: null, maxNormG: null, maxImuG: null,
      batteryStartPct: null, batteryEndPct: null, batteryDropPct: null, batteryDrainPctPerHr: null,
      offlineTransitions: 0, deadZoneSamples: 0, deadZones: [],
      visionFrames: 0, adasRedFrames: 0, adasAmberFrames: 0, meanInferMs: null, rawTracksRecorded: 0,
      aiHzMin: null, aiHzMax: null,
      corridorAlertFrames: 0, radarAlertFrames: 0, sectionTrackedFrames: 0,
      bleTxMax: 0, bleRxMax: 0, bleRejectedMax: 0,
      bleProbePings: 0, bleProbePongs: 0, bleProbeMedianRttMs: null,
    };
  }
  const durationS = Math.max(0, +((frames.at(-1).t - frames[0].t) / 1000).toFixed(1));
  let distM = 0, prevPos = null;
  const speeds = [], axVals = [], ayG = [], normG = [], imuG = [], inferVals = [], hzVals = [];
  let batStart = null, batEnd = null, batStartT = null, batEndT = null;
  let offlineTransitions = 0, prevOnline = null, deadZoneSamples = 0;
  const deadZones = [];
  let visionFrames = 0, adasRedFrames = 0, adasAmberFrames = 0, rawTracksRecorded = 0;
  let corridorAlertFrames = 0, radarAlertFrames = 0, sectionTrackedFrames = 0;
  let bleTxMax = 0, bleRxMax = 0, bleRejectedMax = 0;
  let bleProbePings = 0, bleProbePongs = 0, bleProbeMedianRttMs = null;

  for (const f of frames) {
    if (Array.isArray(f.pos) && f.pos.length === 2) {
      if (prevPos) {
        const step = haversineM(prevPos, f.pos);
        if (step < 500) distM += step;
      }
      prevPos = f.pos;
    }
    if (f.speedMs != null) speeds.push(f.speedMs * 3.6);
    if (f.kin?.axMs2 != null) axVals.push(f.kin.axMs2);
    if (f.kin?.ayMs2 != null) ayG.push(Math.abs(f.kin.ayMs2) / G_STD);
    if (f.kin?.aNormG != null) normG.push(f.kin.aNormG);
    if (f.imu && (f.imu.ax != null || f.imu.ay != null || f.imu.az != null)) {
      imuG.push(Math.hypot(f.imu.ax ?? 0, f.imu.ay ?? 0, f.imu.az ?? 0) / G_STD);
    }
    if (f.battery?.pct != null) {
      if (batStart == null) { batStart = f.battery.pct; batStartT = f.t; }
      batEnd = f.battery.pct; batEndT = f.t;
    }
    if (f.rf?.online != null) {
      if (prevOnline === true && f.rf.online === false) offlineTransitions++;
      prevOnline = f.rf.online;
      if (f.rf.online === false) {
        deadZoneSamples++;
        if (f.pos && deadZones.length < 500) {
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
      if (f.vision.hz != null) hzVals.push(f.vision.hz);
      if (Array.isArray(f.vision.tracks)) rawTracksRecorded += f.vision.tracks.length;
    }
    if (f.corridor?.topCat) corridorAlertFrames++;
    if (f.radar?.topId) radarAlertFrames++;
    if (f.radar?.sectionId) sectionTrackedFrames++;
    if (f.ble) {
      if (f.ble.tx > bleTxMax) bleTxMax = f.ble.tx;
      if (f.ble.rx > bleRxMax) bleRxMax = f.ble.rx;
      if (f.ble.rejected > bleRejectedMax) bleRejectedMax = f.ble.rejected;
    }
    if (f.bleProbe) {
      if (f.bleProbe.pingsSent > bleProbePings) bleProbePings = f.bleProbe.pingsSent;
      if (f.bleProbe.pongsReceived > bleProbePongs) bleProbePongs = f.bleProbe.pongsReceived;
      if (f.bleProbe.medianRttMs != null) bleProbeMedianRttMs = f.bleProbe.medianRttMs;
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
    maxImuG: imuG.length ? +Math.max(...imuG).toFixed(3) : null,
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
    rawTracksRecorded,
    aiHzMin: hzVals.length ? Math.min(...hzVals) : null,
    aiHzMax: hzVals.length ? Math.max(...hzVals) : null,
    corridorAlertFrames,
    radarAlertFrames,
    sectionTrackedFrames,
    bleTxMax,
    bleRxMax,
    bleRejectedMax,
    bleProbePings,
    bleProbePongs,
    bleProbeMedianRttMs,
  };
}

/** Crea una instancia de caja negra en memoria circular (4 h por defecto a 1 Hz). */
export function createBlackBox({ maxFrames = 14400, appVersion = 'senda-conducir' } = {}) {
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
     * Registra una muestra de telemetría completa para calibración real (sin vídeo ni PII, null si falta sensor).
     */
    record({
      t = Date.now(), pos = null, accuracyM = null, altM = null, altAccuracyM = null,
      speedMs = null, headingDeg = null, imu = null,
      vision = null, corridor = null, radar = null, section = null,
      rf = null, battery = null, ble = null, bleProbe = null, osint = null,
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
      const topRadar = radar?.top ?? (radar?.id ? radar : null);
      const secState = section ?? radar?.section ?? null;
      const entry = {
        seq: ++seq,
        t: Math.floor(t),
        pos: cleanPos,
        accuracyM: numOrNull(accuracyM, 1),
        altM: numOrNull(altM, 1),
        altAccuracyM: numOrNull(altAccuracyM, 1),
        speedMs: spd,
        headingDeg: hdg,
        kin,
        imu: cleanImu(imu),
        ssdM: ssd != null ? +ssd.toFixed(1) : null,
        rss: computeRssSnapshot(spd),
        vision: vision ? {
          active: !!vision.active,
          count: numOrNull(vision.count, 0) ?? 0,
          level: vision.level ?? 'VERDE',
          minTtcS: numOrNull(vision.minTtcS, 2),
          clipped: numOrNull(vision.clipped, 0) ?? 0,
          inferMs: numOrNull(vision.inferMs, 1),
          hz: numOrNull(vision.hz, 1),
          tracks: cleanTracks(vision.tracks),
        } : null,
        corridor: corridor ? {
          mode: corridor.mode ?? null,
          count: numOrNull(corridor.dedupedCount, 0) ?? 0,
          topCat: corridor.top?.cat ?? null,
          topRoad: corridor.top?.road || null,
          topDistM: numOrNull(corridor.top?.distM, 0),
          topUrgency: corridor.top?.urgency ?? null,
          topSource: corridor.top?.source ?? null,
          items: cleanCorridorItems(corridor.items),
        } : null,
        radar: (topRadar || secState) ? {
          count: Array.isArray(radar?.items) ? radar.items.length : (topRadar ? 1 : 0),
          topId: topRadar?.id ?? null,
          topKind: topRadar?.kind ?? null,
          topRoad: topRadar?.road || null,
          topDistM: numOrNull(topRadar?.distM, 0),
          topMaxspeed: numOrNull(topRadar?.maxspeed, 0),
          topOverLimit: typeof topRadar?.overLimit === 'boolean' ? topRadar.overLimit : null,
          topSrc: topRadar?.src ?? null,
          sectionId: secState?.id ?? null,
          sectionAvgKmh: numOrNull(secState?.avgKmh, 1),
          sectionMaxspeed: numOrNull(secState?.maxspeed, 0),
          sectionRemainingM: numOrNull(secState?.remainingM, 0),
          sectionOverAvg: typeof secState?.overAverage === 'boolean' ? secState.overAverage : null,
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
        bleProbe: bleProbe ? {
          pingsSent: numOrNull(bleProbe.pingsSent, 0) ?? 0,
          pongsReceived: numOrNull(bleProbe.pongsReceived, 0) ?? 0,
          pingsAnswered: numOrNull(bleProbe.pingsAnswered, 0) ?? 0,
          corrupted: numOrNull(bleProbe.corrupted, 0) ?? 0,
          responseRate: numOrNull(bleProbe.responseRate, 3),
          medianRttMs: numOrNull(bleProbe.medianRttMs, 2),
          lastRttMs: numOrNull(bleProbe.lastRttMs, 2),
        } : null,
        osint: osint ? {
          count: numOrNull(osint.count, 0) ?? 0,
          closestKm: numOrNull(osint.closestKm, 1),
          topType: osint.topType ?? null,
          topLevel: osint.topLevel ?? null,
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
        const hash = await sha256Hex(`${prevHash}|${canonicalFramePayload(f, BLACKBOX_SCHEMA)}`);
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

/** Verifica criptográficamente una caja negra exportada v1 o v2 (detecta cualquier edición o borrado). */
export async function verifyBlackBox(doc) {
  if (!doc || !SUPPORTED_SCHEMAS.includes(doc.schema) || !Array.isArray(doc.frames)) {
    return { ok: false, count: 0, brokenAt: null, reason: 'esquema no válido' };
  }
  let prev = GENESIS_HASH;
  for (let i = 0; i < doc.frames.length; i++) {
    const f = doc.frames[i];
    if (f.prevHash !== prev) return { ok: false, count: doc.frames.length, brokenAt: i, reason: 'prevHash roto' };
    const expected = await sha256Hex(`${prev}|${canonicalFramePayload(f, doc.schema)}`);
    if (f.hash !== expected) return { ok: false, count: doc.frames.length, brokenAt: i, reason: 'hash alterado' };
    prev = expected;
  }
  if (doc.chainTipHash !== prev) {
    return { ok: false, count: doc.frames.length, brokenAt: doc.frames.length - 1, reason: 'chainTipHash no coincide' };
  }
  return { ok: true, count: doc.frames.length, brokenAt: null, reason: null };
}

