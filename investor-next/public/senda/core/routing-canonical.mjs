/**
 * SENDA · Motor de Enrutamiento Canónico y Adaptadores para Comparadores.
 *
 * Consolida bajo un único contrato fail-closed:
 *  - Puerta de autorización y roles (equivalente a `route-truth.mjs` y `arr-core.mjs`).
 *  - Enrutador canónico CGR (`router.mjs`).
 *  - Planificador de garantía de entrega con fallos correlacionados (`delivery-assurance.mjs`).
 *  - Cortes físicos SRLG N-1/N-2 (`failure-domain-cuts.mjs`) y consejo de evidencias H15 (`resilience-council.mjs`).
 *  - Registro de adaptadores externos (ARR ensemble, Dijkstra visor inversor, etc.) para comparación reproducible.
 *
 * Ninguna salida de este módulo emite radio ni confirma entrega física real.
 */
import { routeMessage, planRoutes } from './router.mjs';
import { planAssuredDelivery } from './delivery-assurance.mjs';
import { enumerateDeclaredFailureCuts } from './failure-domain-cuts.mjs';
import { auditResilienceCouncil } from './resilience-council.mjs';
import { EPISTEMIC_STATUS } from './evidence-contract.mjs';

export const CANONICAL_NODE_ROLES = Object.freeze(['SENDER', 'RECEIVER', 'RELAY', 'GATEWAY']);
const ROLE_SET = new Set(CANONICAL_NODE_ROLES);
const COMPARATOR_ADAPTERS = new Map();

export function isAuthorizedActiveNode(node) {
  return Boolean(
    node &&
    node.consent === true &&
    node.powered === true &&
    node.radioEnabled === true &&
    ROLE_SET.has(node.role)
  );
}

/**
 * Puerta fail-closed de nodos y enlaces (paridad con `assessModelRoute` de route-truth y `contactRejection` de ARR).
 */
export function assessCanonicalRouteGate({ nodes, links, source, destination, maxHops = 12 } = {}) {
  if (!Array.isArray(nodes) || !Array.isArray(links) || !Number.isSafeInteger(maxHops) || maxHops < 1 || maxHops > 64) {
    throw new TypeError('Invalid topology or maxHops');
  }
  const byId = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || byId.has(node.id)) {
      throw new TypeError('Invalid or duplicate node id');
    }
    byId.set(node.id, node);
  }

  const buildResult = (modelReachable, reason, path, rejectedLinks = {}) => Object.freeze({
    modelReachable,
    reason,
    path: Object.freeze(path),
    rejectedLinks: Object.freeze({ ...rejectedLinks }),
    basis: EPISTEMIC_STATUS.HIPOTESIS,
    evidenceLevel: 'SYNTHETIC_MODEL_ONLY',
    physicalDeliveryVerified: false,
    recipientAcknowledged: false,
    operationallySafe: false,
    canPublicWarn: false,
  });

  if (!byId.has(source) || !byId.has(destination)) return buildResult(false, 'UNKNOWN_ENDPOINT', []);
  if (source === destination) return buildResult(false, 'SAME_ENDPOINT_NOT_DELIVERY', []);
  if (!isAuthorizedActiveNode(byId.get(source)) || !isAuthorizedActiveNode(byId.get(destination))) {
    return buildResult(false, 'ENDPOINT_NOT_AUTHORIZED_OR_UNAVAILABLE', []);
  }

  const rejectedLinks = {};
  const reject = (why) => { rejectedLinks[why] = (rejectedLinks[why] ?? 0) + 1; };
  const adjacency = new Map([...byId.keys()].map((id) => [id, []]));

  for (const link of links) {
    if (!link || !byId.has(link.from) || !byId.has(link.to)) { reject('UNKNOWN_ENDPOINT'); continue; }
    if (link.kind !== 'ACTIVE_RADIO') { reject('NOT_ACTIVE_RADIO'); continue; }
    if (link.authorized !== true) { reject('NOT_AUTHORIZED'); continue; }
    if (link.enabled !== true) { reject('DISABLED'); continue; }
    if (link.dutyCycleAllowed !== true) { reject('DUTY_CYCLE'); continue; }
    if (!isAuthorizedActiveNode(byId.get(link.from)) || !isAuthorizedActiveNode(byId.get(link.to))) {
      reject('NODE_NOT_ELIGIBLE');
      continue;
    }
    adjacency.get(link.from).push(link.to);
  }
  for (const list of adjacency.values()) list.sort();

  const queue = [[source]];
  const seen = new Set([source]);
  while (queue.length) {
    const path = queue.shift();
    if (path.length - 1 >= maxHops) continue;
    for (const next of adjacency.get(path[path.length - 1])) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === destination) return buildResult(true, 'MODEL_PATH_FOUND_NOT_DELIVERED', nextPath, rejectedLinks);
      seen.add(next);
      queue.push(nextPath);
    }
  }
  return buildResult(false, 'NO_AUTHORIZED_ACTIVE_PATH', [], rejectedLinks);
}

/** Registra un comparador externo (p. ej. ARR o Dijkstra de laboratorio) sin duplicar el núcleo. */
export function registerRoutingComparator(name, adapterFn) {
  if (typeof name !== 'string' || !name.trim() || typeof adapterFn !== 'function') {
    throw new TypeError('Comparator registration requires non-empty name and function');
  }
  COMPARATOR_ADAPTERS.set(name.trim().toUpperCase(), adapterFn);
}

export function listRoutingComparators() {
  return ['CGR', 'DELIVERY_ASSURANCE', 'SRLG_CUTS', 'RESILIENCE_COUNCIL', ...COMPARATOR_ADAPTERS.keys()];
}

/**
 * Ejecuta un motor canónico o adaptador registrado y devuelve siempre el contrato unificado SENDA.
 */
export async function planCanonicalRoute({
  engine = 'CGR',
  contacts = [],
  source = 'ORIGIN',
  dest = 'DEST',
  t0 = 0,
  sizeBytes = 512,
  k = 3,
  availableBearers = [],
  assuranceOptions = {},
  srlgInput = null,
  councilInput = null,
  adapterInput = null,
} = {}) {
  const key = String(engine || 'CGR').trim().toUpperCase();
  const baseEnvelope = {
    engine: key,
    basis: EPISTEMIC_STATUS.SIMULADO,
    evidenceLevel: 'CANONICAL_MODEL_SIMULATION',
    physicalDeliveryVerified: false,
    institutionalAuthorityVerified: false,
    canPublicWarn: false,
  };

  if (key === 'CGR') {
    const res = routeMessage({ contacts, source, dest, t0, sizeBytes, k });
    return Object.freeze({
      ...baseEnvelope,
      status: res.status,
      routes: res.routes,
      eta: res.eta,
      etaSeconds: res.etaSeconds ?? null,
      optimisticIndependentProbability: res.deliveryProbability ?? 0,
      failureCuts: null,
      explanation: `${res.explanation} (Aviso: CGR asume rutas independientes salvo auditoría SRLG/ARR.)`,
      raw: res,
    });
  }

  if (key === 'DELIVERY_ASSURANCE') {
    const res = planAssuredDelivery(sizeBytes, availableBearers, assuranceOptions);
    return Object.freeze({
      ...baseEnvelope,
      status: res.feasible ? 'MODEL_PLAN_FEASIBLE' : 'NO_VIABLE_BEARER_PLAN',
      routes: res.messages ?? [],
      eta: null,
      etaSeconds: null,
      correlatedDeliveryProbability: res.pDelivery ?? 0,
      kOfN: res.feasible ? { k: res.k, n: res.n } : null,
      failureCuts: null,
      explanation: res.feasible
        ? `Plan correlacionado ${res.k}/${res.n} fragmentos (p=${(100 * (res.pDelivery ?? 0)).toFixed(2)} %, modelo).`
        : 'Sin combinación de portadores viable bajo restricciones de escenario y presupuesto.',
      raw: res,
    });
  }

  if (key === 'SRLG_CUTS') {
    if (!srlgInput) throw new TypeError('SRLG_CUTS requires srlgInput');
    const res = enumerateDeclaredFailureCuts(srlgInput);
    return Object.freeze({
      ...baseEnvelope,
      basis: EPISTEMIC_STATUS.HIPOTESIS,
      status: res.survivesAllEnumeratedCuts ? 'MODEL_SURVIVES_DECLARED_CUTS' : 'CUT_VULNERABILITY_DETECTED',
      routes: res.eligiblePathSummaries ?? [],
      failureCuts: res,
      explanation: res.survivesAllEnumeratedCuts
        ? `Topología declarada sobrevive cortes N-${srlgInput.maxSimultaneousFailures ?? 2} declarados (no probado en RF).`
        : `Detectados ${res.failingCuts?.length ?? 0} corte(s) de causa común o topología desconocida.`,
      raw: res,
    });
  }

  if (key === 'RESILIENCE_COUNCIL') {
    if (!councilInput) throw new TypeError('RESILIENCE_COUNCIL requires councilInput');
    const res = await auditResilienceCouncil(councilInput);
    return Object.freeze({
      ...baseEnvelope,
      basis: EPISTEMIC_STATUS.HIPOTESIS,
      status: res.recommendation ?? 'COUNSEL_AUDITED',
      routes: res.candidateEvaluations ?? [],
      failureCuts: res.topology ?? null,
      explanation: 'Consejo de evidencias H15 (solo investigación/auditoría; nunca arma transmisores).',
      raw: res,
    });
  }

  if (COMPARATOR_ADAPTERS.has(key)) {
    const out = await COMPARATOR_ADAPTERS.get(key)(adapterInput ?? { contacts, source, dest, t0, sizeBytes, k });
    return Object.freeze({
      ...baseEnvelope,
      basis: out?.basis ?? EPISTEMIC_STATUS.SIMULADO,
      status: out?.status ?? 'COMPARATOR_EXECUTED',
      routes: out?.routes ?? [],
      failureCuts: out?.failureCuts ?? null,
      explanation: out?.explanation ?? `Adaptador comparador ${key} ejecutado en modo simulación.`,
      raw: out,
    });
  }

  throw new RangeError(`Unknown routing engine or comparator: ${engine}`);
}

/** Ejecuta múltiples motores/comparadores sobre entradas declaradas para contraste reproducible. */
export async function compareCanonicalRoutes(engines, sharedInput) {
  if (!Array.isArray(engines) || !engines.length) throw new TypeError('engines array required');
  const results = [];
  for (const engine of engines) {
    results.push(await planCanonicalRoute({ ...sharedInput, engine }));
  }
  return Object.freeze({
    basis: EPISTEMIC_STATUS.SIMULADO,
    physicalDeliveryVerified: false,
    canPublicWarn: false,
    comparisons: results,
    quickCgrRoutes: sharedInput?.contacts?.length
      ? planRoutes({ contacts: sharedInput.contacts, source: sharedInput.source ?? 'ORIGIN', dest: sharedInput.dest ?? 'DEST', t0: sharedInput.t0 ?? 0, sizeBytes: sharedInput.sizeBytes ?? 512, k: sharedInput.k ?? 3 })
      : [],
  });
}
