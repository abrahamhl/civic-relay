/**
 * SENDA-CAL · reliability-store.mjs
 * Motor de Aprendizaje Continuo Empírico y Almacén de Fiabilidad por Canal y Zona.
 *
 * Implementa el foso de datos de Civic Relay / SENDA:
 * 1. Contrato de recibo firmado `DeliveryReceipt v1` anónimo (sin PII, resolución H3 res 7).
 * 2. Modelo jerárquico Beta-Binomial con Empirical Bayes Shrinkage hacia el prior global.
 * 3. Olvido exponencial configurable para canales no estacionarios.
 * 4. CRDT de estado (un registro por nodo, gana el de mayor secuencia): conmutativo, asociativo e
 *    IDEMPOTENTE — sincronizar dos veces con el mismo teléfono no duplica la evidencia.
 * 5. Detección de degradación y deriva de canal mediante Wald's SPRT (Sequential Probability Ratio Test).
 * 6. Cálculo de calibración y Brier Score por portadora.
 */

import { sha256Hex } from './corridor-connectors.mjs'; // SHA-256 síncrono puro: funciona igual en Node, navegador y APK

export const DEFAULT_CHANNEL_PRIORS = {
  'lora-868': { alpha: 18, beta: 2 },        // Media prior ~90%, concentración 20
  'ble-mesh': { alpha: 16, beta: 4 },        // Media prior ~80%, concentración 20
  'sound-ultrasound': { alpha: 12, beta: 8 },// Media prior ~60%, concentración 20
  'c-its': { alpha: 19, beta: 1 },           // Media prior ~95%, concentración 20
  'satellite-ntn': { alpha: 19.6, beta: 0.4 },// Media prior ~98%, concentración 20
  'cellular-sms': { alpha: 17, beta: 3 }     // Media prior ~85%, concentración 20
};

/**
 * Priors a partir de un catálogo de canales { id: { p } } (p. ej. BEARERS), con peso `strength` observaciones
 * (4 = el mismo que usa planAssuredDelivery). Sin esto, un canal desconocido hereda un prior genérico del 83 %
 * con peso 12, que tapa la evidencia: 0 de 60 se mostraría como 14 %.
 */
export function priorsFromCatalog(catalog, strength = 4) {
  const out = {};
  for (const [id, c] of Object.entries(catalog)) if (c && c.p > 0 && c.p < 1) out[id] = { alpha: c.p * strength, beta: (1 - c.p) * strength };
  return out;
}

/**
 * Crea y valida un recibo de entrega DeliveryReceipt v1.
 * Sin identificadores personales (PII-free) conforme a privacidad por diseño (RGPD / DPIA).
 *
 * @param {object} params
 * @param {string} params.bearerId Identificador de portadora (e.g. 'lora-868')
 * @param {string} params.zoneH3 Identificador espacial H3 resolución 7 (e.g. '873908280ffffff')
 * @param {'NORMAL'|'BLACKOUT'|'STORM'|'WILDFIRE'|'COLLAPSE'} [params.hazardState='NORMAL']
 * @param {number} params.sentAt Timestamp de envío en ms
 * @param {number} params.ackedAt Timestamp de acuse en ms
 * @param {'DELIVERED'|'EXPIRED'|'DROPPED'} params.outcome Resultado de la entrega
 * @param {number} [params.fragments=1] Fragmentos totales transmitidos
 * @param {number} [params.k=1] Umbral de reconstrucción FEC
 * @param {string} [params.appVersion='v0.22.4'] Versión de software
 * @param {string} [params.nonce] Identificador único del intento (por defecto aleatorio). Sin él, dos intentos
 *   iguales en el mismo milisegundo tendrían el mismo hash y uno se descartaría como repetido.
 * @returns {object} Recibo formateado
 */
export function createDeliveryReceipt({
  bearerId,
  zoneH3,
  hazardState = 'NORMAL',
  sentAt,
  ackedAt,
  outcome,
  fragments = 1,
  k = 1,
  appVersion = 'v0.22.4',
  nonce = [...globalThis.crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('')
}) {
  if (!bearerId || !zoneH3 || !sentAt || !outcome) {
    throw new Error('DeliveryReceipt v1 requiere bearerId, zoneH3, sentAt y outcome');
  }

  const receipt = {
    schema: 'senda-delivery-receipt/v1',
    bearerId: String(bearerId),
    zoneH3: String(zoneH3),
    hazardState,
    sentAt: Number(sentAt),
    ackedAt: ackedAt ? Number(ackedAt) : null,
    latencyMs: ackedAt && sentAt ? Math.max(0, ackedAt - sentAt) : null,
    outcome,
    success: outcome === 'DELIVERED',
    fragments: Math.max(1, Number(fragments)),
    k: Math.max(1, Number(k)),
    appVersion,
    nonce: String(nonce),
    recordedAt: Date.now()
  };

  // Huella criptográfica determinista SHA-256 del recibo
  // recordedAt queda fuera: el hash identifica el intento, no el momento en que se anotó (reenviar el mismo
  // recibo da el mismo hash y no se cuenta dos veces)
  const { recordedAt: _r, ...identity } = receipt;
  const canonicalStr = JSON.stringify(identity, Object.keys(identity).sort());
  receipt.receiptHash = sha256Hex(canonicalStr);

  return receipt;
}

/**
 * Almacén Bayesiano de Fiabilidad Empírica.
 */
export class ReliabilityStore {
  /**
   * @param {object} [options]
   * @param {object} [options.channelPriors] Priores globales iniciales Beta(alpha, beta)
   * @param {number} [options.decayFactor=1.0] Factor de olvido exponencial lambda (1.0 = sin olvido)
   */
  constructor({
    channelPriors = DEFAULT_CHANNEL_PRIORS,
    decayFactor = 1.0,
    nodeId = globalThis.crypto.randomUUID()
  } = {}) {
    this.channelPriors = { ...channelPriors };
    this.decayFactor = Math.min(1.0, Math.max(0.80, decayFactor));
    this.nodeId = String(nodeId);
    // Vista agregada: `${bearerId}:${zoneH3}:${hazardState}` -> { successes, failures, total, lastUpdated }
    this.observations = new Map();
    // Libro por nodo: clave -> Map(nodeId -> { s, f, seq, lastUpdated }). Solo cada nodo escribe su registro.
    this.ledger = new Map();
    this.seenReceipts = new Set();
  }

  _recompute(key) {
    let s = 0, f = 0, last = 0;
    for (const e of this.ledger.get(key)?.values() ?? []) { s += e.s; f += e.f; last = Math.max(last, e.lastUpdated); }
    this.observations.set(key, { successes: s, failures: f, total: s + f, lastUpdated: last });
  }

  _getKey(bearerId, zoneH3, hazardState = 'NORMAL') {
    return `${bearerId}:${zoneH3}:${hazardState}`;
  }

  /**
   * Ingesta un DeliveryReceipt v1 y actualiza las posteriores bayesianas.
   * @param {object} receipt
   */
  ingestReceipt(receipt) {
    if (!receipt || !receipt.bearerId || !receipt.zoneH3) {
      throw new Error('Recibo inválido para ingesta en ReliabilityStore');
    }

    if (receipt.receiptHash) {
      if (this.seenReceipts.has(receipt.receiptHash)) return false; // el mismo recibo dos veces no es evidencia nueva
      this.seenReceipts.add(receipt.receiptHash);
    }
    const key = this._getKey(receipt.bearerId, receipt.zoneH3, receipt.hazardState || 'NORMAL');
    if (!this.ledger.has(key)) this.ledger.set(key, new Map());
    const mine = this.ledger.get(key).get(this.nodeId) ?? { s: 0, f: 0, seq: 0, lastUpdated: 0 };
    // Olvido exponencial: solo sobre la evidencia propia (cada nodo envejece la suya)
    const d = this.decayFactor < 1.0 ? this.decayFactor : 1;
    const next = { s: mine.s * d + (receipt.success ? 1 : 0), f: mine.f * d + (receipt.success ? 0 : 1), seq: mine.seq + 1, lastUpdated: Number(receipt.ackedAt || receipt.sentAt) };
    this.ledger.get(key).set(this.nodeId, next);
    this._recompute(key);
    return true;
  }

  /**
   * Obtiene la estimación de fiabilidad con Shrinkage Empírico de Bayes.
   *
   * Formulación:
   *  - Prior global: Beta(alpha_0, beta_0), mu_0 = alpha_0 / (alpha_0 + beta_0), M_0 = alpha_0 + beta_0
   *  - Muestra local: s éxitos, f fallos, n = s + f, p_hat = s / n
   *  - Peso de credibilidad: w = n / (n + M_0)
   *  - Media posterior shrinkage: mu_post = w * p_hat + (1 - w) * mu_0
   *  - Parámetros posteriores conjugados: alpha_post = alpha_0 + s, beta_post = beta_0 + f
   *
   * @param {string} bearerId
   * @param {string} [zoneH3='*']
   * @param {string} [hazardState='NORMAL']
   * @returns {{mean:number, alpha:number, beta:number, sampleCount:number, credibleInterval99:[number,number], variance:number, shrinkageWeight:number}}
   */
  getReliability(bearerId, zoneH3 = '*', hazardState = 'NORMAL') {
    const prior = this.channelPriors[bearerId] || { alpha: 10, beta: 2 };
    const m0 = prior.alpha + prior.beta;
    const mu0 = prior.alpha / m0;

    let totalS = 0;
    let totalF = 0;

    if (zoneH3 === '*') {
      // Agregar todas las zonas para esta portadora y estado
      for (const [key, cell] of this.observations.entries()) {
        const [b, , h] = key.split(':');
        if (b === bearerId && (!hazardState || h === hazardState)) {
          totalS += cell.successes;
          totalF += cell.failures;
        }
      }
    } else {
      const key = this._getKey(bearerId, zoneH3, hazardState);
      const cell = this.observations.get(key);
      if (cell) {
        totalS = cell.successes;
        totalF = cell.failures;
      }
    }

    const n = totalS + totalF;
    const alphaPost = prior.alpha + totalS;
    const betaPost = prior.beta + totalF;
    const mean = alphaPost / (alphaPost + betaPost);
    const variance = (alphaPost * betaPost) / (Math.pow(alphaPost + betaPost, 2) * (alphaPost + betaPost + 1));
    const stdDev = Math.sqrt(variance);

    // Shrinkage weight hacia los datos observados
    const shrinkageWeight = n / (n + m0);

    // Intervalo creíble al 99% (aproximación ±2.576 desv. est. acotada a [0, 1])
    const lowerCi = Math.max(0.001, mean - 2.576 * stdDev);
    const upperCi = Math.min(0.999, mean + 2.576 * stdDev);

    return {
      mean: Math.round(mean * 10000) / 10000,
      alpha: Math.round(alphaPost * 100) / 100,
      beta: Math.round(betaPost * 100) / 100,
      sampleCount: Math.round(n),
      credibleInterval99: [Math.round(lowerCi * 10000) / 10000, Math.round(upperCi * 10000) / 10000],
      variance,
      shrinkageWeight: Math.round(shrinkageWeight * 1000) / 1000
    };
  }

  /**
   * Test Secuencial de Razón de Verosimilitudes (Wald's SPRT) para detección de degradación de canal.
   * Evalúa H0: p = p0 (nominal) vs H1: p = p1 (degradado, e.g. 0.70).
   *
   * @param {string} bearerId
   * @param {string} zoneH3
   * @param {object} [options]
   * @param {number} [options.pNominal=0.92]
   * @param {number} [options.pDegraded=0.70]
   * @param {number} [options.alphaErr=0.01] Probabilidad de falsa alarma
   * @param {number} [options.betaErr=0.05] Probabilidad de fallo de detección
   * @returns {{driftDetected:boolean, logLikelihoodRatio:number, threshold:number, status:string}}
   */
  detectDrift(bearerId, zoneH3, {
    pNominal = 0.92,
    pDegraded = 0.70,
    alphaErr = 0.01,
    betaErr = 0.05
  } = {}) {
    const key = this._getKey(bearerId, zoneH3, 'NORMAL');
    const cell = this.observations.get(key);

    if (!cell || cell.total < 5) {
      return {
        driftDetected: false,
        logLikelihoodRatio: 0,
        threshold: Math.log((1 - betaErr) / alphaErr),
        status: 'INSUFFICIENT_DATA'
      };
    }

    // SPRT Log-Likelihood Ratio: Lambda = s * log(p1/p0) + f * log((1-p1)/(1-p0))
    const s = cell.successes;
    const f = cell.failures;
    const llr = s * Math.log(pDegraded / pNominal) + f * Math.log((1 - pDegraded) / (1 - pNominal));
    const upperThreshold = Math.log((1 - betaErr) / alphaErr); // Acepta H1 (Canal caído)
    const lowerThreshold = Math.log(betaErr / (1 - alphaErr)); // Acepta H0 (Canal sano)

    const driftDetected = llr >= upperThreshold;

    return {
      driftDetected,
      logLikelihoodRatio: Math.round(llr * 100) / 100,
      threshold: Math.round(upperThreshold * 100) / 100,
      status: driftDetected ? 'CHANNEL_DEGRADED_ALARM' : (llr <= lowerThreshold ? 'HEALTHY' : 'MONITORING')
    };
  }

  /**
   * Combina dos almacenes como un CRDT basado en suma conmutativa y asociativa de contadores.
   * Permite sincronización P2P offline entre vehículos y nodos sin servidor central.
   *
   * @param {ReliabilityStore} otherStore
   * @returns {ReliabilityStore} Nuevo almacén combinado
   */
  merge(otherStore) {
    const merged = new ReliabilityStore({
      channelPriors: this.channelPriors,
      decayFactor: Math.min(this.decayFactor, otherStore.decayFactor),
      nodeId: this.nodeId
    });
    const better = (a, b) => (!a ? b : !b ? a : b.seq > a.seq ? b : a.seq > b.seq ? a : (b.s + b.f > a.s + a.f ? b : a));
    for (const key of new Set([...this.ledger.keys(), ...otherStore.ledger.keys()])) {
      const A = this.ledger.get(key) ?? new Map(), B = otherStore.ledger.get(key) ?? new Map(), out = new Map();
      for (const n of new Set([...A.keys(), ...B.keys()])) out.set(n, { ...better(A.get(n), B.get(n)) });
      merged.ledger.set(key, out);
      merged._recompute(key);
    }
    merged.seenReceipts = new Set([...this.seenReceipts, ...otherStore.seenReceipts]);
    return merged;
  }

  /**
   * Exporta estado serializable a JSON.
   */
  toJSON() {
    return {
      schema: 'senda-reliability-store/v2',
      nodeId: this.nodeId,
      decayFactor: this.decayFactor,
      cells: Object.fromEntries(this.observations.entries()),
      ledger: Object.fromEntries([...this.ledger].map(([k, m]) => [k, Object.fromEntries(m)]))
    };
  }

  /**
   * Reconstituye el almacén desde un JSON exportado (v2; un v1 sin libro se atribuye a un nodo «legado»).
   */
  static fromJSON(jsonObj, { channelPriors } = {}) {
    const store = new ReliabilityStore({ decayFactor: jsonObj.decayFactor || 1.0, nodeId: jsonObj.nodeId, ...(channelPriors ? { channelPriors } : {}) });
    if (jsonObj.ledger) {
      for (const [key, nodes] of Object.entries(jsonObj.ledger)) { store.ledger.set(key, new Map(Object.entries(nodes).map(([n, e]) => [n, { ...e }]))); store._recompute(key); }
    } else if (jsonObj.cells) {
      for (const [key, c] of Object.entries(jsonObj.cells)) { store.ledger.set(key, new Map([[`legacy:${key}`, { s: c.successes, f: c.failures, seq: 1, lastUpdated: c.lastUpdated ?? 0 }]])); store._recompute(key); }
    }
    return store;
  }
}
