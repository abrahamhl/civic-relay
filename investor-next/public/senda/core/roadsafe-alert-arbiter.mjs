/**
 * SENDA RoadSafe / H-ROAD-HMI-1: deterministic driver-alert attention arbiter.
 * Pure decision support: NO audio output, public warning, dispatch or phone access.
 * Policy timings below are research assumptions, not a road authority's standard.
 * The upstream canonical bus must validate road geometry, source origin and freshness.
 */
const SEVERITY = { CRITICAL: 4, HIGH: 3, MODERATE: 2, INFO: 1 };
const VOICE_EVIDENCE = new Set(['OFFICIAL', 'CORROBORATED']);
const DEFAULTS = Object.freeze({ minVoiceGapS: 15, emergencyVoiceGapS: 8, sceneRepeatGapS: 90,
  maxVoicePerMinute: 3, minTtcForVoiceS: 3, maxTtcForVoiceS: 90, maxVisible: 3 });

function eligibility(e, now) {
  if (!e || typeof e.incidentKey !== 'string' || !e.incidentKey.trim() ||
      typeof e.hazardType !== 'string' || !SEVERITY[e.severity] || !Number.isFinite(e.etaS) ||
      e.etaS < 0 || !Number.isFinite(e.expiresAt) || !Number.isFinite(e.observedAt) ||
      e.observedAt > now || e.expiresAt <= now) return 'INVALID_OR_EXPIRED';
  if (e.carriagewayMatch === false) return 'OPPOSITE_CARRIAGEWAY';
  if (e.evidence === 'SIMULATED' || e.evidence === 'DISPUTED') return 'NON_OPERATIONAL_EVIDENCE';
  if (!['OFFICIAL', 'CORROBORATED', 'UNVERIFIED'].includes(e.evidence)) return 'UNKNOWN_EVIDENCE';
  return null;
}
const getKey = (e) => `${e.incidentKey}:${e.hazardType}`;
const band = (etaS) => etaS <= 30 ? 0 : etaS <= 60 ? 1 : etaS <= 90 ? 2 : 3;
function order(a, b) {
  return band(a.etaS) - band(b.etaS) || SEVERITY[b.severity] - SEVERITY[a.severity] ||
    a.etaS - b.etaS || getKey(a).localeCompare(getKey(b));
}

export function createDriverAlertArbiter(options = {}) {
  const policy = { ...DEFAULTS, ...options };
  if (![policy.minVoiceGapS, policy.emergencyVoiceGapS, policy.sceneRepeatGapS,
    policy.maxVoicePerMinute, policy.minTtcForVoiceS, policy.maxTtcForVoiceS, policy.maxVisible]
    .every((x) => Number.isFinite(x) && x >= 0) || !Number.isInteger(policy.maxVoicePerMinute) ||
    !Number.isInteger(policy.maxVisible)) throw new RangeError('invalid arbiter policy');
  const spoken = new Map();
  let recentVoiceTimes = [], lastVoiceAt = -Infinity, lastNow = -Infinity;
  return {
    consider(candidates, { now, voiceOptIn = false, deploymentApproved = false } = {}) {
      if (!Number.isFinite(now) || now < lastNow || !Array.isArray(candidates))
        return { status: 'ABSTAIN', reason: 'INVALID_OR_BACKWARDS_CLOCK_OR_EVENTS', screen: [], voice: null };
      lastNow = now;
      recentVoiceTimes = recentVoiceTimes.filter((t) => now - t < 60);
      const byKey = new Map(), suppressed = [];
      for (const e of candidates) {
        const reason = eligibility(e, now);
        if (reason) { suppressed.push({ key: e?.incidentKey ?? null, reason }); continue; }
        const key = getKey(e), prev = byKey.get(key);
        // Same incident from BLE/DGT/DATEX is ONE alert, never extra independent evidence.
        if (!prev || SEVERITY[e.severity] > SEVERITY[prev.severity] ||
          (e.severity === prev.severity && e.observedAt > prev.observedAt)) byKey.set(key, e);
      }
      const all = [...byKey.values()].sort(order);
      const screen = all.slice(0, policy.maxVisible).map((e) => ({ incidentKey: e.incidentKey,
        hazardType: e.hazardType, severity: e.severity, etaS: e.etaS,
        label: e.evidence === 'UNVERIFIED' || e.carriagewayMatch !== true ? 'CHECK_LOCATION_UNCONFIRMED' : 'EVIDENCE_DECLARED',
        evidence: e.evidence }));
      let voice = null;
      if (voiceOptIn && deploymentApproved && recentVoiceTimes.length < policy.maxVoicePerMinute) {
        for (const e of all) {
          if (!VOICE_EVIDENCE.has(e.evidence) || e.carriagewayMatch !== true || e.warningApproved !== true ||
              e.etaS < policy.minTtcForVoiceS || e.etaS > policy.maxTtcForVoiceS) continue;
          const key = getKey(e), prev = spoken.get(key), escalated = prev && SEVERITY[e.severity] > SEVERITY[prev.severity];
          if (prev && !escalated && now - prev.at < policy.sceneRepeatGapS) continue;
          const emergency = e.severity === 'CRITICAL' && (!prev || escalated);
          const gap = emergency ? policy.emergencyVoiceGapS : policy.minVoiceGapS;
          if (now - lastVoiceAt < gap) continue;
          voice = { incidentKey: e.incidentKey, hazardType: e.hazardType, severity: e.severity,
            etaS: e.etaS, code: 'DESCRIBE_HAZARD_ONLY', preempt: emergency,
            note: 'No manoeuvre instruction; render only through separately authorized HMI' };
          spoken.set(key, { at: now, severity: e.severity });
          recentVoiceTimes.push(now); lastVoiceAt = now;
          break;
        }
      }
      return { status: 'PLANNING_ONLY', voice, screen, suppressed,
        uniqueScenes: new Set(all.map((e) => e.incidentKey)).size, deduplicatedHazards: all.length,
        note: 'HMI gating is not a regulatory approval or evidence of human-factors validation.' };
    },
  };
}
