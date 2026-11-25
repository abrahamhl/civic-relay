/**
 * SENDA · Peritaje ciudadano multimodal automático (`report-forensics.mjs`).
 *
 * Convierte uno o más sobres ciudadanos firmados (`citizen-report.mjs`) en un **expediente pericial**
 * auditable donde cada prueba declara su peso, su tasa de error (publicada o marcada «no calibrada»)
 * y su fuente. Nunca usa «detectores mágicos» ni inventa datos; nunca activa `canPublicWarn`.
 *
 * Cinco pilares independientes:
 *  1. Coherencia del dispositivo y del archivo: desfase de reloj, salto cinemático, coherencia EXIF,
 *     altitud barométrica (atmósfera estándar OACI Doc 7488 / ISA), presencia estructural C2PA (sin
 *     ancla CA no prueba autenticidad), huella perceptual dHash-64 para detectar imágenes reutilizadas
 *     (Zauner 2010; Krawetz 2013) y saneamiento anti-inyección de instrucciones (MITRE ATLAS).
 *  2. Contexto físico: hidrología (Témez 5.2-IC, Kirpich 1940 vía `hydro-estimates.mjs`), incendio y
 *     combustible (`fire-watch.mjs`, `fire-science.mjs`), desprendimientos por pendiente Horn (1981)
 *     y umbrales intensidad-duración de lluvia de Caine (1980, DOI 10.1080/04353676.1980.11879996) y
 *     Guzzetti et al. (2008, DOI 10.1007/s10346-007-0112-1), con distinción explícita entre ausencia
 *     observada (`ABSENT`) y fallo de sensor (`COLLECTION_ERROR`).
 *  3. Satélite y fuentes oficiales: próximo paso sobre el punto con TLE reales (`orbital.mjs`), índices
 *     espectrales Sentinel-2 (NDVI Rouse 1974; NDWI McFeeters 1996 DOI 10.1080/01431169608948714;
 *     NBR/dNBR Key & Benson 2006) y cobertura radar Sentinel-1 a través de nubes, más control de
 *     independencia de fuentes (`cross-source.mjs` y `source-evidence.mjs`).
 *  4. Otros ciudadanos y cámaras de quien pasa: deduplicación por seudónimo, grupo (`groupHint`),
 *     ráfaga colocalizada e imagen repetida (dos personas del mismo grupo no cuentan doble) + integración
 *     con `hazard-verify.mjs` exigiendo permiso explícito y `sharesImage: false`.
 *  5. Fiabilidad de quien avisa: estimación EM de matriz de confusión latente de Dawid y Skene (1979,
 *     Applied Statistics 28(1):20-28, DOI 10.2307/2346806) sobre seudónimos (sin exponer identidad).
 */

import {
  CITIZEN_HAZARD_TYPES,
  CONFIDENCE_STATES,
  verifyCitizenReport,
  createEvidenceChain,
  sha256HexCanonical,
} from './citizen-report.mjs';
import { haversineKm } from './zones.mjs';
import { dependencyOf } from './cross-source.mjs';
import { checkCorroborationIndependence } from './source-evidence.mjs';
import { verifyReport } from './hazard-verify.mjs';
import { parseTleFile, predictPasses, TLE_CHECKSUM_VALID } from './orbital.mjs';
import { fireWeather } from './fire-watch.mjs';
import { slopeAspect } from './fire-science.mjs';
import { temezHours, kirpichMinutes } from './hydro-estimates.mjs';

/**
 * Tasas de error y estado de calibración declarados por señal pericial.
 * Ninguna señal oculta su incertidumbre ni finge precisión 100 %.
 */
export const FORENSIC_SIGNALS_META = Object.freeze({
  dhash64_duplicate: Object.freeze({
    method: 'dHash 64-bit (gradiente horizontal 9×8, Zauner 2010 / Krawetz 2013)',
    thresholdHamming: 6,
    falsePositiveRate: 'NO_CALIBRADO_EN_CAMPO (referencia bibliográfica en bancos estándar < 1 % para Hamming ≤ 6; imágenes muy uniformes como cielo/niebla pueden colisionar)',
    basis: 'MODEL',
  }),
  c2pa_structure: Object.freeze({
    method: 'Inspección estructural de cajas JUMBF/C2PA en bytes crudos (especificación C2PA v2.1)',
    falsePositiveRate: 'Presencia estructural != verificación criptográfica X.509; sin ancla de confianza institucional se marca C2PA_PRESENT_UNANCHORED',
    basis: 'MODEL',
  }),
  barometric_altitude: Object.freeze({
    method: 'Fórmula hipsométrica ISA / OACI Doc 7488: h = 44330 · (1 − (P/P0)^(1/5.255))',
    uncertaintyM: '±15–40 m según variación meteorológica local de P0 si no se aporta QNH cercano',
    basis: 'MODEL',
  }),
  landslide_caine1980: Object.freeze({
    method: 'Caine (1980), Geografiska Annaler 62A:23-27, DOI 10.1080/04353676.1980.11879996: I = 14.82 · D^(-0.39)',
    validDurationH: [0.167, 240],
    caveat: 'Umbral global de deslizamientos superficiales; puede variar por litología y humedad antecedente local',
    basis: 'MODEL',
  }),
  landslide_guzzetti2008: Object.freeze({
    method: 'Guzzetti et al. (2008), Landslides 5:3-17, DOI 10.1007/s10346-007-0112-1: I = 2.20 · D^(-0.44)',
    validDurationH: [0.1, 1000],
    caveat: 'Umbral global conservador (límite inferior); útil como cribado de plausibilidad, no como predicción determinista',
    basis: 'MODEL',
  }),
  dawid_skene_1979: Object.freeze({
    method: 'Dawid & Skene (1979), Applied Statistics 28(1):20-28, DOI 10.2307/2346806 (EM con suavizado Beta)',
    caveat: 'Requiere ≥ 10 casos con verdad terreno por seudónimo para marcarse calibrado; sin historial converge al prior neutro',
    basis: 'ESTIMATED',
  }),
});

/* ───────────── 1. Utilidades forenses: dHash-64, C2PA, barómetro y anti-inyección ───────────── */

/**
 * Calcula una huella perceptual dHash de 64 bits (16 hex) sobre una imagen RGBA o escala de grises.
 * Reescalado bilineal a 9×8 y comparación de gradiente horizontal p[x] > p[x+1] (Krawetz 2013; Zauner 2010).
 */
export function computeDHash64(pixels, width, height, { channels = 4 } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new RangeError('computeDHash64: width y height deben ser enteros ≥ 2');
  }
  if (channels !== 1 && channels !== 4) throw new RangeError('computeDHash64: channels debe ser 1 (gris) o 4 (RGBA)');
  if (pixels.length < width * height * channels) throw new RangeError('computeDHash64: búfer demasiado pequeño');

  const grayAt = (x, y) => {
    const ix = Math.min(width - 1, Math.max(0, x));
    const iy = Math.min(height - 1, Math.max(0, y));
    const idx = (iy * width + ix) * channels;
    if (channels === 1) return pixels[idx];
    // Luminancia Rec. 709: 0.2126 R + 0.7152 G + 0.0722 B
    return 0.2126 * pixels[idx] + 0.7152 * pixels[idx + 1] + 0.0722 * pixels[idx + 2];
  };

  const gw = 9, gh = 8;
  const small = new Float64Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const sy = ((j + 0.5) * height) / gh - 0.5;
    const y0 = Math.floor(sy), ty = sy - y0;
    for (let i = 0; i < gw; i++) {
      const sx = ((i + 0.5) * width) / gw - 0.5;
      const x0 = Math.floor(sx), tx = sx - x0;
      const v00 = grayAt(x0, y0), v10 = grayAt(x0 + 1, y0);
      const v01 = grayAt(x0, y0 + 1), v11 = grayAt(x0 + 1, y0 + 1);
      small[j * gw + i] = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    }
  }

  let bits = 0n;
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < 8; i++) {
      bits = (bits << 1n) | (small[j * gw + i] > small[j * gw + i + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/** Distancia de Hamming (0–64 bits) entre dos huellas perceptuales hexadecimales de 64 bits. */
export function hammingDistanceHex64(a, b) {
  if (!/^[a-fA-F0-9]{16}$/.test(String(a)) || !/^[a-fA-F0-9]{16}$/.test(String(b))) {
    throw new RangeError('hammingDistanceHex64: se esperan cadenas hexadecimales de 16 caracteres');
  }
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let count = 0;
  while (x > 0n) {
    x &= x - 1n;
    count++;
  }
  return count;
}

/**
 * Inspecciona bytes crudos en busca de cabeceras estructurales JUMBF/C2PA (`jumb` + `c2pa`).
 * NOTA DE VERACIDAD: detectar la estructura NO verifica la cadena X.509 ni la revocación.
 */
export function inspectC2paBytes(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const latin1 = new TextDecoder('latin1').decode(u);
  const hasJumb = latin1.includes('jumb');
  const hasC2pa = latin1.includes('c2pa') || latin1.includes('c2pa.assertions');
  const present = hasJumb && hasC2pa;
  return Object.freeze({
    present,
    status: present ? 'C2PA_PRESENT_UNANCHORED' : 'C2PA_ABSENT',
    cryptographicallyVerified: false,
    note: present
      ? 'Manifiesto C2PA/JUMBF detectado en estructura; requiere verificación de cadena X.509 frente a lista de confianza oficial'
      : 'Sin manifiesto C2PA; la ausencia no implica manipulación (la mayoría de móviles actuales no firman C2PA)',
  });
}

/** Altitud barométrica (m) según atmósfera estándar ISA (OACI Doc 7488). Exige `seaLevelHpa` explícito. */
export function barometricAltitudeM(pressureHpa, seaLevelHpa) {
  if (!Number.isFinite(pressureHpa) || pressureHpa <= 0) throw new RangeError('pressureHpa obligatorio (> 0)');
  if (!Number.isFinite(seaLevelHpa) || seaLevelHpa <= 0) throw new RangeError('seaLevelHpa (QNH de referencia) obligatorio (> 0)');
  return 44330 * (1 - (pressureHpa / seaLevelHpa) ** (1 / 5.255));
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+prompt/i,
  /\bcanPublicWarn\s*[:=]\s*true\b/i,
  /\boverride\s+(level|authority|n5)\b/i,
  /<script\b/i,
  /emitir\s+alerta\s+autom[aá]tica/i,
];

/**
 * Saneamiento anti-inyección (MITRE ATLAS, adaptado de Civil Sentry):
 * marca patrones de inyección de instrucciones en texto libre ciudadano o metadatos EXIF
 * para impedir que ningún adaptador los trate como órdenes del sistema.
 */
export function sanitizeUntrustedText(text) {
  const raw = String(text ?? '');
  const matched = INJECTION_PATTERNS.filter((re) => re.test(raw)).map((re) => re.source);
  const cleaned = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return Object.freeze({
    cleaned,
    suspiciousInjection: matched.length > 0,
    matchedPatterns: Object.freeze(matched),
    trustBoundary: 'UNTRUSTED_CITIZEN_TEXT',
  });
}

/* ───────────── 2. Pilar 1: Coherencia del dispositivo ───────────── */

/**
 * Evalúa la coherencia técnica del dispositivo y los adjuntos del reporte.
 * Todos los umbrales de tolerancia se declaran explícitamente en `policy` (sin valores ocultos).
 */
export async function checkDeviceCoherence(envelope, ctx = {}) {
  const ver = await verifyCitizenReport(envelope);
  if (!ver.ok) {
    return {
      pillar: 'device_coherence',
      passed: false,
      disqualified: true,
      logOddsDelta: -5,
      confidence: 'CONTRADICTED',
      findings: [{ code: 'INVALID_SIGNATURE_OR_SCHEMA', severity: 'CRITICAL', detail: ver.reason }],
      basis: 'MODEL',
    };
  }

  const receivedAtMs = ctx.receivedAtMs;
  if (!Number.isFinite(receivedAtMs)) throw new TypeError('checkDeviceCoherence: receivedAtMs (ms) obligatorio');

  const maxFutureSkewMs = ctx.maxFutureSkewMs ?? 5 * 60_000;
  const maxPastAgeMs = ctx.maxPastAgeMs ?? 72 * 3600_000;
  const maxGroundSpeedMs = ctx.maxGroundSpeedMs ?? 80; // ~288 km/h (tren AVE máx. ~310 km/h → ajustar en ferrocarril)
  const dhashMaxHamming = ctx.dhashMaxHamming ?? 6;
  const findings = [];
  let logOddsDelta = 0;
  let disqualified = false;

  const p = envelope.payload;
  const skewMs = p.capturedAtMs - receivedAtMs;

  if (skewMs > maxFutureSkewMs) {
    disqualified = true;
    logOddsDelta -= 3.5;
    findings.push({
      code: 'FUTURE_CLOCK_SKEW',
      severity: 'HIGH',
      detail: `Hora del dispositivo adelantada ${Math.round(skewMs / 1000)} s respecto al reloj de referencia (límite ${Math.round(maxFutureSkewMs / 1000)} s)`,
      errorRate: 'Regla operativa declarada (desfase NTP/reloj local posible en terminales sin red)',
    });
  } else if (receivedAtMs - p.capturedAtMs > maxPastAgeMs) {
    logOddsDelta -= 1.2;
    findings.push({
      code: 'STALE_CAPTURE_TIME',
      severity: 'MEDIUM',
      detail: `Reporte antiguo (${((receivedAtMs - p.capturedAtMs) / 3600_000).toFixed(1)} h antes de la recepción)`,
      errorRate: 'Puede ocurrir legítimamente tras un apagón o entrega diferida por malla DTN',
    });
  } else {
    logOddsDelta += 0.3;
    findings.push({ code: 'CLOCK_COHERENT', severity: 'OK', detail: `Desfase reloj ${(skewMs / 1000).toFixed(1)} s dentro de tolerancia` });
  }

  // Precisión GPS
  if (p.location.accuracyM > 500) {
    logOddsDelta -= 0.4;
    findings.push({ code: 'LOW_GPS_ACCURACY', severity: 'LOW', detail: `Precisión GPS degradada (±${p.location.accuracyM} m)` });
  } else {
    logOddsDelta += 0.2;
    findings.push({ code: 'GPS_ACCURACY_OK', severity: 'OK', detail: `Precisión GPS ±${p.location.accuracyM} m` });
  }

  // Salto cinemático imposible con reportes previos del mismo seudónimo
  const prevSameKey = (ctx.priorReportsFromSameKey ?? []).filter(
    (r) => r.reportId !== envelope.reportId && r.signature?.pseudonymId === envelope.signature.pseudonymId
  );
  const speedLimit = p.kind === 'ferrocarril' ? Math.max(maxGroundSpeedMs, 100) : maxGroundSpeedMs;
  for (const prev of prevSameKey) {
    const dtS = Math.abs(p.capturedAtMs - prev.payload.capturedAtMs) / 1000;
    if (dtS < 1) continue;
    const distM = haversineKm(p.location, prev.payload.location) * 1000;
    const vMs = distM / dtS;
    if (vMs > speedLimit && distM > 2 * (p.location.accuracyM + prev.payload.location.accuracyM)) {
      disqualified = true;
      logOddsDelta -= 3.0;
      findings.push({
        code: 'IMPOSSIBLE_KINEMATIC_JUMP',
        severity: 'HIGH',
        detail: `Desplazamiento implausible de ${(distM / 1000).toFixed(1)} km en ${dtS.toFixed(0)} s (${vMs.toFixed(1)} m/s > límite ${speedLimit} m/s)`,
        errorRate: 'Falsos positivos posibles solo ante salto brusco de GPS/interferencia GNSS',
      });
      break;
    }
  }

  // Coherencia barométrica frente a altitud DEM si se aportan ambos (y QNH de referencia)
  if (p.sensors?.barometerHpa != null && Number.isFinite(ctx.demElevationM) && Number.isFinite(ctx.seaLevelHpa)) {
    const baroAlt = barometricAltitudeM(p.sensors.barometerHpa, ctx.seaLevelHpa);
    const diffM = Math.abs(baroAlt - ctx.demElevationM);
    if (diffM > 250) {
      logOddsDelta -= 0.8;
      findings.push({
        code: 'BAROMETRIC_ALTITUDE_MISMATCH',
        severity: 'MEDIUM',
        detail: `Altitud barométrica ${baroAlt.toFixed(0)} m difiere ${diffM.toFixed(0)} m del relieve (${ctx.demElevationM.toFixed(0)} m)`,
        errorRate: FORENSIC_SIGNALS_META.barometric_altitude.uncertaintyM,
      });
    } else {
      logOddsDelta += 0.35;
      findings.push({
        code: 'BAROMETRIC_ALTITUDE_COHERENT',
        severity: 'OK',
        detail: `Altitud barométrica ${baroAlt.toFixed(0)} m compatible con relieve ${ctx.demElevationM.toFixed(0)} m (Δ=${diffM.toFixed(0)} m)`,
      });
    }
  }

  // Coherencia de adjuntos: EXIF, C2PA y reutilización de imagen (dHash-64)
  const knownMediaHashes = ctx.knownMediaHashes ?? []; // [{ sha256, perceptualHashHex, reportId, capturedAtMs }]
  let reusedImageDetected = false;
  for (const m of p.media) {
    if (m.exifCapturedAtIso) {
      const exifMs = Date.parse(m.exifCapturedAtIso);
      if (Number.isFinite(exifMs) && Math.abs(exifMs - p.capturedAtMs) > 6 * 3600_000) {
        logOddsDelta -= 1.5;
        findings.push({
          code: 'EXIF_TIME_MISMATCH',
          severity: 'HIGH',
          detail: `Hora EXIF (${m.exifCapturedAtIso}) difiere > 6 h de la hora declarada (${p.capturedAtIso})`,
          errorRate: 'Los relojes de cámara sin sincronizar pueden desfasarse; revisar expediente',
        });
      }
    }
    if (m.exifLocation) {
      const dKm = haversineKm(p.location, m.exifLocation);
      if (dKm > 2) {
        logOddsDelta -= 1.5;
        findings.push({
          code: 'EXIF_GPS_MISMATCH',
          severity: 'HIGH',
          detail: `Ubicación EXIF dista ${dKm.toFixed(1)} km de la posición GPS del reporte`,
          errorRate: 'Puede ocurrir al enviar la foto ya alejado del lugar; no es prueba única de fraude',
        });
      }
    }
    if (m.c2paManifestPresent) {
      findings.push({
        code: 'C2PA_PRESENT_UNANCHORED',
        severity: 'INFO',
        detail: FORENSIC_SIGNALS_META.c2pa_structure.falsePositiveRate,
      });
    }
    // Reutilización exacta o perceptual (dHash-64)
    for (const prev of knownMediaHashes) {
      if (prev.reportId === envelope.reportId) continue;
      if (prev.sha256 && prev.sha256 === m.sha256) {
        reusedImageDetected = true;
        disqualified = true;
        logOddsDelta -= 3.5;
        findings.push({
          code: 'EXACT_MEDIA_REUSE',
          severity: 'CRITICAL',
          detail: `Archivo idéntico (SHA-256 ${m.sha256.slice(0, 12)}…) ya visto en ${prev.reportId}`,
          errorRate: 'Colisión SHA-256 despreciable (< 10^-77); puede ser reenvío del mismo archivo por otra vía',
        });
        break;
      }
      if (m.perceptualHashHex && prev.perceptualHashHex && /^[a-f0-9]{16}$/i.test(m.perceptualHashHex) && /^[a-f0-9]{16}$/i.test(prev.perceptualHashHex)) {
        const dist = hammingDistanceHex64(m.perceptualHashHex, prev.perceptualHashHex);
        if (dist <= dhashMaxHamming) {
          reusedImageDetected = true;
          // Si es de otro episodio antiguo (> 24 h antes), descalifica por imagen reciclada
          const ageDiffH = Number.isFinite(prev.capturedAtMs) ? Math.abs(p.capturedAtMs - prev.capturedAtMs) / 3600_000 : Infinity;
          if (ageDiffH > 24) disqualified = true;
          logOddsDelta -= ageDiffH > 24 ? 3.2 : 1.0;
          findings.push({
            code: ageDiffH > 24 ? 'PERCEPTUAL_MEDIA_RECYCLED' : 'PERCEPTUAL_MEDIA_DUPLICATE_SAME_EVENT',
            severity: ageDiffH > 24 ? 'CRITICAL' : 'MEDIUM',
            detail: `Huella perceptual dHash-64 coincide (Hamming=${dist} ≤ ${dhashMaxHamming}) con ${prev.reportId}`,
            errorRate: FORENSIC_SIGNALS_META.dhash64_duplicate.falsePositiveRate,
          });
          break;
        }
      }
    }
  }

  // Saneamiento anti-inyección (MITRE ATLAS)
  const textAudit = sanitizeUntrustedText(p.text);
  if (textAudit.suspiciousInjection) {
    logOddsDelta -= 1.0;
    findings.push({
      code: 'SUSPICIOUS_PROMPT_INJECTION_TEXT',
      severity: 'MEDIUM',
      detail: `Texto contiene patrones de inyección de instrucciones (${textAudit.matchedPatterns.length}); aislado como texto no fiable`,
      errorRate: 'Regla determinista de seguridad MITRE ATLAS',
    });
  }

  const passed = !disqualified && logOddsDelta > -1.5;
  return Object.freeze({
    pillar: 'device_coherence',
    passed,
    disqualified,
    reusedImageDetected,
    logOddsDelta: +logOddsDelta.toFixed(3),
    confidence: disqualified ? 'CONTRADICTED' : passed ? 'SUPPORTED' : 'INFERRED',
    findings,
    sanitizedText: textAudit,
    basis: 'MODEL',
  });
}

/* ───────────── 3. Pilar 2: Plausibilidad física ───────────── */

/** Umbral intensidad-duración de lluvia para deslizamientos superficiales (Caine 1980, mm/h). */
export function caine1980ThresholdMmH(durationH) {
  if (!Number.isFinite(durationH) || durationH <= 0) throw new RangeError('durationH obligatorio (> 0 h)');
  return {
    intensityMmH: +(14.82 * durationH ** -0.39).toFixed(3),
    inValidRange: durationH >= 0.167 && durationH <= 240,
    source: FORENSIC_SIGNALS_META.landslide_caine1980.method,
  };
}

/** Umbral global inferior de Guzzetti et al. (2008, mm/h). */
export function guzzetti2008ThresholdMmH(durationH) {
  if (!Number.isFinite(durationH) || durationH <= 0) throw new RangeError('durationH obligatorio (> 0 h)');
  return {
    intensityMmH: +(2.20 * durationH ** -0.44).toFixed(3),
    inValidRange: durationH >= 0.1 && durationH <= 1000,
    source: FORENSIC_SIGNALS_META.landslide_guzzetti2008.method,
  };
}

/**
 * Contrasta el reporte con la física disponible del entorno (hidrología, incendio, pendiente/lluvia).
 * Respeta el principio de ausencia-como-evidencia (`OBSERVED | ABSENT | COLLECTION_ERROR`).
 */
export function checkPhysicalContext(envelope, envCtx = {}) {
  const p = envelope.payload;
  const kind = p.kind;
  const findings = [];
  let logOddsDelta = 0;
  let observationStatus = 'OBSERVED';
  let confidence = 'UNKNOWN';

  // --- Hidrología (inundacion / nivel_agua) ---
  if (kind === 'inundacion' || kind === 'nivel_agua') {
    let checked = false;
    if (envCtx.rainfallMm != null && Number.isFinite(envCtx.rainfallDurationH) && envCtx.rainfallDurationH > 0) {
      checked = true;
      const intensityMmH = envCtx.rainfallMm / envCtx.rainfallDurationH;
      if (envCtx.rainfallMm >= 30 || intensityMmH >= 15) {
        logOddsDelta += 1.1;
        findings.push({
          code: 'HYDRO_RAINFALL_CONSISTENT',
          detail: `Lluvia acumulada ${envCtx.rainfallMm.toFixed(1)} mm en ${envCtx.rainfallDurationH} h (${intensityMmH.toFixed(1)} mm/h) compatible con crecida`,
          source: envCtx.rainfallSource ?? 'conector pluviométrico',
        });
      } else if (envCtx.rainfallMm < 2 && !envCtx.upstreamDamRelease) {
        logOddsDelta -= 0.7;
        findings.push({
          code: 'HYDRO_LOW_LOCAL_RAIN',
          detail: `Lluvia local muy baja (${envCtx.rainfallMm.toFixed(1)} mm); una crecida en llanura aún puede proceder de lluvia intensa en cabecera (como en el Poyo 2024)`,
          source: envCtx.rainfallSource ?? 'conector pluviométrico',
        });
      }
    }
    if (envCtx.watershedLengthM > 0 && envCtx.watershedSlope > 0) {
      checked = true;
      const tcTemezH = temezHours(envCtx.watershedLengthM / 1000, envCtx.watershedSlope);
      const tcKirpichMin = kirpichMinutes(envCtx.watershedLengthM, envCtx.watershedSlope);
      findings.push({
        code: 'HYDRO_WATERSHED_TIMESCALE',
        detail: `Tiempo de concentración de cuenca estimado: Témez ${(tcTemezH * 60).toFixed(0)} min · Kirpich ${tcKirpichMin.toFixed(0)} min`,
        source: 'Norma 5.2-IC (BOE-A-2016-2405) y Kirpich (1940) vía hydro-estimates.mjs',
      });
    }
    if (envCtx.gaugeReading) {
      const g = envCtx.gaugeReading;
      if (g.observationStatus === 'COLLECTION_ERROR') {
        observationStatus = 'COLLECTION_ERROR';
        findings.push({
          code: 'GAUGE_OFFLINE_UNKNOWN',
          detail: `Aforo ${g.stationId ?? '?'} sin respuesta (${g.error ?? 'timeout'}); no cuenta ni a favor ni en contra`,
          source: g.source ?? 'aforo',
        });
      } else if (g.observationStatus === 'OBSERVED' && Number.isFinite(g.flowM3s) && Number.isFinite(g.warningThresholdM3s) && g.flowM3s >= g.warningThresholdM3s) {
        checked = true;
        logOddsDelta += g.authenticated ? 2.2 : 0.6;
        findings.push({
          code: 'GAUGE_CONFIRMS_RISE',
          detail: `Aforo ${g.stationId} marca ${g.flowM3s} m³/s ≥ umbral ${g.warningThresholdM3s} m³/s (${g.authenticated ? 'autenticado' : 'sin autenticar'})`,
          source: g.source ?? 'aforo',
        });
      } else if (g.observationStatus === 'ABSENT' && g.authenticated) {
        checked = true;
        observationStatus = 'ABSENT';
        logOddsDelta -= 1.8;
        findings.push({
          code: 'GAUGE_CONTRADICTS_FLAT',
          detail: `Aforo autenticado ${g.stationId} en el mismo cauce sin anomalía ni subida (${g.flowM3s ?? 0} m³/s)`,
          source: g.source ?? 'aforo',
        });
      }
    }
    if (Number.isFinite(envCtx.handM)) {
      checked = true;
      if (envCtx.handM <= 6) {
        logOddsDelta += 0.4;
        findings.push({ code: 'HAND_FLOODPLAIN_PLAUSIBLE', detail: `HAND=${envCtx.handM.toFixed(1)} m sobre cauce: llanura inundable plausible` });
      } else if (envCtx.handM > 35 && kind === 'inundacion') {
        logOddsDelta -= 1.0;
        findings.push({ code: 'HAND_HIGH_GROUND_ANOMALY', detail: `HAND=${envCtx.handM.toFixed(1)} m sobre el cauce más cercano: inundación fluvial improbable (posible balsa local o error GPS)` });
      }
    }
    confidence = !checked ? 'UNKNOWN' : logOddsDelta >= 0.8 ? 'SUPPORTED' : logOddsDelta <= -1.0 ? 'CONTRADICTED' : 'INFERRED';
  }

  // --- Incendio / Combustible (fuego / combustible) ---
  else if (kind === 'fuego' || kind === 'combustible') {
    let checked = false;
    if (envCtx.weather && [envCtx.weather.tempC, envCtx.weather.rh, envCtx.weather.windKmh].every(Number.isFinite)) {
      checked = true;
      const fw = fireWeather(envCtx.weather);
      if (fw.deadFuelMoisturePct <= 10 || fw.ffwi >= 40 || fw.rule30.count >= 2) {
        logOddsDelta += 1.1;
        findings.push({
          code: 'FIRE_WEATHER_FAVORABLE',
          detail: `Meteorología propicia: humedad combustible muerto ${fw.deadFuelMoisturePct} %, FFWI ${fw.ffwi}, regla 30-30-30 (${fw.rule30.count}/3)`,
          source: 'Simard (1968), Fosberg (1978) vía fire-watch.mjs',
        });
      } else if (envCtx.weather.rh >= 85 && (envCtx.rainfallMm ?? 0) >= 10) {
        logOddsDelta -= 1.2;
        findings.push({
          code: 'FIRE_WEATHER_UNFAVORABLE',
          detail: `Humedad relativa ${envCtx.weather.rh} % y lluvia ${envCtx.rainfallMm} mm hacen improbable un incendio activo en vegetación`,
          source: 'fire-watch.mjs',
        });
      } else {
        logOddsDelta += 0.2;
        findings.push({ code: 'FIRE_WEATHER_MODERATE', detail: `Condiciones moderadas: FFWI ${fw.ffwi}, EMC ${fw.deadFuelMoisturePct} %` });
      }
    }
    if (envCtx.fuelClass != null) {
      checked = true;
      if (envCtx.fuelClass === 0) {
        logOddsDelta -= 2.0;
        findings.push({ code: 'FUEL_CLASS_WATER', detail: 'La celda de combustible indica agua (clase 0): ignición terrestre implausible' });
      } else if (envCtx.fuelClass >= 1 && envCtx.fuelClass <= 3) {
        logOddsDelta += 0.5;
        findings.push({ code: 'FUEL_CLASS_COMBUSTIBLE', detail: `Combustible vegetal presente (clase ${envCtx.fuelClass})` });
      }
    }
    confidence = !checked ? 'UNKNOWN' : logOddsDelta >= 0.8 ? 'SUPPORTED' : logOddsDelta <= -1.0 ? 'CONTRADICTED' : 'INFERRED';
  }

  // --- Desprendimiento (Horn 1981 + Caine 1980 / Guzzetti 2008) ---
  else if (kind === 'desprendimiento') {
    let checked = false;
    let slopeDeg = Number.isFinite(envCtx.slopeDeg) ? envCtx.slopeDeg : null;
    if (slopeDeg === null && envCtx.demPatch && envCtx.demPatch.dem && envCtx.demPatch.w >= 3 && envCtx.demPatch.h >= 3) {
      const { slope } = slopeAspect(envCtx.demPatch.dem, envCtx.demPatch.w, envCtx.demPatch.h, envCtx.demPatch.resM);
      const ci = Math.floor(envCtx.demPatch.w / 2), cj = Math.floor(envCtx.demPatch.h / 2);
      slopeDeg = slope[cj * envCtx.demPatch.w + ci];
    }
    if (Number.isFinite(slopeDeg)) {
      checked = true;
      if (slopeDeg >= 15) {
        logOddsDelta += 0.9;
        findings.push({
          code: 'LANDSLIDE_SLOPE_PLAUSIBLE',
          detail: `Pendiente local ${slopeDeg.toFixed(1)}° (Horn 1981): compatible con inestabilidad de ladera o talud`,
          source: 'Horn (1981), Proc. IEEE 69(1):14-47 vía fire-science.mjs',
        });
      } else if (slopeDeg < 3) {
        logOddsDelta -= 1.3;
        findings.push({
          code: 'LANDSLIDE_FLAT_TERRAIN',
          detail: `Pendiente muy baja (${slopeDeg.toFixed(1)}°): deslizamiento natural improbable (salvo talud artificial no resuelto por el DEM)`,
          source: 'Horn (1981) vía fire-science.mjs',
        });
      }
    }
    if (Number.isFinite(envCtx.rainfallMm) && Number.isFinite(envCtx.rainfallDurationH) && envCtx.rainfallDurationH > 0) {
      checked = true;
      const intensity = envCtx.rainfallMm / envCtx.rainfallDurationH;
      const caine = caine1980ThresholdMmH(envCtx.rainfallDurationH);
      const guzz = guzzetti2008ThresholdMmH(envCtx.rainfallDurationH);
      if (intensity >= caine.intensityMmH) {
        logOddsDelta += 1.4;
        findings.push({
          code: 'LANDSLIDE_ABOVE_CAINE_1980',
          detail: `Intensidad ${intensity.toFixed(2)} mm/h en ${envCtx.rainfallDurationH} h supera Caine (1980) (${caine.intensityMmH} mm/h) y Guzzetti (2008) (${guzz.intensityMmH} mm/h)`,
          source: caine.source,
        });
      } else if (intensity >= guzz.intensityMmH) {
        logOddsDelta += 0.7;
        findings.push({
          code: 'LANDSLIDE_ABOVE_GUZZETTI_2008',
          detail: `Intensidad ${intensity.toFixed(2)} mm/h supera el umbral inferior de Guzzetti et al. (2008) (${guzz.intensityMmH} mm/h)`,
          source: guzz.source,
        });
      } else {
        findings.push({
          code: 'LANDSLIDE_BELOW_RAIN_THRESHOLDS',
          detail: `Intensidad ${intensity.toFixed(2)} mm/h por debajo de Guzzetti (${guzz.intensityMmH} mm/h); no descarta caída de rocas seca o sísmica`,
          source: guzz.source,
        });
      }
    }
    confidence = !checked ? 'UNKNOWN' : logOddsDelta >= 0.8 ? 'SUPPORTED' : logOddsDelta <= -1.0 ? 'CONTRADICTED' : 'INFERRED';
  }

  // --- Carretera / Visibilidad / Accidente / Ferrocarril / SOS / Otro ---
  else {
    let checked = false;
    if (p.sensors?.accelMs2 && (kind === 'accidente' || kind === 'ferrocarril')) {
      checked = true;
      const g = Math.hypot(p.sensors.accelMs2.x, p.sensors.accelMs2.y, p.sensors.accelMs2.z) / 9.80665;
      if (Math.abs(g - 1) >= 1.5) {
        logOddsDelta += 0.9;
        findings.push({ code: 'HIGH_G_SENSOR_SIGNATURE', detail: `Acelerómetro registra anomalía de ${g.toFixed(2)} g compatible con impacto o sacudida` });
      }
    }
    if (Number.isFinite(envCtx.distanceToCorridorM)) {
      checked = true;
      if (envCtx.distanceToCorridorM <= 150) {
        logOddsDelta += 0.5;
        findings.push({ code: 'NEAR_TRANSPORT_CORRIDOR', detail: `Posición a ${envCtx.distanceToCorridorM.toFixed(0)} m del corredor vial/ferroviario` });
      } else if (envCtx.distanceToCorridorM > 1500 && (kind === 'carretera' || kind === 'ferrocarril')) {
        logOddsDelta -= 1.0;
        findings.push({ code: 'FAR_FROM_CORRIDOR', detail: `Posición a ${(envCtx.distanceToCorridorM / 1000).toFixed(1)} km del trazado registrado` });
      }
    }
    if (p.people?.trapped > 0 || kind === 'sos') {
      findings.push({ code: 'LIFE_RISK_PRIORITY', detail: 'Indica posible riesgo para la vida: se mantiene recomendación inmediata de llamar al 112' });
    }
    confidence = !checked ? 'UNKNOWN' : logOddsDelta >= 0.5 ? 'SUPPORTED' : logOddsDelta <= -0.8 ? 'CONTRADICTED' : 'INFERRED';
  }

  return Object.freeze({
    pillar: 'physical_context',
    plausible: confidence !== 'CONTRADICTED',
    observationStatus,
    confidence,
    logOddsDelta: +logOddsDelta.toFixed(3),
    findings,
    basis: 'MODEL',
  });
}

/* ───────────── 4. Pilar 3: Satélite (TLE, Sentinel-1/2) y fuentes oficiales ───────────── */

/**
 * Índices espectrales Sentinel-2 MSI (bandas de reflectancia en [0, 1]):
 *  - NDVI = (B8 - B4)/(B8 + B4) (Rouse et al., 1974)
 *  - NDWI = (B3 - B8)/(B3 + B8) (McFeeters, 1996, Int. J. Remote Sens. 17:1425-1432, DOI 10.1080/01431169608948714)
 *  - NBR  = (B8 - B12)/(B8 + B12) (Key & Benson, 2006, USGS/USFS FIREMON)
 */
export function computeSpectralIndices({ b3 = null, b4 = null, b8 = null, b12 = null, preNbr = null } = {}) {
  const ratio = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a + b) > 1e-9 ? +((a - b) / (a + b)).toFixed(4) : null);
  const ndvi = ratio(b8, b4);
  const ndwi = ratio(b3, b8);
  const nbr = ratio(b8, b12);
  const dnbr = nbr !== null && Number.isFinite(preNbr) ? +(preNbr - nbr).toFixed(4) : null;
  return Object.freeze({
    ndvi,
    ndwi,
    nbr,
    dnbr,
    basis: 'MODEL',
    refs: Object.freeze([
      'NDVI: Rouse et al. (1974)',
      'NDWI: McFeeters (1996), DOI 10.1080/01431169608948714',
      'NBR/dNBR: Key & Benson (2006), USDA Forest Service RMRS-GTR-164-CD',
    ]),
  });
}

/** Qué sensores satelitales y productos son útiles para cada tipo de peligro. */
export function satelliteObservabilityPlan(kind, { cloudCoverPct = null } = {}) {
  const cloudy = Number.isFinite(cloudCoverPct) && cloudCoverPct > 35;
  const map = {
    inundacion: {
      opticalIndex: 'NDWI (Sentinel-2 B3/B8)',
      sarProduct: 'Sentinel-1 C-SAR (retrodispersión VV/VH: atraviesa nubes y lluvia)',
      recommendedSensor: cloudy ? 'Sentinel-1 SAR (óptico obstruido por nubes)' : 'Sentinel-1 SAR + Sentinel-2 NDWI',
    },
    nivel_agua: {
      opticalIndex: 'NDWI (Sentinel-2 B3/B8)',
      sarProduct: 'Sentinel-1 C-SAR (lámina de agua y desbordamiento)',
      recommendedSensor: cloudy ? 'Sentinel-1 SAR' : 'Sentinel-1 SAR + Sentinel-2 NDWI',
    },
    fuego: {
      opticalIndex: 'NBR / dNBR (Sentinel-2 B8/B12) + anomalías térmicas VIIRS/MODIS/MTG',
      sarProduct: 'Sentinel-1 coherencia (cambios estructurales tras humo denso)',
      recommendedSensor: cloudy ? 'Sentinel-1 SAR + térmico GEO (MTG)' : 'Sentinel-2 NBR + VIIRS/MTG',
    },
    combustible: {
      opticalIndex: 'NDVI (Sentinel-2 B8/B4) y NDMI para sequedad del combustible',
      sarProduct: 'Sentinel-1 humedad superficial / biomasa',
      recommendedSensor: 'Sentinel-2 NDVI',
    },
    desprendimiento: {
      opticalIndex: 'ΔNDVI (Sentinel-2 pérdida súbita de cubierta vegetal)',
      sarProduct: 'Sentinel-1 InSAR / coherencia a través de nubes',
      recommendedSensor: cloudy ? 'Sentinel-1 SAR coherencia' : 'Sentinel-2 ΔNDVI + Sentinel-1 SAR',
    },
  };
  const plan = map[kind] ?? {
    opticalIndex: 'Sentinel-2 RGB/NDVI (resolución 10 m: no resuelve objetos pequeños ni vehículos individuales)',
    sarProduct: 'Sentinel-1 C-SAR (10 m: solo grandes alteraciones de infraestructura)',
    recommendedSensor: 'Fuentes terrestres (cámaras, tráfico, verificadores) preferibles al satélite para este peligro',
  };
  return Object.freeze({ ...plan, cloudCoverPct, opticalObscuredByClouds: cloudy });
}

/**
 * Predice el próximo paso satelital sobre la ubicación del reporte (usando TLEs públicos)
 * y contrasta con fuentes oficiales/públicas vigilando la independencia entre catálogos.
 */
export function checkSatelliteAndOfficial(envelope, {
  tleText = null,
  fromMs = null,
  horizonHours = 24,
  minElevationDeg = 20,
  cloudCoverPct = null,
  spectralSample = null,
  officialRecords = [], // [{ id, source, family, lat, lon, atMs, authenticated?, observationStatus? }]
  radiusKm = 50,
  windowHours = 24,
} = {}) {
  const p = envelope.payload;
  const family = CITIZEN_HAZARD_TYPES[p.kind].family;
  const t0 = Number.isFinite(fromMs) ? fromMs : p.capturedAtMs;

  // 1. Próximos pasos satelitales sobre el punto (orbital.mjs)
  let nextPasses = [];
  let tleChecksumValidCount = 0;
  let tleTotalCount = 0;
  if (typeof tleText === 'string' && tleText.trim()) {
    const rawLines = tleText.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
    const validByName = new Map();
    for (let i = 0; i + 2 < rawLines.length; i += 3) {
      if (rawLines[i + 1]?.startsWith('1 ') && rawLines[i + 2]?.startsWith('2 ')) {
        const ok = TLE_CHECKSUM_VALID(rawLines[i + 1]) && TLE_CHECKSUM_VALID(rawLines[i + 2]);
        validByName.set(rawLines[i].trim(), ok);
        tleTotalCount++;
        if (ok) tleChecksumValidCount++;
      }
    }
    const elements = parseTleFile(tleText);
    const toMs = t0 + horizonHours * 3600_000;
    const allPasses = [];
    for (const el of elements) {
      const passes = predictPasses(el, { lat: p.location.lat, lon: p.location.lon, altKm: (p.location.altitudeM ?? 0) / 1000 }, {
        from: t0,
        to: toMs,
        stepS: 60,
        minElevationDeg,
      });
      for (const pass of passes) {
        allPasses.push({
          ...pass,
          startIso: new Date(pass.start).toISOString(),
          endIso: new Date(pass.end).toISOString(),
          minutesFromReport: Math.round((pass.start - t0) / 60_000),
          tleChecksumValid: Boolean(validByName.get(el.name)),
        });
      }
    }
    allPasses.sort((a, b) => a.start - b.start);
    nextPasses = allPasses.slice(0, 5);
  }

  const observability = satelliteObservabilityPlan(p.kind, { cloudCoverPct });
  const spectral = spectralSample ? computeSpectralIndices(spectralSample) : null;

  // 2. Contraste con fuentes oficiales / catálogos públicos y grafo de independencia
  const matched = [];
  const collectionErrors = [];
  for (const rec of officialRecords) {
    if (!rec || typeof rec !== 'object') continue;
    if (rec.observationStatus === 'COLLECTION_ERROR') {
      collectionErrors.push({ id: rec.id ?? null, source: rec.source ?? 'DESCONOCIDA', error: rec.error ?? 'ERROR' });
      continue;
    }
    if (!Number.isFinite(rec.lat) || !Number.isFinite(rec.lon) || !Number.isFinite(rec.atMs)) continue;
    if (rec.family && rec.family !== family && family !== 'OTHER') continue;
    const dKm = haversineKm(p.location, rec);
    const dtH = Math.abs(rec.atMs - p.capturedAtMs) / 3600_000;
    if (dKm <= radiusKm && dtH <= windowHours) {
      matched.push({
        id: rec.id ?? `${rec.source}:${rec.atMs}`,
        source: String(rec.source ?? 'DESCONOCIDA'),
        dKm: +dKm.toFixed(2),
        dtMin: Math.round((rec.atMs - p.capturedAtMs) / 60_000),
        authenticated: Boolean(rec.authenticated),
        observationStatus: rec.observationStatus ?? 'OBSERVED',
      });
    }
  }

  // Contar solo fuentes realmente independientes (usando cross-source + source-evidence)
  const independentSources = [];
  const dependentNotes = [];
  for (const m of matched) {
    if (m.observationStatus === 'ABSENT') continue;
    let depFound = null;
    for (const prev of independentSources) {
      const d1 = dependencyOf(prev.source, m.source);
      const d2 = checkCorroborationIndependence(prev.source, m.source);
      if ((d1 && d1.independent === false) || (!d2.independent && d2.reason !== 'UNKNOWN_SOURCE_LINEAGE')) {
        depFound = { with: prev.source, reason: d1?.note ?? d2.reason };
        break;
      }
    }
    if (depFound) {
      dependentNotes.push(`${m.source} depende de ${depFound.with} (${depFound.reason}): no cuenta doble`);
    } else {
      independentSources.push(m);
    }
  }

  // Solo un instrumento/fuente con `authenticated: true` puede elevar verificación instrumental (N3)
  const authenticatedConfirmations = independentSources.filter((m) => m.authenticated);
  const authenticatedContradictions = matched.filter((m) => m.authenticated && m.observationStatus === 'ABSENT');

  let logOddsDelta = 0;
  if (authenticatedConfirmations.length > 0) logOddsDelta += Math.min(3.5, 2.2 * authenticatedConfirmations.length);
  else if (independentSources.length > 0) logOddsDelta += 0.4; // referencia pública sin autenticación criptográfica
  if (authenticatedContradictions.length > 0) logOddsDelta -= 2.2;

  // Confirmación espectral directa si se aportan bandas de Sentinel-2 claras
  let spectralSupports = null;
  if (spectral && !observability.opticalObscuredByClouds) {
    if ((p.kind === 'inundacion' || p.kind === 'nivel_agua') && spectral.ndwi !== null) {
      spectralSupports = spectral.ndwi > 0.1;
      logOddsDelta += spectralSupports ? 1.5 : -0.6;
    } else if (p.kind === 'fuego' && spectral.dnbr !== null) {
      spectralSupports = spectral.dnbr >= 0.27;
      logOddsDelta += spectralSupports ? 1.8 : -0.5;
    }
  }

  const instrumentVerified = authenticatedConfirmations.length > 0 || spectralSupports === true;
  const confidence = authenticatedContradictions.length > 0
    ? 'CONTRADICTED'
    : instrumentVerified
      ? 'VERIFIED'
      : independentSources.length > 0
        ? 'SUPPORTED'
        : 'UNKNOWN';

  return Object.freeze({
    pillar: 'satellite_and_official',
    nextPasses,
    tleSummary: { total: tleTotalCount, checksumValid: tleChecksumValidCount },
    observability,
    spectral,
    spectralSupports,
    matchedOfficial: matched,
    independentOfficialCount: independentSources.length,
    authenticatedConfirmationsCount: authenticatedConfirmations.length,
    authenticatedContradictionsCount: authenticatedContradictions.length,
    dependentNotes,
    collectionErrors,
    instrumentVerified,
    logOddsDelta: +logOddsDelta.toFixed(3),
    confidence,
    basis: instrumentVerified ? 'OFFICIAL' : 'MODEL',
  });
}

/* ───────────── 5. Pilar 4: Otros ciudadanos (independientes) y cámaras ───────────── */

/**
 * Analiza corroboración de otros ciudadanos y verificaciones con cámara (`hazard-verify.mjs`).
 * Regla anti-duplicación:
 *  - Mismo `pseudonymId` cuenta 1 sola vez.
 *  - Mismo `groupHint` (ej. misma familia o grupo) cuenta como 1 única fuente independiente.
 *  - Dos reportes a < 25 m y < 3 s con misma huella perceptual (Hamming ≤ 6) se marcan dependientes.
 */
export function checkCrowdAndCameras(primaryEnvelope, {
  peerEnvelopes = [],
  passerbyCameraChecks = [], // [{ verifierId, consent:true, roadKind, frames, minScore, minFrames }]
  radiusKm = 2.0,
  windowMin = 90,
  dhashMaxHamming = 6,
} = {}) {
  const p = primaryEnvelope.payload;
  const primaryFamily = CITIZEN_HAZARD_TYPES[p.kind].family;
  const seenKeys = new Set([primaryEnvelope.signature.pseudonymId]);
  const seenGroups = new Set(p.groupHint ? [p.groupHint] : []);
  const seenDhashes = new Set(p.media.map((m) => m.perceptualHashHex).filter(Boolean));

  const independentPeers = [];
  const excludedPeers = [];

  for (const peer of peerEnvelopes) {
    if (!peer?.payload || !peer?.signature) continue;
    if (peer.reportId === primaryEnvelope.reportId) continue;
    if (CITIZEN_HAZARD_TYPES[peer.payload.kind]?.family !== primaryFamily) continue;
    const dKm = haversineKm(p.location, peer.payload.location);
    const dtMin = Math.abs(peer.payload.capturedAtMs - p.capturedAtMs) / 60_000;
    if (dKm > radiusKm || dtMin > windowMin) continue;

    const pid = peer.signature.pseudonymId;
    if (seenKeys.has(pid)) {
      excludedPeers.push({ reportId: peer.reportId, reason: 'SAME_PSEUDONYM' });
      continue;
    }
    if (peer.payload.groupHint && seenGroups.has(peer.payload.groupHint)) {
      excludedPeers.push({ reportId: peer.reportId, reason: 'SAME_GROUP_HINT' });
      continue;
    }
    // Detección de ráfaga colocalizada simultánea (< 15 m y < 2 s) sin grupo declarado: posible grupo o Sybil
    const distM = dKm * 1000;
    const dtS = Math.abs(peer.payload.capturedAtMs - p.capturedAtMs) / 1000;
    if (distM < 15 && dtS < 2) {
      excludedPeers.push({ reportId: peer.reportId, reason: 'COLOCATED_BURST_DEPENDENT' });
      continue;
    }
    // Imagen perceptual compartida entre dos ciudadanos → misma foto reenviada, no cuenta doble
    const peerDhashes = peer.payload.media.map((m) => m.perceptualHashHex).filter(Boolean);
    const sharedPhoto = peerDhashes.some((h1) =>
      [...seenDhashes].some((h0) => /^[a-f0-9]{16}$/i.test(h0) && /^[a-f0-9]{16}$/i.test(h1) && hammingDistanceHex64(h0, h1) <= dhashMaxHamming)
    );
    if (sharedPhoto) {
      excludedPeers.push({ reportId: peer.reportId, reason: 'SHARED_PERCEPTUAL_MEDIA' });
      continue;
    }

    seenKeys.add(pid);
    if (peer.payload.groupHint) seenGroups.add(peer.payload.groupHint);
    for (const h of peerDhashes) seenDhashes.add(h);
    independentPeers.push({
      reportId: peer.reportId,
      pseudonymId: pid,
      dKm: +dKm.toFixed(3),
      dtMin: +dtMin.toFixed(1),
      kind: peer.payload.kind,
    });
  }

  // Verificación con cámara de quien pasa (`hazard-verify.mjs`) exigiendo permiso explícito
  const cameraResults = [];
  let cameraCompatibleCount = 0;
  let cameraNotSeenCount = 0;
  for (const chk of passerbyCameraChecks) {
    if (chk.consent !== true) {
      cameraResults.push({ verifierId: chk.verifierId ?? 'anon', skipped: true, reason: 'NO_CONSENT' });
      continue;
    }
    const verdict = verifyReport(chk.roadKind, chk.frames, { minScore: chk.minScore, minFrames: chk.minFrames });
    cameraResults.push({ verifierId: chk.verifierId ?? 'anon', consent: true, ...verdict });
    if (verdict.verdict === 'COMPATIBLE') cameraCompatibleCount++;
    else if (verdict.verdict === 'NO_VISTO') cameraNotSeenCount++;
  }

  // Peso log-odds conservador (sublineal para mitigar ataques Sybil con muchas claves locales)
  const peerDelta = independentPeers.length > 0 ? Math.min(2.4, 1.1 * Math.log2(1 + independentPeers.length)) : 0;
  const camDelta = cameraCompatibleCount * 0.9 - cameraNotSeenCount * 0.6;
  const logOddsDelta = peerDelta + camDelta;

  return Object.freeze({
    pillar: 'crowd_and_cameras',
    independentCitizens: 1 + independentPeers.length,
    independentPeers,
    excludedPeers,
    cameraResults,
    cameraCompatibleCount,
    cameraNotSeenCount,
    logOddsDelta: +logOddsDelta.toFixed(3),
    confidence: cameraNotSeenCount > cameraCompatibleCount && independentPeers.length === 0
      ? 'CONTRADICTED'
      : independentPeers.length >= 1 || cameraCompatibleCount >= 1
        ? 'SUPPORTED'
        : 'INFERRED',
    basis: 'CITIZEN',
  });
}

/* ───────────── 6. Pilar 5: Fiabilidad del informante — Dawid y Skene (1979) ───────────── */

/**
 * Estimador EM de Dawid & Skene (1979) para fiabilidad binaria de informantes seudónimos.
 * Aprende sensibilidad α_k = P(dice 1 | real 1) y especificidad β_k = P(dice 0 | real 0)
 * a partir de episodios pasados (con o sin verdad terreno observada), sin almacenar PII.
 *
 * Referencia: Dawid, A. P. & Skene, A. M. (1979). «Maximum Likelihood Estimation of Observer
 * Error-Rates Using the EM Algorithm». Journal of the Royal Statistical Society: Series C
 * (Applied Statistics) 28(1): 20–28. DOI: 10.2307/2346806.
 *
 * @param {Array<{eventId:string, truth?:0|1|null, reports:Record<string,0|1>}>} history
 * @param {{maxIter?:number, tol?:number, priorAlpha?:number, priorBeta?:number, priorPrevalence?:number}} opts
 */
export function fitDawidSkene(history, {
  maxIter = 80,
  tol = 1e-6,
  priorAlpha = 2,
  priorBeta = 1,
  priorPrevalence = 0.5,
} = {}) {
  if (!Array.isArray(history)) throw new TypeError('fitDawidSkene: history debe ser un array');
  const workers = new Set();
  for (const item of history) {
    for (const k of Object.keys(item.reports ?? {})) workers.add(k);
  }
  const workerList = [...workers].sort();
  if (!history.length || !workerList.length) {
    return Object.freeze({
      prevalence: priorPrevalence,
      iterations: 0,
      converged: true,
      reporters: {},
      basis: 'ESTIMATED',
      ref: FORENSIC_SIGNALS_META.dawid_skene_1979.method,
    });
  }

  // Inicialización: si hay truth conocido se usa, si no voto mayoritario suave
  let q = history.map((item) => {
    if (item.truth === 1) return 1;
    if (item.truth === 0) return 0;
    const vals = Object.values(item.reports ?? {});
    if (!vals.length) return priorPrevalence;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  let pi = priorPrevalence;
  const sens = Object.fromEntries(workerList.map((w) => [w, priorAlpha / (priorAlpha + priorBeta)]));
  const spec = Object.fromEntries(workerList.map((w) => [w, priorAlpha / (priorAlpha + priorBeta)]));
  const counts = Object.fromEntries(workerList.map((w) => [w, 0]));
  for (const item of history) {
    for (const w of Object.keys(item.reports ?? {})) counts[w]++;
  }

  let iter = 0;
  let converged = false;
  for (iter = 1; iter <= maxIter; iter++) {
    // M-step (suavizado Beta(priorAlpha, priorBeta) para evitar colapso a 0/1)
    pi = (q.reduce((a, b) => a + b, 0) + 1) / (history.length + 2);
    for (const w of workerList) {
      let tp = 0, pos = 0, tn = 0, neg = 0;
      for (let j = 0; j < history.length; j++) {
        const y = history[j].reports?.[w];
        if (y !== 0 && y !== 1) continue;
        const pj = q[j];
        pos += pj;
        neg += 1 - pj;
        if (y === 1) tp += pj;
        else tn += 1 - pj;
      }
      sens[w] = (tp + priorAlpha) / (pos + priorAlpha + priorBeta);
      spec[w] = (tn + priorAlpha) / (neg + priorAlpha + priorBeta);
    }

    // E-step (mantiene fijados los episodios con verdad terreno comprobada)
    let maxDelta = 0;
    const nextQ = new Array(history.length);
    for (let j = 0; j < history.length; j++) {
      if (history[j].truth === 1 || history[j].truth === 0) {
        nextQ[j] = history[j].truth;
        continue;
      }
      let logL1 = Math.log(Math.max(1e-12, pi));
      let logL0 = Math.log(Math.max(1e-12, 1 - pi));
      for (const [w, y] of Object.entries(history[j].reports ?? {})) {
        if (y !== 0 && y !== 1) continue;
        const a = Math.min(1 - 1e-9, Math.max(1e-9, sens[w]));
        const b = Math.min(1 - 1e-9, Math.max(1e-9, spec[w]));
        logL1 += Math.log(y === 1 ? a : 1 - a);
        logL0 += Math.log(y === 1 ? 1 - b : b);
      }
      const m = Math.max(logL1, logL0);
      const p1 = Math.exp(logL1 - m), p0 = Math.exp(logL0 - m);
      nextQ[j] = p1 / (p1 + p0);
      maxDelta = Math.max(maxDelta, Math.abs(nextQ[j] - q[j]));
    }
    q = nextQ;
    if (maxDelta < tol) {
      converged = true;
      break;
    }
  }

  const reporters = {};
  for (const w of workerList) {
    const a = sens[w], b = spec[w];
    const lrPos = a / Math.max(1e-6, 1 - b);
    const lrNeg = (1 - a) / Math.max(1e-6, b);
    reporters[w] = Object.freeze({
      pseudonymId: w,
      sensitivity: +a.toFixed(4),
      specificity: +b.toFixed(4),
      youdenJ: +(a + b - 1).toFixed(4),
      logOddsPos: +Math.log(lrPos).toFixed(4),
      logOddsNeg: +Math.log(lrNeg).toFixed(4),
      observations: counts[w],
      calibrated: counts[w] >= 10,
      basis: counts[w] >= 10 ? 'ESTIMATED' : 'MODEL',
    });
  }

  return Object.freeze({
    prevalence: +pi.toFixed(4),
    iterations: iter,
    converged,
    eventPosteriors: q.map((v) => +v.toFixed(4)),
    reporters: Object.freeze(reporters),
    basis: 'ESTIMATED',
    ref: FORENSIC_SIGNALS_META.dawid_skene_1979.method,
  });
}

/* ───────────── 7. Puerta de fundamentación (Civil Sentry endurecida) y expediente completo ───────────── */

/**
 * Puerta epistémica (adaptada y endurecida de `civil-sentry/packages/core/src/ai-adapter.ts`):
 * impide que cualquier motor, regla o adaptador de IA emita un hallazgo `VERIFIED`, `SUPPORTED`
 * o `CONTRADICTED` sin citar `evidenceIds` reales presentes en la cadena del mismo expediente.
 */
export async function acceptGroundedFinding(proposal, { runId, evidenceEntries }) {
  if (!proposal || typeof proposal !== 'object') throw new TypeError('proposal obligatorio');
  if (!CONFIDENCE_STATES.includes(proposal.confidence)) {
    throw new RangeError(`confidence no válido: ${proposal.confidence}`);
  }
  const allowedSources = ['DETERMINISTIC_RULE', 'FORENSIC_ENGINE', 'PHYSICS_SIMULATION', 'AI_ANALYST_ADAPTER', 'HUMAN_COMMITTEE'];
  if (!allowedSources.includes(proposal.source)) {
    throw new RangeError(`source debe ser uno de: ${allowedSources.join(', ')}`);
  }
  const ids = Array.isArray(proposal.evidenceIds) ? [...new Set(proposal.evidenceIds)] : [];
  const byId = new Map((evidenceEntries ?? []).map((e) => [e.id, e]));

  for (const id of ids) {
    const ev = byId.get(id);
    if (!ev) throw new Error(`UNGROUNDED_FINDING: evidenceId "${id}" no existe en este expediente`);
    if (runId && ev.runId !== runId) throw new Error(`UNGROUNDED_FINDING: evidenceId "${id}" pertenece a otro runId`);
  }
  if (['VERIFIED', 'SUPPORTED', 'CONTRADICTED'].includes(proposal.confidence) && ids.length === 0) {
    throw new Error(`UNGROUNDED_FINDING: el estado ${proposal.confidence} exige al menos un evidenceId verificable`);
  }
  if (proposal.confidence === 'VERIFIED') {
    const hasVerifiedEvidence = ids.some((id) => byId.get(id)?.confidence === 'VERIFIED');
    if (!hasVerifiedEvidence) {
      throw new Error('UNGROUNDED_FINDING: un hallazgo VERIFIED requiere al menos una evidencia con confidence=VERIFIED');
    }
  }

  const findingId = `fnd_${(await sha256HexCanonical([runId ?? '', proposal.source, proposal.title, ids])).slice(0, 20)}`;
  return Object.freeze({
    id: findingId,
    runId: runId ?? null,
    title: String(proposal.title ?? ''),
    summary: String(proposal.summary ?? ''),
    source: proposal.source,
    confidence: proposal.confidence,
    evidenceIds: Object.freeze(ids),
    canPublicWarn: false,
  });
}

/**
 * Ejecuta el peritaje multimodal completo sobre un sobre ciudadano firmado y devuelve un expediente
 * auditable con probabilidad bayesiana, horquilla (IC 95 %), pruebas a favor/en contra y cadena de evidencia.
 */
export async function runForensicAssessment(envelope, {
  receivedAtMs,
  priorProbability,
  deviceContext = {},
  physicalContext = {},
  satelliteContext = {},
  crowdContext = {},
  reliabilityModel = null,
} = {}) {
  if (!Number.isFinite(receivedAtMs)) throw new TypeError('runForensicAssessment: receivedAtMs obligatorio');
  if (!Number.isFinite(priorProbability) || priorProbability <= 0 || priorProbability >= 1) {
    throw new RangeError('runForensicAssessment: priorProbability obligatorio en (0, 1) (sin valor por defecto oculto)');
  }

  const runId = `for_${envelope?.reportId ?? 'invalid'}_${Math.round(receivedAtMs)}`;
  const chain = createEvidenceChain();
  const receivedIso = new Date(receivedAtMs).toISOString();

  const device = await checkDeviceCoherence(envelope, { ...deviceContext, receivedAtMs });
  const evDevice = await chain.append({
    runId,
    source: 'FORENSICS_DEVICE',
    sourceType: 'DEVICE_COHERENCE',
    basis: device.basis,
    observationStatus: 'OBSERVED',
    confidence: device.confidence,
    observedAtIso: receivedIso,
    rawValue: { reportId: envelope?.reportId ?? null, findings: device.findings },
    normalizedValue: { passed: device.passed, disqualified: device.disqualified, logOddsDelta: device.logOddsDelta },
    metadata: { redacted: true },
  });

  if (device.disqualified && !envelope?.payload) {
    return Object.freeze({
      runId,
      reportId: null,
      basis: 'MODEL',
      validEnvelope: false,
      pillars: { device },
      posterior: { p: 0.01, ci95: [0, 0.05] },
      pros: [],
      cons: device.findings.map((f) => f.detail),
      evidenceChain: chain.entries(),
      canPublicWarn: false,
    });
  }

  const physical = checkPhysicalContext(envelope, physicalContext);
  const evPhys = await chain.append({
    runId,
    source: 'FORENSICS_PHYSICS',
    sourceType: 'PHYSICAL_CONTEXT',
    basis: physical.basis,
    observationStatus: physical.observationStatus,
    confidence: physical.confidence,
    observedAtIso: receivedIso,
    rawValue: { kind: envelope.payload.kind, findings: physical.findings },
    normalizedValue: { plausible: physical.plausible, logOddsDelta: physical.logOddsDelta },
    metadata: { redacted: true },
  });

  const satellite = checkSatelliteAndOfficial(envelope, satelliteContext);
  const evSat = await chain.append({
    runId,
    source: 'FORENSICS_SATELLITE_OFFICIAL',
    sourceType: 'SATELLITE_OFFICIAL',
    basis: satellite.basis,
    observationStatus: satellite.collectionErrors.length && !satellite.matchedOfficial.length ? 'COLLECTION_ERROR' : satellite.authenticatedContradictionsCount > 0 ? 'ABSENT' : 'OBSERVED',
    confidence: satellite.confidence,
    observedAtIso: receivedIso,
    rawValue: { matchedOfficial: satellite.matchedOfficial, nextPasses: satellite.nextPasses.length, spectral: satellite.spectral },
    normalizedValue: { instrumentVerified: satellite.instrumentVerified, logOddsDelta: satellite.logOddsDelta },
    metadata: { redacted: true },
  });

  const crowd = checkCrowdAndCameras(envelope, crowdContext);
  const evCrowd = await chain.append({
    runId,
    source: 'FORENSICS_CROWD_CAMERA',
    sourceType: 'CROWD_CAMERA',
    basis: crowd.basis,
    observationStatus: 'OBSERVED',
    confidence: crowd.confidence,
    observedAtIso: receivedIso,
    rawValue: { independentCitizens: crowd.independentCitizens, excludedPeers: crowd.excludedPeers, cameraResults: crowd.cameraResults },
    normalizedValue: { independentCitizens: crowd.independentCitizens, logOddsDelta: crowd.logOddsDelta },
    metadata: { redacted: true },
  });

  // Fiabilidad del informante (Dawid & Skene 1979)
  const pid = envelope.signature.pseudonymId;
  const repStats = reliabilityModel?.reporters?.[pid] ?? {
    pseudonymId: pid,
    sensitivity: 0.6667,
    specificity: 0.6667,
    youdenJ: 0.3333,
    logOddsPos: 0,
    logOddsNeg: 0,
    observations: 0,
    calibrated: false,
    basis: 'MODEL',
  };
  const reporterLogOdds = repStats.calibrated ? Math.max(-2.5, Math.min(2.5, repStats.logOddsPos)) : 0;
  const evRel = await chain.append({
    runId,
    source: 'FORENSICS_DAWID_SKENE',
    sourceType: 'REPORTER_RELIABILITY',
    basis: repStats.basis,
    observationStatus: 'OBSERVED',
    confidence: repStats.calibrated ? (repStats.youdenJ > 0.3 ? 'SUPPORTED' : 'INFERRED') : 'UNKNOWN',
    observedAtIso: receivedIso,
    rawValue: repStats,
    normalizedValue: { reporterLogOdds, calibrated: repStats.calibrated },
    metadata: { redacted: true },
  });

  // Fusión bayesiana en log-odds + incertidumbre (varianza por pilar no calibrado → IC 95 %)
  const priorLogOdds = Math.log(priorProbability / (1 - priorProbability));
  const totalLogOdds = priorLogOdds + device.logOddsDelta + physical.logOddsDelta + satellite.logOddsDelta + crowd.logOddsDelta + reporterLogOdds;
  // Varianza epistémica del log-odds: menor cuando hay verificación instrumental o historial calibrado
  const varLogOdds =
    0.85 +
    (satellite.instrumentVerified ? 0.15 : 0.65) +
    (repStats.calibrated ? 0.1 : 0.4) +
    (crowd.independentCitizens >= 3 ? 0.15 : 0.45);
  const sdLogOdds = Math.sqrt(varLogOdds);
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const pMean = sigmoid(totalLogOdds);
  const pLo = sigmoid(totalLogOdds - 1.96 * sdLogOdds);
  const pHi = sigmoid(totalLogOdds + 1.96 * sdLogOdds);

  const pros = [];
  const cons = [];
  const contradictions = [];
  for (const f of device.findings) {
    if (f.severity === 'OK') pros.push(`[Dispositivo] ${f.detail}`);
    else if (f.severity !== 'INFO') cons.push(`[Dispositivo] ${f.detail}`);
  }
  for (const f of physical.findings) {
    if (physical.logOddsDelta >= 0 && !f.code.includes('LOW') && !f.code.includes('FLAT') && !f.code.includes('CONTRADICT') && !f.code.includes('ANOMALY') && !f.code.includes('UNFAVORABLE') && !f.code.includes('WATER') && !f.code.includes('FAR')) {
      pros.push(`[Física] ${f.detail}`);
    } else if (f.code.includes('CONTRADICT') || f.code.includes('FLAT') || f.code.includes('UNFAVORABLE') || f.code.includes('WATER') || f.code.includes('ANOMALY') || f.code.includes('FAR')) {
      cons.push(`[Física] ${f.detail}`);
      if (f.code.includes('CONTRADICT')) contradictions.push(f.detail);
    }
  }
  if (satellite.instrumentVerified) pros.push(`[Instrumento/Satélite] Confirmado por fuente autenticada o índice espectral`);
  if (satellite.authenticatedContradictionsCount > 0) {
    const msg = 'Fuente oficial autenticada registra ausencia de anomalía en la zona';
    cons.push(`[Instrumento/Satélite] ${msg}`);
    contradictions.push(msg);
  }
  if (satellite.dependentNotes.length) cons.push(...satellite.dependentNotes.map((n) => `[Independencia] ${n}`));
  if (crowd.independentCitizens > 1) pros.push(`[Ciudadanía] ${crowd.independentCitizens} informantes independientes concordantes`);
  if (crowd.excludedPeers.length) cons.push(`[Anti-duplicación] ${crowd.excludedPeers.length} reporte(s) excluidos por mismo grupo, seudónimo o foto repetida`);
  if (crowd.cameraCompatibleCount > 0) pros.push(`[Cámara de paso] ${crowd.cameraCompatibleCount} verificación(es) compatibles (sin enviar imagen)`);
  if (crowd.cameraNotSeenCount > 0) cons.push(`[Cámara de paso] ${crowd.cameraNotSeenCount} verificación(es) «no visto»`);
  if (repStats.calibrated) {
    const msg = `Fiabilidad Dawid-Skene (${repStats.observations} casos): sens=${repStats.sensitivity}, esp=${repStats.specificity}`;
    if (repStats.youdenJ >= 0.3) pros.push(`[Informante] ${msg}`);
    else cons.push(`[Informante] ${msg}`);
  }

  const evidenceEntries = chain.entries();
  const overallConfidence = contradictions.length > 0 || device.disqualified
    ? 'CONTRADICTED'
    : satellite.instrumentVerified
      ? 'VERIFIED'
      : pMean >= 0.7 && !device.disqualified
        ? 'SUPPORTED'
        : 'INFERRED';

  const citedIds = [evDevice.id, evPhys.id, evSat.id, evCrowd.id, evRel.id];
  const groundedSummary = await acceptGroundedFinding(
    {
      title: `Expediente pericial ${envelope.reportId}`,
      summary: `P=${(pMean * 100).toFixed(1)}% [IC95: ${(pLo * 100).toFixed(1)}%–${(pHi * 100).toFixed(1)}%] · ${pros.length} a favor, ${cons.length} en contra`,
      source: 'FORENSIC_ENGINE',
      confidence: overallConfidence,
      evidenceIds: citedIds,
    },
    { runId, evidenceEntries }
  );

  return Object.freeze({
    runId,
    reportId: envelope.reportId,
    operationalStatus: envelope.operationalStatus,
    kind: envelope.payload.kind,
    basis: satellite.instrumentVerified ? 'OFFICIAL' : 'MODEL',
    validEnvelope: true,
    pillars: Object.freeze({
      device,
      physical,
      satellite,
      crowd,
      reliability: repStats,
    }),
    posterior: Object.freeze({
      priorProbability,
      logOdds: +totalLogOdds.toFixed(4),
      sdLogOdds: +sdLogOdds.toFixed(4),
      p: +pMean.toFixed(4),
      ci95: Object.freeze([+pLo.toFixed(4), +pHi.toFixed(4)]),
      basis: 'MODEL',
    }),
    overallConfidence,
    pros: Object.freeze(pros),
    cons: Object.freeze(cons),
    contradictions: Object.freeze(contradictions),
    groundedFinding: groundedSummary,
    evidenceChain: evidenceEntries,
    canPublicWarn: false,
  });
}
