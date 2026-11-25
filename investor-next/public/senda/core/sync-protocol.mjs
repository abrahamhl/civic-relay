/**
 * SENDA · Cliente independiente del transporte y sincronización multicanal (`sync-protocol.mjs`).
 *
 * Permite que los mismos expedientes y sobres firmados viajen y converjan de forma idéntica
 * entre todos los canales de SENDA: web, app móvil, escritorio PRO y malla sin red (BLE/LoRa/QR/fichero).
 *
 * Propiedades de sincronización (CRDT causal + resolución determinista de conflictos):
 *  - Idempotente: aplicar dos veces el mismo delta produce el mismo estado.
 *  - Conmutativa y asociativa: recibir deltas A→B o B→A converge al mismo `stateDigest()`.
 *  - Fail-closed: todo sobre ciudadano se verifica criptográficamente (Ed25519 + SHA-256) antes de entrar.
 *  - Regla de precedencia en conflictos de autoridad:
 *      cancelación humana N5 (firmada) > autorización humana N5 (firmada) > evaluación automática N0–N4.
 *    Un nodo desconectado que llegue tarde con un N4 automático jamás sobrescribe una cancelación humana N5.
 */

import {
  canonicalJson,
  sha256HexCanonical,
  verifyCitizenReport,
} from './citizen-report.mjs';

export const SYNC_DELTA_SCHEMA = 'senda.sync-delta/v1';
export const SYNC_CHANNELS = Object.freeze(['web', 'app', 'desktop', 'mesh', 'server']);

const PRECEDENCE = Object.freeze({
  N5_CANCELLED: 3,
  N5_AUTHORIZED: 2,
  AUTO_EVALUATED: 1,
});

/**
 * Libro de sincronización CRDT causal para reportes ciudadanos, verificaciones de paso
 * y decisiones humanas N5/cancelaciones.
 */
export function createSyncLedger({ channelId = 'local' } = {}) {
  const reports = new Map();       // reportId -> { envelope, receivedAtMs, channel, seq }
  const verifications = new Map(); // verificationId -> { verificationId, reportId, payload, atMs, channel, seq }
  const decisions = new Map();     // reportId -> { kind: 'N5_AUTHORIZED'|'N5_CANCELLED', decisionHash, atMs, actor, payload, channel, seq }
  const conflicts = [];
  let seq = 0;

  function recordConflict(entry) {
    conflicts.push(Object.freeze(entry));
  }

  function resolveDecisionConflict(existing, incoming) {
    const pOld = PRECEDENCE[existing.kind] ?? 0;
    const pNew = PRECEDENCE[incoming.kind] ?? 0;
    if (pNew > pOld) {
      recordConflict({
        type: 'AUTHORITY_PRECEDENCE_OVERRIDE',
        reportId: incoming.reportId,
        kept: incoming.kind,
        superseded: existing.kind,
        reason: `${incoming.kind} prevalece sobre ${existing.kind}`,
      });
      return incoming;
    }
    if (pNew < pOld) {
      recordConflict({
        type: 'STALE_LOWER_PRECEDENCE_IGNORED',
        reportId: incoming.reportId,
        kept: existing.kind,
        ignored: incoming.kind,
        reason: `${existing.kind} no puede ser degradado por ${incoming.kind}`,
      });
      return existing;
    }
    // Misma precedencia: desempate determinista por marca temporal más reciente y luego hash lexicográfico
    if (incoming.atMs > existing.atMs || (incoming.atMs === existing.atMs && incoming.decisionHash > existing.decisionHash)) {
      if (incoming.decisionHash !== existing.decisionHash) {
        recordConflict({
          type: 'SAME_PRECEDENCE_DETERMINISTIC_TIEBREAK',
          reportId: incoming.reportId,
          kept: incoming.decisionHash,
          superseded: existing.decisionHash,
        });
      }
      return incoming;
    }
    return existing;
  }

  return {
    channelId,

    /** Inserta un sobre ciudadano verificado (idempotente por reportId). */
    async putReport(envelope, { receivedAtMs = Date.now(), channel = channelId } = {}) {
      const ver = await verifyCitizenReport(envelope);
      if (!ver.ok) return { accepted: false, reason: ver.reason };
      const existing = reports.get(envelope.reportId);
      if (existing) {
        // Conserva la primera hora de recepción más temprana (determinista entre réplicas)
        if (receivedAtMs < existing.receivedAtMs) {
          existing.receivedAtMs = receivedAtMs;
        }
        return { accepted: true, duplicate: true, reportId: envelope.reportId };
      }
      seq++;
      reports.set(envelope.reportId, {
        envelope,
        receivedAtMs,
        channel,
        seq,
      });
      return { accepted: true, duplicate: false, reportId: envelope.reportId, seq };
    },

    /** Añade una verificación de cámara de paso (idempotente por verificationId). */
    putVerification({ verificationId, reportId, payload, atMs, channel = channelId }) {
      if (!verificationId || !reportId || !Number.isFinite(atMs)) {
        throw new TypeError('putVerification requiere verificationId, reportId y atMs');
      }
      if (verifications.has(verificationId)) return { accepted: true, duplicate: true };
      seq++;
      verifications.set(verificationId, { verificationId, reportId, payload, atMs, channel, seq });
      return { accepted: true, duplicate: false, seq };
    },

    /** Registra una decisión humana N5 o cancelación N5 con resolución determinista de conflictos. */
    putAuthorityDecision({ reportId, kind, decisionHash, atMs, actor, payload = null, channel = channelId }) {
      if (!reportId || !['N5_AUTHORIZED', 'N5_CANCELLED'].includes(kind) || !decisionHash || !Number.isFinite(atMs)) {
        throw new TypeError('putAuthorityDecision: campos obligatorios inválidos');
      }
      const next = { reportId, kind, decisionHash, atMs, actor: String(actor ?? ''), payload, channel, seq: ++seq };
      const prev = decisions.get(reportId);
      if (!prev) {
        decisions.set(reportId, next);
        return { accepted: true, decision: next };
      }
      if (prev.decisionHash === decisionHash && prev.kind === kind) {
        return { accepted: true, duplicate: true, decision: prev };
      }
      const winner = resolveDecisionConflict(prev, next);
      decisions.set(reportId, winner);
      return { accepted: winner === next, conflictResolved: true, decision: winner };
    },

    /** Exporta un paquete delta serializable a partir de `sinceSeq` (0 = volcado completo). */
    async exportDelta(sinceSeq = 0) {
      const repList = [...reports.values()]
        .filter((r) => r.seq > sinceSeq)
        .sort((a, b) => a.envelope.reportId.localeCompare(b.envelope.reportId))
        .map((r) => ({ envelope: r.envelope, receivedAtMs: r.receivedAtMs, channel: r.channel }));
      const verList = [...verifications.values()]
        .filter((v) => v.seq > sinceSeq)
        .sort((a, b) => a.verificationId.localeCompare(b.verificationId))
        .map(({ seq: _s, ...rest }) => rest);
      const decList = [...decisions.values()]
        .filter((d) => d.seq > sinceSeq)
        .sort((a, b) => a.reportId.localeCompare(b.reportId))
        .map(({ seq: _s, ...rest }) => rest);

      const core = {
        schema: SYNC_DELTA_SCHEMA,
        fromChannel: channelId,
        sinceSeq,
        toSeq: seq,
        reports: repList,
        verifications: verList,
        decisions: decList,
      };
      const deltaSha256 = await sha256HexCanonical(core);
      return Object.freeze({ ...core, deltaSha256 });
    },

    /** Fusiona un delta procedente de otro canal (conmutativo, asociativo e idempotente). */
    async mergeDelta(delta) {
      if (!delta || delta.schema !== SYNC_DELTA_SCHEMA) {
        return { ok: false, reason: 'INVALID_DELTA_SCHEMA' };
      }
      const { deltaSha256, ...core } = delta;
      if ((await sha256HexCanonical(core)) !== deltaSha256) {
        return { ok: false, reason: 'DELTA_CHECKSUM_MISMATCH' };
      }
      let addedReports = 0, rejectedReports = 0, addedVerifications = 0, appliedDecisions = 0;
      for (const item of delta.reports ?? []) {
        const res = await this.putReport(item.envelope, { receivedAtMs: item.receivedAtMs, channel: item.channel });
        if (!res.accepted) rejectedReports++;
        else if (!res.duplicate) addedReports++;
      }
      for (const v of delta.verifications ?? []) {
        const res = this.putVerification(v);
        if (!res.duplicate) addedVerifications++;
      }
      for (const d of delta.decisions ?? []) {
        const res = this.putAuthorityDecision(d);
        if (res.accepted && !res.duplicate) appliedDecisions++;
      }
      return { ok: true, addedReports, rejectedReports, addedVerifications, appliedDecisions };
    },

    /** Huella determinista del estado completo (independiente del orden de llegada de los deltas). */
    async stateDigest() {
      const canonicalState = {
        reports: [...reports.values()]
          .sort((a, b) => a.envelope.reportId.localeCompare(b.envelope.reportId))
          .map((r) => [r.envelope.reportId, r.envelope.contentSha256, r.receivedAtMs]),
        verifications: [...verifications.values()]
          .sort((a, b) => a.verificationId.localeCompare(b.verificationId))
          .map((v) => [v.verificationId, v.reportId, v.atMs, v.payload]),
        decisions: [...decisions.values()]
          .sort((a, b) => a.reportId.localeCompare(b.reportId))
          .map((d) => [d.reportId, d.kind, d.decisionHash, d.atMs]),
      };
      return sha256HexCanonical(canonicalState);
    },

    getReport: (id) => reports.get(id) ?? null,
    getDecision: (id) => decisions.get(id) ?? null,
    getVerifications: (id) => [...verifications.values()].filter((v) => v.reportId === id),
    listReports: () => [...reports.values()],
    conflicts: () => [...conflicts],
    stats: () => ({
      channelId,
      seq,
      reports: reports.size,
      verifications: verifications.size,
      decisions: decisions.size,
      conflicts: conflicts.length,
    }),
  };
}

/* ───────────── Cliente independiente del transporte ───────────── */

/**
 * Envuelve cualquier transporte (`http`, `memory`, `mesh`, `file`) con una API uniforme
 * para que web, app móvil y escritorio PRO usen exactamente la misma lógica cliente.
 */
export function createTransportClient(adapter) {
  if (!adapter || typeof adapter.submitReport !== 'function' || typeof adapter.listDossiers !== 'function') {
    throw new TypeError('createTransportClient: el adaptador debe implementar submitReport y listDossiers');
  }
  return Object.freeze({
    transportName: adapter.name ?? 'custom',
    submitReport: (envelope, opts) => adapter.submitReport(envelope, opts),
    getDossier: (reportId) => adapter.getDossier(reportId),
    listDossiers: (filter) => adapter.listDossiers(filter),
    subscribe: (onEvent) => (typeof adapter.subscribe === 'function' ? adapter.subscribe(onEvent) : () => {}),
    syncDelta: (delta) => (typeof adapter.syncDelta === 'function' ? adapter.syncDelta(delta) : Promise.resolve({ ok: false, reason: 'SYNC_NOT_SUPPORTED' })),
  });
}

/** Adaptador HTTP + SSE estándar contra el servidor de referencia local de SENDA. */
export function createHttpTransportAdapter({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) throw new TypeError('createHttpTransportAdapter: baseUrl obligatorio');
  const root = baseUrl.replace(/\/$/, '');
  return {
    name: 'http-reference',
    async submitReport(envelope, opts = {}) {
      const r = await fetchImpl(`${root}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envelope, ...opts }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `HTTP_${r.status}`);
      return data;
    },
    async getDossier(reportId) {
      const r = await fetchImpl(`${root}/api/v1/dossiers/${encodeURIComponent(reportId)}`);
      if (!r.ok) return null;
      return r.json();
    },
    async listDossiers(filter = {}) {
      const qs = new URLSearchParams();
      if (filter.level) qs.set('level', filter.level);
      if (filter.status) qs.set('status', filter.status);
      const suffix = qs.toString() ? `?${qs}` : '';
      const r = await fetchImpl(`${root}/api/v1/dossiers${suffix}`);
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      return r.json();
    },
    async syncDelta(delta) {
      const r = await fetchImpl(`${root}/api/v1/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: canonicalJson(delta),
      });
      return r.json();
    },
  };
}

/** Adaptador en memoria (para pruebas locales, modo sin red o pasarela de malla). */
export function createMemoryTransportAdapter({ ledger = createSyncLedger({ channelId: 'memory' }) } = {}) {
  const listeners = new Set();
  const emit = (ev) => { for (const fn of listeners) fn(ev); };
  return {
    name: 'memory-offline',
    ledger,
    async submitReport(envelope) {
      const res = await ledger.putReport(envelope);
      if (!res.accepted) throw new Error(res.reason);
      emit({ type: 'REPORT_RECEIVED', reportId: envelope.reportId });
      return res;
    },
    async getDossier(reportId) {
      return ledger.getReport(reportId);
    },
    async listDossiers() {
      return { dossiers: ledger.listReports() };
    },
    subscribe(onEvent) {
      listeners.add(onEvent);
      return () => listeners.delete(onEvent);
    },
    async syncDelta(delta) {
      const merged = await ledger.mergeDelta(delta);
      const localDelta = await ledger.exportDelta(0);
      emit({ type: 'SYNC_MERGED', merged });
      return { ...merged, serverDelta: localDelta };
    },
  };
}
