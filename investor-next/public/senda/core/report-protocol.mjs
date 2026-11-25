/**
 * SENDA · Protocolo de niveles N0–N5, transiciones auditables y puerta criptográfica de autoridad (`report-protocol.mjs`).
 *
 * Máquina de estados formal para el peritaje ciudadano multimodal:
 *   N0 · Recibido                  (sobre Ed25519 válido y consentimiento)                → automático
 *   N1 · Coherente                 (coherencia del dispositivo y física básica)           → automático
 *   N2 · Corroborado               (fuentes independientes o fiabilidad Dawid-Skene alta) → automático
 *   N3 · Verificado por instrumento(satélite, aforo, estación o cámara autenticada)       → automático
 *   N4 · Pre-alerta al comité      (N2 o N3 + riesgo > umbral CON FUENTE citada)          → automático (CAP borrador, canPublicWarn=false)
 *   N5 · Aviso a la población      (decisión humana firmada + AuthorityGrant vigente)     → SOLO HUMANO (canPublicWarn=true)
 *
 * Garantías innegociables:
 *  - Un expediente puede SUBIR y BAJAR de nivel (por contradicción de aforo/cámara o decaimiento bayesiano).
 *  - Ningún motor automático puede activar `canPublicWarn: true` ni emitir CAP `Actual`/`Public`.
 *  - Un umbral sin fuente citada falla de forma cerrada (sin valores por defecto inventados).
 *  - La puerta N5 endurece `AuthorizationGrant` (de Civil Sentry) con firma Ed25519 del ancla institucional,
 *    validación estricta de ventana temporal (`grantedAt <= now <= expiresAt`, fail-closed ante NaN),
 *    geocerca geográfica, alcance de peligro, bloqueo de simulaciones (`operationalStatus === 'ACTUAL'`)
 *    y registro en cadena de auditoría SHA-256 (`interop.mjs` `createAuditLog`).
 *
 * Referencias:
 *  - OASIS Common Alerting Protocol (CAP) Version 1.2 (01 July 2010).
 *  - Directriz Básica de Planificación de Protección Civil (RD 407/1992 y RD 893/2013, España).
 *  - RFC 8032 (Ed25519).
 */

import { b64, unb64 } from './b64.mjs';
import {
  CITIZEN_HAZARD_TYPES,
  canonicalJson,
  sha256HexCanonical,
  verifyCitizenReport,
} from './citizen-report.mjs';
import { runForensicAssessment } from './report-forensics.mjs';
import { clusterReports, assessIncident, incidentToCap } from './hazard-reports.mjs';
import { toCap, createAuditLog } from './interop.mjs';
import { haversineKm } from './zones.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

export const PROTOCOL_LEVELS = Object.freeze({
  N0: Object.freeze({ code: 'N0', rank: 0, name: 'Recibido', actor: 'AUTOMATICO', canPublicWarn: false }),
  N1: Object.freeze({ code: 'N1', rank: 1, name: 'Coherente', actor: 'AUTOMATICO', canPublicWarn: false }),
  N2: Object.freeze({ code: 'N2', rank: 2, name: 'Corroborado', actor: 'AUTOMATICO', canPublicWarn: false }),
  N3: Object.freeze({ code: 'N3', rank: 3, name: 'Verificado por instrumento', actor: 'AUTOMATICO', canPublicWarn: false }),
  N4: Object.freeze({ code: 'N4', rank: 4, name: 'Pre-alerta al comité', actor: 'AUTOMATICO', canPublicWarn: false }),
  N5: Object.freeze({ code: 'N5', rank: 5, name: 'Aviso a la población', actor: 'HUMANO_AUTORIDAD', canPublicWarn: true }),
});

/**
 * Umbrales publicados de referencia (NO se aplican automáticamente por defecto: quien llama
 * debe seleccionar y declarar explícitamente el umbral pertinente a su demarcación y escenario).
 */
export const PUBLISHED_RISK_THRESHOLDS = Object.freeze({
  CHJ_POYO_WARNING_FLOW: Object.freeze({
    id: 'chj-poyo-150',
    metric: 'flowM3s',
    thresholdValue: 150,
    unit: 'm³/s',
    source: 'Confederación Hidrográfica del Júcar (umbral máximo de aviso en rambla del Poyo, citado en Maldita.es 07-11-2024 y data/dana2024/telemetria.json)',
    basis: 'OFFICIAL',
  }),
  POYO_URBAN_CAPACITY: Object.freeze({
    id: 'poyo-urbano-800',
    metric: 'flowM3s',
    thresholdValue: 800,
    unit: 'm³/s',
    source: 'Roldán Cañas, J. (2025). Boletín de la Real Academia de Córdoba, 174:775-795 (capacidad de encauzamientos urbanos del Poyo)',
    basis: 'OFFICIAL',
  }),
  CAINE_1980_LANDSLIDE_1H: Object.freeze({
    id: 'caine-1980-1h',
    metric: 'rainIntensityMmH',
    thresholdValue: 14.82,
    unit: 'mm/h',
    source: 'Caine, N. (1980). Geografiska Annaler 62A:23-27, DOI 10.1080/04353676.1980.11879996',
    basis: 'MODEL',
  }),
  ANDREWS_ROTHERMEL_FLAME_DIRECT_LIMIT: Object.freeze({
    id: 'andrews-rothermel-2.4m',
    metric: 'flameLengthM',
    thresholdValue: 2.4,
    unit: 'm',
    source: 'Andrews, P. L. & Rothermel, R. C. (1982). USDA Forest Service Gen. Tech. Rep. INT-131 (límite de ataque directo con maquinaria)',
    basis: 'MODEL',
  }),
  COX_2010_ADULT_FLOOD_INSTABILITY: Object.freeze({
    id: 'cox-2010-adult-dv',
    metric: 'depthVelocityM2s',
    thresholdValue: 0.6,
    unit: 'm²/s',
    source: 'Cox, R. J., Shand, T. D. & Blacka, M. J. (2010). Australian Rainfall and Runoff Project 10, WRL TR 2010/06',
    basis: 'MODEL',
  }),
});

/** Valida un umbral de riesgo con fuente obligatoria (CLAUDE.md §1: ningún umbral sin fuente). */
export function createRiskThreshold({ id, metric, thresholdValue, unit, source, basis = 'OFFICIAL' } = {}) {
  if (typeof metric !== 'string' || !metric.trim()) throw new TypeError('riskThreshold: falta metric');
  if (!Number.isFinite(thresholdValue)) throw new RangeError('riskThreshold: thresholdValue finito obligatorio');
  if (typeof unit !== 'string' || !unit.trim()) throw new TypeError('riskThreshold: falta unit');
  if (typeof source !== 'string' || source.trim().length < 5) {
    throw new TypeError('riskThreshold: falta source (fuente citada obligatoria; sin valores por defecto inventados)');
  }
  return Object.freeze({
    id: id ? String(id) : `${metric}-${thresholdValue}`,
    metric: metric.trim(),
    thresholdValue,
    unit: unit.trim(),
    source: source.trim(),
    basis,
  });
}

/* ───────────── 1. Credenciales criptográficas de autoridad (Ed25519) para puerta N5 ───────────── */

/** Genera un par de claves Ed25519 para un ancla institucional o una autoridad humana identificada. */
export async function createAuthorityKeyPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { privateKey: kp.privateKey, publicKey: kp.publicKey, publicRaw, publicKeyB64u: b64(publicRaw) };
}

/**
 * Emite una habilitación firmada (`AuthorityGrant`) por el ancla institucional para una autoridad humana
 * con ámbito geográfico, tipos de peligro autorizados y ventana de vigencia estricta.
 */
export async function issueAuthorityGrant(
  {
    grantId,
    authorityId,
    authorityName,
    role,
    organization,
    authorityPublicKeyB64u,
    allowedHazardKinds,
    scopeCircle, // { lat, lon, radiusKm }
    grantedAtIso,
    expiresAtIso,
    documentHash,
  },
  trustAnchorKeyPair
) {
  if (!trustAnchorKeyPair?.privateKey || !(trustAnchorKeyPair?.publicRaw instanceof Uint8Array)) {
    throw new TypeError('issueAuthorityGrant: falta trustAnchorKeyPair Ed25519');
  }
  if (!grantId || !authorityId || !authorityName || !role || !organization) {
    throw new TypeError('issueAuthorityGrant: faltan campos de identificación de la autoridad');
  }
  if (typeof authorityPublicKeyB64u !== 'string' || unb64(authorityPublicKeyB64u).length !== 32) {
    throw new RangeError('issueAuthorityGrant: authorityPublicKeyB64u Ed25519 inválida');
  }
  if (!Array.isArray(allowedHazardKinds) || !allowedHazardKinds.length || !allowedHazardKinds.every((k) => k in CITIZEN_HAZARD_TYPES)) {
    throw new RangeError('issueAuthorityGrant: allowedHazardKinds debe listar tipos de peligro válidos');
  }
  if (
    !scopeCircle ||
    !Number.isFinite(scopeCircle.lat) ||
    !Number.isFinite(scopeCircle.lon) ||
    !Number.isFinite(scopeCircle.radiusKm) ||
    scopeCircle.radiusKm <= 0
  ) {
    throw new RangeError('issueAuthorityGrant: scopeCircle { lat, lon, radiusKm > 0 } obligatorio');
  }
  if (!ISO_WITH_TZ.test(String(grantedAtIso)) || !ISO_WITH_TZ.test(String(expiresAtIso))) {
    throw new RangeError('issueAuthorityGrant: grantedAtIso y expiresAtIso deben llevar zona horaria ISO-8601');
  }
  const grantedAtMs = Date.parse(grantedAtIso), expiresAtMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(grantedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= grantedAtMs) {
    throw new RangeError('issueAuthorityGrant: ventana de vigencia inválida (expiresAt debe ser posterior a grantedAt)');
  }
  if (typeof documentHash !== 'string' || !/^[a-f0-9]{64}$/i.test(documentHash)) {
    throw new RangeError('issueAuthorityGrant: documentHash SHA-256 (64 hex) obligatorio');
  }

  const body = Object.freeze({
    schema: 'senda.authority-grant/v1',
    grantId: String(grantId),
    authorityId: String(authorityId),
    authorityName: String(authorityName),
    role: String(role),
    organization: String(organization),
    authorityPublicKeyB64u,
    allowedHazardKinds: Object.freeze([...allowedHazardKinds]),
    scopeCircle: Object.freeze({ lat: scopeCircle.lat, lon: scopeCircle.lon, radiusKm: scopeCircle.radiusKm }),
    grantedAtIso,
    expiresAtIso,
    documentHash: documentHash.toLowerCase(),
  });
  const bytes = enc.encode(canonicalJson(body));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, trustAnchorKeyPair.privateKey, bytes));
  return Object.freeze({
    ...body,
    trustAnchorPublicKeyB64u: b64(trustAnchorKeyPair.publicRaw),
    grantSigB64u: b64(sig),
  });
}

/**
 * Verifica criptográficamente y por ámbito una `AuthorityGrant` frente a un ancla configurada.
 * Falla de forma cerrada ante fechas NaN, caducidad, fecha futura, firma falsa o fuera de geocerca.
 */
export async function verifyAuthorityGrant(grant, { trustAnchorPublicRaw, nowMs, hazardKind, location }) {
  const fail = (reason) => Object.freeze({ ok: false, reason });
  if (!grant || typeof grant !== 'object' || grant.schema !== 'senda.authority-grant/v1') {
    return fail('INVALID_GRANT_SCHEMA');
  }
  if (!(trustAnchorPublicRaw instanceof Uint8Array) || trustAnchorPublicRaw.length !== 32) {
    return fail('MISSING_TRUST_ANCHOR');
  }
  if (!Number.isFinite(nowMs)) return fail('INVALID_NOW_CLOCK');
  if (!ISO_WITH_TZ.test(String(grant.grantedAtIso)) || !ISO_WITH_TZ.test(String(grant.expiresAtIso))) {
    return fail('INVALID_GRANT_TIMESTAMPS');
  }
  const grantedAtMs = Date.parse(grant.grantedAtIso);
  const expiresAtMs = Date.parse(grant.expiresAtIso);
  if (!Number.isFinite(grantedAtMs) || !Number.isFinite(expiresAtMs)) return fail('NAN_GRANT_TIMESTAMPS');
  if (nowMs < grantedAtMs) return fail('GRANT_NOT_YET_VALID');
  if (nowMs > expiresAtMs) return fail('GRANT_EXPIRED');

  if (b64(trustAnchorPublicRaw) !== grant.trustAnchorPublicKeyB64u) return fail('TRUST_ANCHOR_MISMATCH');

  const { trustAnchorPublicKeyB64u: _a, grantSigB64u, ...body } = grant;
  let sigBytes;
  try {
    sigBytes = unb64(grantSigB64u);
  } catch {
    return fail('BAD_GRANT_SIG_ENCODING');
  }
  if (sigBytes.length !== 64) return fail('BAD_GRANT_SIG_LENGTH');
  try {
    const anchorKey = await subtle.importKey('raw', trustAnchorPublicRaw, { name: 'Ed25519' }, false, ['verify']);
    const valid = await subtle.verify({ name: 'Ed25519' }, anchorKey, sigBytes, enc.encode(canonicalJson(body)));
    if (!valid) return fail('BAD_GRANT_SIGNATURE');
  } catch {
    return fail('GRANT_VERIFY_ERROR');
  }

  if (hazardKind && !grant.allowedHazardKinds.includes(hazardKind)) {
    return fail('HAZARD_OUT_OF_GRANT_SCOPE');
  }
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    const dKm = haversineKm(location, grant.scopeCircle);
    if (dKm > grant.scopeCircle.radiusKm) {
      return fail(`LOCATION_OUT_OF_GRANT_GEOFENCE (${dKm.toFixed(1)} km > ${grant.scopeCircle.radiusKm} km)`);
    }
  }
  return Object.freeze({ ok: true, authorityId: grant.authorityId, organization: grant.organization, role: grant.role });
}

/* ───────────── 2. Evaluación automática N0 → N4 y CAP 1.2 borrador ───────────── */

/**
 * Construye un borrador CAP 1.2 restringido para el comité (reutiliza `incidentToCap` de `hazard-reports.mjs`).
 * Siempre `status: 'Exercise'` y `scope: 'Restricted'` para expedientes automáticos N4.
 */
export function buildCommitteeCapDraft(envelope, dossier, levelCode, { nowMs, sender = 'comite@senda.local' }) {
  if (!Number.isFinite(nowMs)) throw new TypeError('buildCommitteeCapDraft: nowMs obligatorio');
  const meta = CITIZEN_HAZARD_TYPES[envelope.payload.kind];
  const rep = {
    kind: meta.hazardReportKind,
    lat: envelope.payload.location.lat,
    lon: envelope.payload.location.lon,
    at: envelope.payload.capturedAtMs,
    deviceId: envelope.signature.pseudonymId,
    people: envelope.payload.people,
    ...(envelope.payload.measurement?.rise ? { measurement: { rise: envelope.payload.measurement.rise } } : {}),
  };
  const [cluster] = clusterReports([rep]);
  const assessed = assessIncident(cluster);
  const adaptedAssessed = {
    ...assessed,
    id: `${envelope.reportId}-${levelCode}`,
    pReal: dossier.posterior.p,
    reporters: dossier.pillars.crowd.independentCitizens,
    state: levelCode === 'N4' ? 'RECON' : 'CORROBORATED',
    why: [
      `Nivel SENDA ${levelCode} (${PROTOCOL_LEVELS[levelCode].name})`,
      `Probabilidad ${(dossier.posterior.p * 100).toFixed(1)}% [IC95 ${(dossier.posterior.ci95[0] * 100).toFixed(1)}%–${(dossier.posterior.ci95[1] * 100).toFixed(1)}%]`,
      ...dossier.pros.slice(0, 3),
    ],
    basis: dossier.basis,
  };
  return incidentToCap(adaptedAssessed, cluster, { sender, now: nowMs, exercise: true });
}

/**
 * Evalúa un sobre ciudadano y su expediente pericial a través de la máquina de estados N0 → N4.
 * Nunca alcanza N5 de forma automática (`canPublicWarn` siempre `false`).
 *
 * @param {object} envelope  sobre ciudadano multimodal (`createCitizenReport`)
 * @param {object} opts
 *   - `receivedAtMs` (obligatorio)
 *   - `priorProbability` (obligatorio en (0, 1))
 *   - `riskMeasurement` (opcional: `{ metric, value, unit, basis }`)
 *   - `riskThreshold` (obligatorio si se quiere habilitar N4; creado con `createRiskThreshold` o `PUBLISHED_RISK_THRESHOLDS`)
 *   - `minIndependentForN2` (por defecto 2 ciudadanos independientes)
 *   - `halfLifeMin` (opcional: si se aporta y `nowMs > capturedAtMs`, aplica decaimiento exponencial de `hazard-belief.mjs`)
 */
export async function evaluateReportProtocol(envelope, opts = {}) {
  const receivedAtMs = opts.receivedAtMs;
  const nowMs = opts.nowMs ?? receivedAtMs;
  if (!Number.isFinite(receivedAtMs)) throw new TypeError('evaluateReportProtocol: receivedAtMs obligatorio');

  const transitions = [];
  const ver = await verifyCitizenReport(envelope);
  if (!ver.ok) {
    transitions.push({
      from: null,
      to: 'RECHAZADO',
      atMs: receivedAtMs,
      actor: 'AUTOMATICO',
      passed: false,
      proof: `Sobre ciudadano inválido: ${ver.reason}`,
    });
    return Object.freeze({
      reportId: envelope?.reportId ?? null,
      level: 'RECHAZADO',
      levelInfo: { code: 'RECHAZADO', rank: -1, name: 'Rechazado', actor: 'AUTOMATICO', canPublicWarn: false },
      canPublicWarn: false,
      reasonPlain: `El sobre ha sido rechazado antes de entrar en N0 porque no supera la verificación criptográfica o estructural (${ver.reason}).`,
      posterior: { p: 0, ci95: [0, 0] },
      pros: [],
      cons: [ver.reason],
      transitions,
      capDraftXml: null,
      dossier: null,
      basis: 'MODEL',
    });
  }

  // N0: Recibido
  let level = 'N0';
  transitions.push({
    from: null,
    to: 'N0',
    atMs: receivedAtMs,
    actor: 'AUTOMATICO',
    passed: true,
    proof: `Firma Ed25519 válida (seudónimo ${ver.pseudonymId}), SHA-256 ${ver.contentSha256.slice(0, 12)}… y consentimiento explícito registrado.`,
  });

  const dossier = opts.dossier ?? (await runForensicAssessment(envelope, {
    receivedAtMs,
    priorProbability: opts.priorProbability,
    deviceContext: opts.deviceContext,
    physicalContext: opts.physicalContext,
    satelliteContext: opts.satelliteContext,
    crowdContext: opts.crowdContext,
    reliabilityModel: opts.reliabilityModel,
  }));

  // Decaimiento temporal bayesiano opcional (misma ley 2^(-Δt/h) de hazard-belief.mjs)
  let pEff = dossier.posterior.p;
  let ciEff = [...dossier.posterior.ci95];
  let decayed = false;
  if (Number.isFinite(opts.halfLifeMin) && opts.halfLifeMin > 0 && nowMs > envelope.payload.capturedAtMs) {
    const dtMin = (nowMs - envelope.payload.capturedAtMs) / 60_000;
    const factor = 2 ** (-dtMin / opts.halfLifeMin);
    if (factor < 0.999) {
      decayed = true;
      pEff = +(pEff * factor).toFixed(4);
      ciEff = [+(ciEff[0] * factor).toFixed(4), +(ciEff[1] * factor).toFixed(4)];
    }
  }

  const dev = dossier.pillars.device;
  const phys = dossier.pillars.physical;
  const sat = dossier.pillars.satellite;
  const crowd = dossier.pillars.crowd;
  const rel = dossier.pillars.reliability;

  // N0 → N1 (Coherente)
  const n1Ok = dev.passed && !dev.disqualified && phys.plausible && (!decayed || pEff >= 0.2);
  if (n1Ok) {
    transitions.push({
      from: 'N0',
      to: 'N1',
      atMs: nowMs,
      actor: 'AUTOMATICO',
      passed: true,
      proof: 'Supera la coherencia del dispositivo (reloj, cinemática, sin foto reciclada) y no contradice la física básica.',
    });
    level = 'N1';
  } else {
    transitions.push({
      from: 'N0',
      to: 'N1',
      atMs: nowMs,
      actor: 'AUTOMATICO',
      passed: false,
      proof: dev.disqualified
        ? 'Bloqueado en N0 por descalificación técnica del dispositivo o imagen reutilizada.'
        : !phys.plausible
          ? 'Bloqueado en N0 por contradicción física verificada.'
          : 'Decaimiento temporal por debajo del umbral de vigencia (p < 0,20).',
    });
  }

  // N1 → N2 (Corroborado)
  const minIndep = opts.minIndependentForN2 ?? 2;
  const highRelCalibrated = rel.calibrated && rel.youdenJ >= 0.65 && rel.observations >= 10;
  const corroborated =
    level === 'N1' &&
    dossier.contradictions.length === 0 &&
    (crowd.independentCitizens >= minIndep || crowd.cameraCompatibleCount >= 1 || highRelCalibrated);

  if (level === 'N1') {
    if (corroborated) {
      const whyN2 = crowd.independentCitizens >= minIndep
        ? `${crowd.independentCitizens} ciudadanos independientes concordantes (deduplicados por grupo y foto).`
        : crowd.cameraCompatibleCount >= 1
          ? `Verificación compatible con cámara de quien pasa (${crowd.cameraCompatibleCount}).`
          : `Informante con fiabilidad Dawid-Skene calibrada alta (J=${rel.youdenJ}, n=${rel.observations}).`;
      transitions.push({ from: 'N1', to: 'N2', atMs: nowMs, actor: 'AUTOMATICO', passed: true, proof: whyN2 });
      level = 'N2';
    } else {
      transitions.push({
        from: 'N1',
        to: 'N2',
        atMs: nowMs,
        actor: 'AUTOMATICO',
        passed: false,
        proof: dossier.contradictions.length
          ? 'Contradicción activa impide corroboración.'
          : `Aún sin corroboración suficiente (${crowd.independentCitizens}/${minIndep} ciudadanos independientes, ${crowd.cameraCompatibleCount} cámaras, fiabilidad calibrada=${rel.calibrated}).`,
      });
    }
  }

  // N2/N1 → N3 (Verificado por instrumento)
  const gaugeAuthenticatedConfirm = phys.findings.some((f) => f.code === 'GAUGE_CONFIRMS_RISE' && f.detail.includes('autenticado'));
  const instrumentConfirmed =
    (level === 'N1' || level === 'N2') &&
    dossier.contradictions.length === 0 &&
    (sat.instrumentVerified || gaugeAuthenticatedConfirm || crowd.cameraCompatibleCount >= 2);

  if (level === 'N1' || level === 'N2') {
    if (instrumentConfirmed) {
      const whyN3 = sat.instrumentVerified
        ? 'Confirmado por satélite/fuente oficial autenticada o índice espectral Sentinel-2.'
        : gaugeAuthenticatedConfirm
          ? 'Confirmado por lectura de aforo/estación autenticada por encima del umbral.'
          : `Confirmado por ${crowd.cameraCompatibleCount} verificaciones independientes de cámara.`;
      transitions.push({ from: level, to: 'N3', atMs: nowMs, actor: 'AUTOMATICO', passed: true, proof: whyN3 });
      level = 'N3';
    } else {
      transitions.push({
        from: level,
        to: 'N3',
        atMs: nowMs,
        actor: 'AUTOMATICO',
        passed: false,
        proof: 'Sin confirmación instrumental autenticada (satélite, aforo, estación o múltiples cámaras).',
      });
    }
  }

  // N2/N3 → N4 (Pre-alerta al comité: exige umbral CON FUENTE y medición o riesgo vital explícito)
  let capDraftXml = null;
  let thresholdEvaluation = null;
  if (level === 'N2' || level === 'N3') {
    const thr = opts.riskThreshold ? createRiskThreshold(opts.riskThreshold) : null;
    const meas = opts.riskMeasurement ?? null;
    if (thr && meas && meas.metric === thr.metric && Number.isFinite(meas.value)) {
      const exceeded = meas.value >= thr.thresholdValue;
      thresholdEvaluation = Object.freeze({
        exceeded,
        metric: thr.metric,
        measuredValue: meas.value,
        thresholdValue: thr.thresholdValue,
        unit: thr.unit,
        source: thr.source,
      });
      if (exceeded && (!decayed || pEff >= 0.5)) {
        transitions.push({
          from: level,
          to: 'N4',
          atMs: nowMs,
          actor: 'AUTOMATICO',
          passed: true,
          proof: `Riesgo ${meas.value} ${thr.unit} ≥ umbral ${thr.thresholdValue} ${thr.unit} (${thr.source}). Se genera expediente y borrador CAP 1.2 restringido; NO avisa a la población.`,
        });
        level = 'N4';
        capDraftXml = buildCommitteeCapDraft(envelope, dossier, 'N4', { nowMs, sender: opts.committeeSender });
      } else {
        transitions.push({
          from: level,
          to: 'N4',
          atMs: nowMs,
          actor: 'AUTOMATICO',
          passed: false,
          proof: `Valor ${meas.value} ${thr.unit} por debajo del umbral citado (${thr.thresholdValue} ${thr.unit}).`,
        });
      }
    } else {
      transitions.push({
        from: level,
        to: 'N4',
        atMs: nowMs,
        actor: 'AUTOMATICO',
        passed: false,
        proof: 'Sin umbral de riesgo con fuente citada y lectura comparable para activar N4 (regla de veracidad: no se inventan umbrales).',
      });
    }
  }

  // Registro de degradación si se pasa estado previo de nivel superior
  if (opts.previousLevel && PROTOCOL_LEVELS[opts.previousLevel] && PROTOCOL_LEVELS[level].rank < PROTOCOL_LEVELS[opts.previousLevel].rank) {
    transitions.push({
      from: opts.previousLevel,
      to: level,
      atMs: nowMs,
      actor: 'AUTOMATICO',
      passed: true,
      downgrade: true,
      proof: dossier.contradictions.length
        ? `Descenso automático de ${opts.previousLevel} a ${level} por contradicción verificada: ${dossier.contradictions[0]}`
        : decayed
          ? `Descenso automático de ${opts.previousLevel} a ${level} por decaimiento temporal bayesiano (p=${pEff}).`
          : `Descenso automático de ${opts.previousLevel} a ${level} al reevaluar evidencias.`,
    });
  }

  const levelInfo = PROTOCOL_LEVELS[level];
  const reasonPlain = buildPlainReason(level, envelope, { pEff, ciEff, dossier, thresholdEvaluation, decayed });

  return Object.freeze({
    reportId: envelope.reportId,
    operationalStatus: envelope.operationalStatus,
    kind: envelope.payload.kind,
    level,
    levelInfo,
    // Invariante: evaluación automática SIEMPRE false
    canPublicWarn: false,
    reasonPlain,
    posterior: Object.freeze({ p: pEff, ci95: Object.freeze(ciEff), decayed }),
    thresholdEvaluation,
    pros: dossier.pros,
    cons: dossier.cons,
    contradictions: dossier.contradictions,
    transitions: Object.freeze(transitions),
    capDraftXml,
    dossier,
    basis: dossier.basis,
  });
}

function buildPlainReason(level, envelope, { pEff, ciEff, dossier, thresholdEvaluation, decayed }) {
  const pct = (pEff * 100).toFixed(0);
  const lo = (ciEff[0] * 100).toFixed(0);
  const hi = (ciEff[1] * 100).toFixed(0);
  const kindLabel = CITIZEN_HAZARD_TYPES[envelope.payload.kind].label;
  const base = `${kindLabel}: nivel ${level} (${PROTOCOL_LEVELS[level].name}). Probabilidad estimada ${pct} % (horquilla ${lo}–${hi} %${decayed ? ', tras decaimiento temporal' : ''}).`;
  if (level === 'N4' && thresholdEvaluation) {
    return `${base} Supera el umbral citado (${thresholdEvaluation.measuredValue} ≥ ${thresholdEvaluation.thresholdValue} ${thresholdEvaluation.unit}). Pre-alerta y borrador CAP 1.2 preparados para el comité; ningún aviso público sale sin firma de una autoridad.`;
  }
  if (dossier.contradictions.length) {
    return `${base} Existen contradicciones activas que impiden escalar: ${dossier.contradictions[0]}.`;
  }
  return `${base} ${dossier.pros.length} prueba(s) a favor y ${dossier.cons.length} en contra/salvedades. Ningún aviso público se emite automáticamente.`;
}

/* ───────────── 3. Transición N4 → N5 (EXCLUSIVAMENTE HUMANA Y FIRMADA) ───────────── */

/**
 * Eleva un expediente a N5 (`Aviso a la población`) y emite CAP 1.2 público.
 * Requiere:
 *  1. `operationalStatus === 'ACTUAL'` (nunca una simulación o ejercicio).
 *  2. Expediente en N2, N3 o N4 (no rechazado ni N0 sin validar).
 *  3. `AuthorityGrant` firmada por `trustAnchorPublicRaw`, vigente en `nowMs` y con geocerca/peligro compatibles.
 *  4. Decisión humana firmada con Ed25519 por la clave privada de la autoridad nombrada en la grant + justificación.
 *  5. Registro obligatorio en el `auditLog` encadenado por SHA-256.
 */
export async function authorizePublicWarningN5(
  protocolResult,
  envelope,
  {
    grant,
    trustAnchorPublicRaw,
    authorityKeyPair,
    rationale,
    instruction,
    expiresAtMs,
    nowMs,
    auditLog = null,
    areaRadiusKm = 3,
  } = {}
) {
  if (!protocolResult || !envelope) throw new TypeError('authorizePublicWarningN5: faltan protocolResult y envelope');
  if (!Number.isFinite(nowMs)) throw new TypeError('authorizePublicWarningN5: nowMs obligatorio');
  if (envelope.operationalStatus !== 'ACTUAL') {
    throw new Error(`N5_BLOCKED_NON_ACTUAL: un expediente ${envelope.operationalStatus} jamás puede emitir un aviso público N5`);
  }
  if (!['N2', 'N3', 'N4'].includes(protocolResult.level)) {
    throw new Error(`N5_BLOCKED_LOW_LEVEL: se requiere nivel N2, N3 o N4 antes de autorización humana (actual: ${protocolResult.level})`);
  }
  if (typeof rationale !== 'string' || rationale.trim().length < 10) {
    throw new TypeError('N5_BLOCKED_NO_RATIONALE: la autoridad debe escribir el motivo de su decisión (≥ 10 caracteres)');
  }
  if (typeof instruction !== 'string' || instruction.trim().length < 10) {
    throw new TypeError('N5_BLOCKED_NO_INSTRUCTION: se requiere instrucción clara de autoprotección para la población');
  }
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    throw new RangeError('N5_BLOCKED_INVALID_EXPIRY: expiresAtMs debe ser posterior a nowMs');
  }
  if (!authorityKeyPair?.privateKey || !(authorityKeyPair?.publicRaw instanceof Uint8Array)) {
    throw new TypeError('N5_BLOCKED_NO_AUTHORITY_KEY: se requiere la clave Ed25519 de la autoridad humana');
  }

  // 1. Verificar AuthorityGrant contra ancla institucional, reloj, tipo de peligro y geocerca
  const grantVer = await verifyAuthorityGrant(grant, {
    trustAnchorPublicRaw,
    nowMs,
    hazardKind: envelope.payload.kind,
    location: envelope.payload.location,
  });
  if (!grantVer.ok) throw new Error(`N5_BLOCKED_GRANT: ${grantVer.reason}`);

  // 2. Verificar que la clave que firma la decisión corresponde exactamente a la autoridad habilitada
  if (b64(authorityKeyPair.publicRaw) !== grant.authorityPublicKeyB64u) {
    throw new Error('N5_BLOCKED_AUTHORITY_KEY_MISMATCH: la clave firmante no coincide con la autoridad del AuthorityGrant');
  }

  // 3. Firmar la decisión humana con Ed25519
  const decisionRecord = Object.freeze({
    schema: 'senda.n5-human-decision/v1',
    reportId: envelope.reportId,
    fromLevel: protocolResult.level,
    toLevel: 'N5',
    grantId: grant.grantId,
    authorityId: grant.authorityId,
    authorityName: grant.authorityName,
    role: grant.role,
    organization: grant.organization,
    decidedAtIso: new Date(nowMs).toISOString(),
    expiresAtIso: new Date(expiresAtMs).toISOString(),
    rationale: rationale.trim(),
    instruction: instruction.trim(),
    dossierContentSha256: envelope.contentSha256,
  });
  const decisionBytes = enc.encode(canonicalJson(decisionRecord));
  const decisionHash = await sha256HexCanonical(decisionRecord);
  const decisionSigB64u = b64(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, authorityKeyPair.privateKey, decisionBytes)));

  // 4. Registrar en cadena de auditoría SHA-256 (crea una nueva si el llamante no aportó una compartida)
  const log = auditLog ?? createAuditLog();
  const auditEntry = await log.append({
    at: nowMs,
    actor: `${grant.authorityId} (${grant.organization})`,
    action: 'AUTHORIZE_N5_PUBLIC_WARNING',
    data: {
      reportId: envelope.reportId,
      grantId: grant.grantId,
      decisionHash,
      fromLevel: protocolResult.level,
    },
  });

  // 5. Emitir CAP 1.2 público (Actual / Public) atribuido explícitamente a la autoridad humana
  const meta = CITIZEN_HAZARD_TYPES[envelope.payload.kind];
  const capPublicXml = toCap({
    identifier: `SENDA-N5-${envelope.reportId}-${nowMs}`,
    sender: grant.authorityId,
    sent: nowMs,
    status: 'Actual',
    msgType: 'Alert',
    scope: 'Public',
    info: {
      category: meta.capCategory,
      event: meta.label,
      urgency: meta.lifeRisk ? 'Immediate' : 'Expected',
      severity: meta.lifeRisk ? 'Extreme' : 'Severe',
      certainty: protocolResult.level === 'N3' || protocolResult.level === 'N4' ? 'Observed' : 'Likely',
      expires: expiresAtMs,
      senderName: `${grant.organization} — ${grant.authorityName} (${grant.role})`,
      headline: `Aviso oficial (${grant.organization}): ${meta.label}`,
      description: `${rationale.trim()} [Expediente SENDA ${envelope.reportId}, decisión firmada ${decisionHash.slice(0, 16)}…]`,
      instruction: instruction.trim(),
      parameters: [
        ['SENDA_LEVEL', 'N5'],
        ['SENDA_REPORT_ID', envelope.reportId],
        ['SENDA_GRANT_ID', grant.grantId],
        ['SENDA_DECISION_SHA256', decisionHash],
        ['SENDA_AUTHORITY_ROLE', grant.role],
      ],
      area: {
        areaDesc: `Zona de aviso delimitada por ${grant.organization}`,
        circle: { center: { lat: envelope.payload.location.lat, lon: envelope.payload.location.lon }, radiusKm: areaRadiusKm },
      },
    },
  });

  const n5Transition = Object.freeze({
    from: protocolResult.level,
    to: 'N5',
    atMs: nowMs,
    actor: `HUMANO_AUTORIDAD:${grant.authorityId}`,
    passed: true,
    proof: `Autorización humana firmada Ed25519 por ${grant.authorityName} (${grant.role}, ${grant.organization}), grant ${grant.grantId}.`,
  });

  return Object.freeze({
    ...protocolResult,
    level: 'N5',
    levelInfo: PROTOCOL_LEVELS.N5,
    canPublicWarn: true,
    reasonPlain: `Aviso a la población autorizado y firmado por ${grant.authorityName} (${grant.role}, ${grant.organization}): ${rationale.trim()}`,
    transitions: Object.freeze([...protocolResult.transitions, n5Transition]),
    humanAuthorization: Object.freeze({
      decision: decisionRecord,
      decisionHash,
      decisionSigB64u,
      grantId: grant.grantId,
      auditEntry,
    }),
    capPublicXml,
    basis: 'OFFICIAL',
  });
}

/**
 * Cancela un aviso público N5 emitiendo un CAP 1.2 `msgType: 'Cancel'` firmado por la autoridad
 * y rebajando el expediente (demuestra revocación humana auditable).
 */
export async function cancelPublicWarningN5(
  n5Result,
  envelope,
  { grant, trustAnchorPublicRaw, authorityKeyPair, reason, nowMs, auditLog = null } = {}
) {
  if (n5Result?.level !== 'N5' || !n5Result.canPublicWarn) {
    throw new Error('cancelPublicWarningN5: el expediente no está en nivel N5');
  }
  const grantVer = await verifyAuthorityGrant(grant, {
    trustAnchorPublicRaw,
    nowMs,
    hazardKind: envelope.payload.kind,
    location: envelope.payload.location,
  });
  if (!grantVer.ok) throw new Error(`CANCEL_BLOCKED_GRANT: ${grantVer.reason}`);
  if (b64(authorityKeyPair.publicRaw) !== grant.authorityPublicKeyB64u) {
    throw new Error('CANCEL_BLOCKED_AUTHORITY_KEY_MISMATCH');
  }
  const log = auditLog ?? createAuditLog();
  const auditEntry = await log.append({
    at: nowMs,
    actor: `${grant.authorityId} (${grant.organization})`,
    action: 'CANCEL_N5_PUBLIC_WARNING',
    data: { reportId: envelope.reportId, reason: String(reason ?? 'Situación remitida') },
  });
  const meta = CITIZEN_HAZARD_TYPES[envelope.payload.kind];
  const capCancelXml = toCap({
    identifier: `SENDA-N5-CANCEL-${envelope.reportId}-${nowMs}`,
    sender: grant.authorityId,
    sent: nowMs,
    status: 'Actual',
    msgType: 'Cancel',
    scope: 'Public',
    info: {
      category: meta.capCategory,
      event: `Cancelación: ${meta.label}`,
      urgency: 'Past',
      severity: 'Minor',
      certainty: 'Observed',
      senderName: `${grant.organization} — ${grant.authorityName}`,
      headline: `Cancelación de aviso (${grant.organization}): ${meta.label}`,
      description: String(reason ?? 'Aviso cancelado por la autoridad competente.'),
      parameters: [['SENDA_LEVEL', 'N1'], ['SENDA_CANCELLED_REPORT_ID', envelope.reportId]],
      area: { areaDesc: 'Zona del aviso cancelado', circle: { center: { lat: envelope.payload.location.lat, lon: envelope.payload.location.lon }, radiusKm: 1 } },
    },
  });
  return Object.freeze({
    ...n5Result,
    level: 'N1',
    levelInfo: PROTOCOL_LEVELS.N1,
    canPublicWarn: false,
    reasonPlain: `Aviso N5 cancelado por ${grant.authorityName} (${grant.organization}): ${reason ?? 'remisión'}.`,
    transitions: Object.freeze([
      ...n5Result.transitions,
      { from: 'N5', to: 'N1', atMs: nowMs, actor: `HUMANO_AUTORIDAD:${grant.authorityId}`, passed: true, downgrade: true, proof: `Cancelación humana: ${reason ?? 'remisión'}` },
    ]),
    capCancelXml,
    cancelAuditEntry: auditEntry,
  });
}
