/**
 * SENDA · Gobernanza epistémica, panel determinista de especialistas para el comité,
 * grafo de conocimiento situacional y auto-auditoría de seguridad/veracidad (`triage-governance.mjs`).
 *
 * Integra y adapta a SENDA las arquitecturas de gobernanza y auditoría de `civil-sentry` y `calmpath-maps-pro`:
 *  1. **Panel determinista de 4 especialistas para el comité** (adaptado del patrón *Three-Experts Consensus*
 *     y *Consistency Auditor* de `calmpath-maps-pro`, 100 % determinista sin claves ni APIs externas):
 *     - Especialista en Física/Hidrología/Incendio
 *     - Especialista en Operaciones de Protección Civil y Evacuación
 *     - Especialista Forense e Independencia de Fuentes
 *     - Auditor Adversario (Red-Team: busca contradicciones, inyecciones MITRE ATLAS y huecos epistémicos)
 *     Reconcilia discrepancias explícitamente en un único informe de comité; `canPublicWarn` es SIEMPRE `false`.
 *  2. **Grafo de conocimiento situacional (`createSituationGraph`)** (patrón Graphify + `Observation → Evidence → Finding`):
 *     nodos tipados y aristas `SUPPORTS | CONTRADICTS | SUPERSEDES | LOCATED_IN | AFFECTS | SOURCED_FROM | AUTHORIZED_BY`.
 *  3. **Auto-auditoría epistémica y de modelo de amenazas (`runEpistemicSecurityAudit`)** (STRIDE + MITRE ATT&CK + ATLAS):
 *     verifica en tiempo de ejecución 8 invariantes críticos (fundamentación de `VERIFIED`, integridad de puerta N5,
 *     aislamiento `SIMULATION`/`ACTUAL`, no confusión `COLLECTION_ERROR`↔`ABSENT`, cadenas hash, consentimiento,
 *     ausencia de PII en registros y cuarentena de señales de inyección).
 *
 * Módulo ES puro compatible con navegador y Node (WebCrypto, cero `node:*`).
 */

import { verifyEvidenceChainIntegrity } from './citizen-report.mjs';
import { sanitizeUntrustedText } from './report-forensics.mjs';

export const GRAPH_NODE_TYPES = Object.freeze([
  'REPORT',
  'EVIDENCE',
  'FINDING',
  'HAZARD_ZONE',
  'SHELTER',
  'ASSET',
  'AUTHORITY_DECISION',
]);

export const GRAPH_EDGE_TYPES = Object.freeze([
  'SUPPORTS',
  'CONTRADICTS',
  'SUPERSEDES',
  'LOCATED_IN',
  'AFFECTS',
  'SOURCED_FROM',
  'AUTHORIZED_BY',
]);

/* ───────────── 1. Grafo de conocimiento situacional epistémico ───────────── */

/**
 * Crea un grafo dirigido de conocimiento situacional para un expediente o sala de crisis SENDA.
 * Permite rastrear cadenas de soporte, detectar contradicciones activas y resolver reemplazos (`SUPERSEDES`).
 */
export function createSituationGraph({ incidentId = 'senda-graph' } = {}) {
  const nodes = new Map();
  const edges = [];

  function addNode({ id, type, label, confidence = 'UNKNOWN', basis = 'CITIZEN', timestampUtc = null, meta = {} }) {
    if (!id || typeof id !== 'string') throw new RangeError('addNode: id string obligatorio');
    if (!GRAPH_NODE_TYPES.includes(type)) throw new RangeError(`addNode: tipo de nodo inválido '${type}'`);
    const node = Object.freeze({ id, type, label: label ?? id, confidence, basis, timestampUtc, meta: Object.freeze({ ...meta }) });
    nodes.set(id, node);
    return node;
  }

  function addEdge({ from, to, relation, weight = 1.0, reason = null }) {
    if (!nodes.has(from) || !nodes.has(to)) {
      throw new RangeError(`addEdge: nodos '${from}' y '${to}' deben existir en el grafo`);
    }
    if (!GRAPH_EDGE_TYPES.includes(relation)) throw new RangeError(`addEdge: relación inválida '${relation}'`);
    const edge = Object.freeze({ from, to, relation, weight, reason });
    edges.push(edge);
    return edge;
  }

  function getSupportingChain(targetId, maxDepth = 5) {
    const visited = new Set([targetId]);
    const queue = [{ id: targetId, depth: 0 }];
    const chain = [];
    while (queue.length) {
      const { id, depth } = queue.shift();
      if (depth >= maxDepth) continue;
      for (const e of edges) {
        if (e.to === id && (e.relation === 'SUPPORTS' || e.relation === 'SOURCED_FROM')) {
          chain.push({ edge: e, sourceNode: nodes.get(e.from), depth: depth + 1 });
          if (!visited.has(e.from)) {
            visited.add(e.from);
            queue.push({ id: e.from, depth: depth + 1 });
          }
        }
      }
    }
    return chain;
  }

  function findContradictions() {
    return edges
      .filter((e) => e.relation === 'CONTRADICTS')
      .map((e) => Object.freeze({
        challenger: nodes.get(e.from),
        challenged: nodes.get(e.to),
        weight: e.weight,
        reason: e.reason,
      }));
  }

  function isSuperseded(nodeId) {
    return edges.some((e) => e.to === nodeId && e.relation === 'SUPERSEDES');
  }

  function getActiveNodes(type = null) {
    return [...nodes.values()].filter((n) => (!type || n.type === type) && !isSuperseded(n.id));
  }

  function summarizeTopology() {
    const byType = {};
    for (const n of nodes.values()) byType[n.type] = (byType[n.type] ?? 0) + 1;
    const byRelation = {};
    for (const e of edges) byRelation[e.relation] = (byRelation[e.relation] ?? 0) + 1;
    const activeFindings = getActiveNodes('FINDING');
    const ungroundedFindings = activeFindings.filter((f) =>
      !edges.some((e) => e.to === f.id && e.relation === 'SUPPORTS'),
    );
    return Object.freeze({
      incidentId,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      byType: Object.freeze(byType),
      byRelation: Object.freeze(byRelation),
      contradictionCount: findContradictions().length,
      ungroundedActiveFindingIds: ungroundedFindings.map((f) => f.id),
    });
  }

  function exportJson() {
    return Object.freeze({
      schema: 'senda.situation-graph/v1',
      incidentId,
      nodes: [...nodes.values()],
      edges: [...edges],
      summary: summarizeTopology(),
    });
  }

  return Object.freeze({
    addNode,
    addEdge,
    getNode: (id) => nodes.get(id) ?? null,
    getSupportingChain,
    findContradictions,
    isSuperseded,
    getActiveNodes,
    summarizeTopology,
    exportJson,
  });
}

/* ───────────── 2. Panel determinista de 4 especialistas + Auditor Adversario para el Comité ───────────── */

/**
 * Ejecuta una revisión determinista paralela con 4 perspectivas especializadas sobre un expediente SENDA
 * (Física/Hidrología, Operaciones/Evacuación, Forense/Fuentes y Auditor Adversario Red-Team) y sintetiza
 * un único dictamen de consenso destacando discrepancias y contradicciones.
 *
 * REGLA INMUTABLE: `canPublicWarn` es SIEMPRE `false`; solo prepara y audita la decisión del comité humano.
 */
export function runCommitteeTriagePanel({
  report,
  forensicAssessment,
  protocolState,
  physicsCheck = null,
  shelterRanking = null,
  evacuationRoute = null,
  nowIso = new Date().toISOString(),
}) {
  if (!report || !forensicAssessment || !protocolState) {
    throw new Error('runCommitteeTriagePanel: report, forensicAssessment y protocolState son obligatorios');
  }

  // Especialista 1 · Física / Hidrología / Incendio
  const phys = forensicAssessment.blocks?.physical ?? {};
  const physFlags = [];
  let physScore = 0.5;
  if (phys.confidence === 'VERIFIED' || phys.confidence === 'SUPPORTED') {
    physScore = 0.85;
  } else if (phys.confidence === 'CONTRADICTED') {
    physScore = 0.1;
    physFlags.push('contradiccion_fisica_detectada');
  } else if (phys.confidence === 'UNKNOWN') {
    physScore = 0.4;
    physFlags.push('contexto_fisico_sin_instrumento');
  }
  if (physicsCheck?.unstable === true || physicsCheck?.exceeded === true || physicsCheck?.defraClass === 'EXTREME_FOR_ALL') {
    physScore = Math.min(1, physScore + 0.15);
    physFlags.push('umbral_fisico_critico_superado');
  }
  const specialistPhysics = Object.freeze({
    role: 'ESPECIALISTA_FISICA_Y_ENTORNO',
    stance: phys.confidence === 'CONTRADICTED' ? 'OPPOSE' : physScore >= 0.75 ? 'ESCALATE_COMMITTEE' : 'MONITOR_VERIFY',
    score: +physScore.toFixed(2),
    flags: physFlags,
    rationale: phys.confidence === 'CONTRADICTED'
      ? 'El contexto físico contradice el fenómeno reportado; requiere verificación instrumental antes de escalar.'
      : `Confianza física ${phys.confidence ?? 'UNKNOWN'}${physicsCheck ? ' con chequeo cuantitativo adjunto' : ''}.`,
  });

  // Especialista 2 · Operaciones de Protección Civil y Evacuación
  const opsFlags = [];
  let opsUrgency = protocolState.level === 'N4' ? 0.9 : protocolState.level === 'N3' ? 0.8 : protocolState.level === 'N2' ? 0.65 : 0.35;
  if (shelterRanking && shelterRanking.topRecommendations?.length === 0) {
    opsUrgency = Math.min(1, opsUrgency + 0.1);
    opsFlags.push('sin_albergue_apto_en_radio');
  }
  if (evacuationRoute && evacuationRoute.found === false) {
    opsUrgency = Math.min(1, opsUrgency + 0.1);
    opsFlags.push('rutas_evacuacion_cortadas');
  }
  if (report.hazardType === 'sos' || report.hazardType === 'ferrocarril' || report.hazardType === 'nivel_presa_rio') {
    opsFlags.push(`peligro_prioritario_${report.hazardType}`);
  }
  const specialistOps = Object.freeze({
    role: 'ESPECIALISTA_OPERACIONES_PC',
    stance: opsUrgency >= 0.75 ? 'PREPARE_COMMITTEE_ACTION' : 'WATCH_AND_FIELD_VERIFY',
    score: +opsUrgency.toFixed(2),
    flags: opsFlags,
    rationale: `Nivel protocolo ${protocolState.level}; ${shelterRanking ? `${shelterRanking.topRecommendations.length} zonas seguras aptas` : 'zonas seguras no evaluadas'}${evacuationRoute ? (evacuationRoute.found ? `, ruta segura ETA ${evacuationRoute.etaMinutes} min` : ', SIN ruta segura') : ''}.`,
  });

  // Especialista 3 · Forense e Independencia de Fuentes
  const dev = forensicAssessment.blocks?.device ?? {};
  const sat = forensicAssessment.blocks?.satelliteOfficial ?? {};
  const crowd = forensicAssessment.blocks?.crowdCameras ?? {};
  const forFlags = [];
  let forTrust = 0.5;
  if (dev.coherent === false) { forTrust -= 0.35; forFlags.push('incoherencia_dispositivo'); }
  if (dev.duplicateDetected) { forTrust -= 0.25; forFlags.push('imagen_reutilizada_dhash'); }
  if (sat.verifiedByInstrument) { forTrust += 0.35; forFlags.push('confirmacion_instrumental_o_satelite'); }
  if ((crowd.independentCount ?? 0) >= 2) { forTrust += 0.2; forFlags.push(`corroboracion_independiente_${crowd.independentCount}`); }
  forTrust = Math.max(0, Math.min(1, forTrust));
  const specialistForensics = Object.freeze({
    role: 'ESPECIALISTA_FORENSE_FUENTES',
    stance: forTrust < 0.3 ? 'REJECT_OR_QUARANTINE' : forTrust >= 0.7 ? 'CORROBORATED' : 'REQUEST_PASSERBY_VERIFY',
    score: +forTrust.toFixed(2),
    flags: forFlags,
    rationale: `Coherencia dispositivo=${dev.coherent !== false}, independientes=${crowd.independentCount ?? 0}, instrumento=${Boolean(sat.verifiedByInstrument)}.`,
  });

  // Especialista 4 · Auditor Adversario (Red-Team / Consistencia / MITRE ATLAS)
  const redFlags = [];
  const textScan = sanitizeUntrustedText(report.description ?? report.text ?? '');
  if (textScan.suspiciousInjection) redFlags.push('senial_inyeccion_mitre_atlas');
  if (report.operationalStatus && report.operationalStatus !== 'ACTUAL') redFlags.push(`estado_no_operativo_${report.operationalStatus}`);
  if (protocolState.canPublicWarn === true && protocolState.level !== 'N5') redFlags.push('violacion_invariante_canPublicWarn');
  if (forensicAssessment.hasVerifiedContradiction) redFlags.push('contradiccion_verificada_activa');
  if (!report.consent?.accepted) redFlags.push('consentimiento_ausente');

  const redTeamAuditor = Object.freeze({
    role: 'AUDITOR_ADVERSARIO_RED_TEAM',
    stance: redFlags.length > 0 ? 'BLOCK_OR_HOLD_FOR_HUMAN_REVIEW' : 'NO_ADVERSARIAL_BLOCKERS',
    blockerCount: redFlags.length,
    flags: redFlags,
    rationale: redFlags.length > 0
      ? `Detectadas ${redFlags.length} alertas adversarias/epistémicas: ${redFlags.join(', ')}.`
      : 'Sin bloqueos adversarios ni violaciones de invariantes epistémicos.',
  });

  // Reconciliación / Consenso
  const specialists = [specialistPhysics, specialistOps, specialistForensics, redTeamAuditor];
  const disagreements = [];
  if (specialistPhysics.stance === 'OPPOSE' && specialistOps.stance === 'PREPARE_COMMITTEE_ACTION') {
    disagreements.push('Física contradice el aviso mientras Operaciones señala urgencia elevada: retener en revisión humana.');
  }
  if (specialistForensics.stance === 'REJECT_OR_QUARANTINE' && (protocolState.level === 'N2' || protocolState.level === 'N3' || protocolState.level === 'N4')) {
    disagreements.push('Forense detecta anomalías de dispositivo/duplicado frente a nivel escalado: exigir prueba instrumental.');
  }
  if (redFlags.length > 0) {
    disagreements.push(`Auditor Adversario impone retención por: ${redFlags.join(', ')}.`);
  }

  let recommendedCommitteeAction = 'SEGUIMIENTO_Y_VERIFICACION_DE_PASO';
  if (redFlags.includes('estado_no_operativo_SIMULATION') || redFlags.includes('estado_no_operativo_EXERCISE') || redFlags.includes('estado_no_operativo_TEST')) {
    recommendedCommitteeAction = 'MANTENER_AISLADO_EN_SIMULACRO_NO_OPERATIVO';
  } else if (redFlags.length > 0 || specialistForensics.stance === 'REJECT_OR_QUARANTINE' || specialistPhysics.stance === 'OPPOSE') {
    recommendedCommitteeAction = 'CUARENTENA_Y_REVISION_MANUAL_DEL_COMITE';
  } else if (protocolState.level === 'N4' && specialistPhysics.score >= 0.7 && specialistForensics.score >= 0.7) {
    recommendedCommitteeAction = 'PRESENTAR_BORRADOR_CAP_A_AUTORIDAD_HUMANA_PARA_DECISION_N5';
  } else if (protocolState.level === 'N2' || protocolState.level === 'N3') {
    recommendedCommitteeAction = 'PRE_ALERTA_INTERNA_Y_SOLICITUD_DE_CONFIRMACION_DE_CAMPO';
  }

  const consensusScore = +(0.35 * specialistPhysics.score + 0.30 * specialistForensics.score + 0.35 * specialistOps.score).toFixed(3);

  return Object.freeze({
    schema: 'senda.committee-triage-panel/v1',
    evaluatedAtUtc: nowIso,
    reportId: report.reportId ?? report.id ?? null,
    protocolLevel: protocolState.level,
    canPublicWarn: false, // Invariante inviolable
    consensusScore,
    recommendedCommitteeAction,
    disagreements,
    specialists: Object.freeze(specialists),
    basis: 'INFERRED',
  });
}

/* ───────────── 3. Auto-auditoría epistémica y de modelo de amenazas (STRIDE + ATT&CK + ATLAS) ───────────── */

const PII_PATTERNS = [
  { id: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { id: 'dni_es', re: /\b[0-9]{8}[A-HJ-NP-TV-Z]\b/i },
  { id: 'phone_es', re: /\b(?:\+34[\s-]?)?[6789][0-9]{2}[\s-]?[0-9]{3}[\s-]?[0-9]{3}\b/ },
];

/**
 * Audita programáticamente invariantes epistémicos y de seguridad sobre un conjunto de expedientes,
 * estados de protocolo, cadenas de evidencia y registros operativos de SENDA.
 */
export async function runEpistemicSecurityAudit({
  reports = [],
  findings = [],
  protocolStates = [],
  evidenceChains = [],
  logLines = [],
  nowIso = new Date().toISOString(),
} = {}) {
  const violations = [];
  const checkedInvariants = [
    'GROUNDING_VERIFIED_FINDINGS',
    'N5_HUMAN_AUTHORIZATION_GATE',
    'SIMULATION_OPERATIONAL_ISOLATION',
    'COLLECTION_ERROR_NOT_CONFLATED_WITH_ABSENT',
    'EVIDENCE_CHAIN_HASH_INTEGRITY',
    'EXPLICIT_CONSENT_AND_SIGNATURE',
    'ZERO_PII_IN_LOGS',
    'MITRE_ATLAS_INJECTION_DETECTION',
  ];

  // 1. Fundamentación de hallazgos VERIFIED / SUPPORTED
  for (const f of findings) {
    const refs = f.evidenceIds ?? f.supportingEvidenceIds ?? [];
    if ((f.confidence === 'VERIFIED' || f.confidence === 'SUPPORTED') && refs.length === 0) {
      violations.push({ invariant: 'GROUNDING_VERIFIED_FINDINGS', severity: 'HIGH', entityId: f.id ?? 'unknown', detail: `Hallazgo con confianza ${f.confidence} sin evidenceIds de soporte` });
    }
    if (f.sourceStatus === 'COLLECTION_ERROR' && (f.confidence === 'ABSENT' || f.confidence === 'CONTRADICTED')) {
      violations.push({ invariant: 'COLLECTION_ERROR_NOT_CONFLATED_WITH_ABSENT', severity: 'HIGH', entityId: f.id ?? 'unknown', detail: 'Un fallo de recolección fue tratado como ausencia o contradicción' });
    }
  }

  // 2 y 3. Puerta N5 y aislamiento de simulacros
  for (const ps of protocolStates) {
    if (ps.canPublicWarn === true) {
      const hasHumanAuth = Boolean(ps.level === 'N5' && ps.humanAuthorization?.authorityId && ps.humanAuthorization?.decisionSignature);
      if (!hasHumanAuth) {
        violations.push({ invariant: 'N5_HUMAN_AUTHORIZATION_GATE', severity: 'CRITICAL', entityId: ps.reportId ?? 'unknown', detail: 'canPublicWarn=true sin autorización criptográfica humana N5 válida' });
      }
      if (ps.operationalStatus && ps.operationalStatus !== 'ACTUAL') {
        violations.push({ invariant: 'SIMULATION_OPERATIONAL_ISOLATION', severity: 'CRITICAL', entityId: ps.reportId ?? 'unknown', detail: `canPublicWarn=true en estado no operativo (${ps.operationalStatus})` });
      }
    }
  }

  // 4 y 5. Integridad criptográfica de cadenas de evidencia y no confusión error/ausencia
  for (let idx = 0; idx < evidenceChains.length; idx++) {
    const ch = evidenceChains[idx];
    const entries = Array.isArray(ch) ? ch : typeof ch?.entries === 'function' ? ch.entries() : ch?.items ?? [];
    const check = await verifyEvidenceChainIntegrity(entries);
    if (!check.ok) {
      violations.push({ invariant: 'EVIDENCE_CHAIN_HASH_INTEGRITY', severity: 'CRITICAL', entityId: ch?.chainId ?? `chain[${idx}]`, detail: `Cadena de evidencia alterada (${check.reason ?? 'hash inválido'} en índice ${check.brokenAt})` });
    }
    for (const item of entries) {
      if ((item.observationStatus === 'COLLECTION_ERROR' || item.status === 'COLLECTION_ERROR') && (item.confidence === 'CONTRADICTED' || item.interpretedAsAbsent === true)) {
        violations.push({ invariant: 'COLLECTION_ERROR_NOT_CONFLATED_WITH_ABSENT', severity: 'HIGH', entityId: item.id ?? 'item', detail: 'Elemento COLLECTION_ERROR marcado como ausencia o contradicción' });
      }
    }
  }

  // 6 y 8. Consentimiento, firma y señales MITRE ATLAS en reportes ciudadanos
  for (const r of reports) {
    const payload = r.payload ?? r;
    const hasConsent = Boolean(payload.consent?.accepted);
    const hasSig = Boolean(r.signature || r.sigB64u || r.auth?.signatureB64u);
    if (!hasConsent || !hasSig) {
      violations.push({ invariant: 'EXPLICIT_CONSENT_AND_SIGNATURE', severity: 'HIGH', entityId: payload.reportId ?? r.reportId ?? 'report', detail: 'Reporte ciudadano sin consentimiento explícito o sin firma Ed25519' });
    }
    const scan = sanitizeUntrustedText(payload.description ?? payload.text ?? r.description ?? r.text ?? '');
    if (scan.suspiciousInjection) {
      violations.push({ invariant: 'MITRE_ATLAS_INJECTION_DETECTION', severity: 'MEDIUM', entityId: payload.reportId ?? r.reportId ?? 'report', detail: `Señales de inyección detectadas: ${scan.matchedPatterns.join(', ')}` });
    }
  }

  // 7. Ausencia de PII en registros operativos
  for (let i = 0; i < logLines.length; i++) {
    const line = String(logLines[i]);
    for (const pat of PII_PATTERNS) {
      if (pat.re.test(line)) {
        violations.push({ invariant: 'ZERO_PII_IN_LOGS', severity: 'HIGH', entityId: `log[${i}]`, detail: `Posible fuga de PII (${pat.id}) en registro` });
      }
    }
  }

  const criticalCount = violations.filter((v) => v.severity === 'CRITICAL').length;
  return Object.freeze({
    schema: 'senda.epistemic-security-audit/v1',
    auditedAtUtc: nowIso,
    passed: violations.length === 0,
    criticalCount,
    violationCount: violations.length,
    checkedInvariants,
    violations: Object.freeze(violations),
    basis: 'MEASURED',
  });
}
