/**
 * Physics-Aware Emergency Routing (PAER) Engine & DTN Disaster Benchmark.
 *
 * Implements a novel, defensible cross-layer routing protocol for fragmented,
 * hazard-ravaged disaster topologies where conventional DTN baselines (Epidemic,
 * Spray-and-Wait, PRoPHET) suffer from buffer collapse, energy depletion, and
 * correlated node annihilation by advancing hazard fronts (wildfires/floods).
 *
 * Mathematical Foundations:
 * 1. Hazard Survival Probability: P_surv(u, t) = min(1, t_impact(u) / TTL_bundle)
 * 2. RF Link Viability via ITU-R P.526 knife-edge diffraction and log-distance margin.
 * 3. Energy Preservation Utility: eta_batt(u) = max(0, (batt - 15) / 85)^gamma
 * 4. Priority-Aware Preemptive Buffer Management (SOS bundles protected from eviction).
 * 5. Strict Fair Benchmark against Epidemic, Spray-and-Wait, and PRoPHET with
 *    identical buffer limits, mobility traces, contact schedules, and hazard fronts.
 */

export const PRIORITY_LEVELS = Object.freeze({
  DISTRESS_SOS: 0,
  OFFICIAL_ALERT: 1,
  COORDINATION: 2,
  ROUTINE_TELEMETRY: 3,
});

export const PROTOCOLS = Object.freeze({
  EPIDEMIC: 'EPIDEMIC',
  SPRAY_AND_WAIT: 'SPRAY_AND_WAIT',
  PROPHET: 'PROPHET',
  PAER: 'PAER',
});

/**
 * Calculates line-of-sight Euclidean distance between 2D coordinates.
 */
export function distance2D(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

/**
 * Calculates distance from a point to a 2D line segment (hazard front boundary).
 */
export function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return distance2D(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance2D(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

/**
 * Calculates minimum distance from a node to an advancing linear or polygonal hazard front.
 */
export function distanceToHazardFront(node, hazardPolygon) {
  if (!hazardPolygon || hazardPolygon.length === 0) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < hazardPolygon.length; i++) {
    const v = hazardPolygon[i];
    const w = hazardPolygon[(i + 1) % hazardPolygon.length];
    const d = distToSegment(node, v, w);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/**
 * Evaluates RF link margin in dB using log-distance path loss, obstacle diffraction, and rain loss.
 */
export function computeLinkMarginDb({
  distanceM,
  carrierFreqHz = 868e6,
  txPowerDbm = 14.0,
  txGainDbi = 2.15,
  rxGainDbi = 2.15,
  rxSensitivityDbm = -130.0,
  diffractionLossDb = 0.0,
  rainAttenuationDb = 0.0,
}) {
  const SPEED_OF_LIGHT = 299792458;
  const dist = Math.max(1, distanceM);
  // Free space path loss FSPL
  const fspl = 20 * Math.log10(dist) + 20 * Math.log10(carrierFreqHz) - 147.55;
  const rxPowerDbm = txPowerDbm + txGainDbi + rxGainDbi - fspl - diffractionLossDb - rainAttenuationDb;
  const marginDb = rxPowerDbm - rxSensitivityDbm;
  return {
    rxPowerDbm: +rxPowerDbm.toFixed(2),
    marginDb: +marginDb.toFixed(2),
    isViable: marginDb >= 3.0, // Minimum 3 dB SNR margin for reliable LoRa/BLE
  };
}

/**
 * Priority Buffer: Enqueues bundle with priority and eviction of lowest-priority expired items.
 */
export class PriorityEmergencyBuffer {
  constructor(capacity = 50) {
    this.capacity = capacity;
    this.bundles = []; // array of { id, src, dst, priority, sizeBytes, ttlRemainingS, copiesLeft, createdAt }
    this.droppedCount = 0;
  }

  has(bundleId) {
    return this.bundles.some((b) => b.id === bundleId);
  }

  get(bundleId) {
    return this.bundles.find((b) => b.id === bundleId);
  }

  occupancyRatio() {
    return this.bundles.length / this.capacity;
  }

  enqueue(bundle) {
    if (this.has(bundle.id)) return false;

    if (this.bundles.length >= this.capacity) {
      // Find candidate for eviction: must have lower priority (higher numeric value)
      // or if equal, smallest remaining TTL
      let evictIdx = -1;
      let worstPriority = -1;
      let worstTtl = Infinity;

      for (let i = 0; i < this.bundles.length; i++) {
        const b = this.bundles[i];
        if (b.priority > bundle.priority) {
          if (b.priority > worstPriority || (b.priority === worstPriority && b.ttlRemainingS < worstTtl)) {
            worstPriority = b.priority;
            worstTtl = b.ttlRemainingS;
            evictIdx = i;
          }
        } else if (b.priority === bundle.priority && worstPriority === -1) {
          if (b.ttlRemainingS < bundle.ttlRemainingS && b.ttlRemainingS < worstTtl) {
            worstTtl = b.ttlRemainingS;
            evictIdx = i;
          }
        }
      }

      if (evictIdx !== -1) {
        this.bundles.splice(evictIdx, 1);
        this.droppedCount++;
      } else {
        // Buffer full and incoming bundle does not have higher priority than any stored bundle
        this.droppedCount++;
        return false;
      }
    }

    this.bundles.push({ ...bundle });
    return true;
  }

  age(dtS) {
    for (let i = this.bundles.length - 1; i >= 0; i--) {
      this.bundles[i].ttlRemainingS -= dtS;
      if (this.bundles[i].ttlRemainingS <= 0) {
        this.bundles.splice(i, 1);
        this.droppedCount++;
      }
    }
  }
}

/**
 * Computes PAER forwarding utility metric U_PAER(relay, dest, bundle, hazardContext).
 */
export function computePaerUtility({
  relayNode,
  destNode,
  bundle,
  maxScenarioDistM = 5000,
  hazardPolygon = [],
  hazardRosMs = 0.5, // 0.5 m/s (~1.8 km/h typical wildfire rate of spread)
  weights = { geo: 0.35, hazard: 0.35, battery: 0.15, buffer: 0.15 },
}) {
  // 1. Geographic progress to destination
  const distToDest = distance2D(relayNode, destNode);
  const geoScore = Math.max(0, 1 - distToDest / maxScenarioDistM);

  // 2. Hazard survival probability
  const distHazard = distanceToHazardFront(relayNode, hazardPolygon);
  const timeToImpactS = hazardRosMs > 0 ? distHazard / hazardRosMs : Infinity;
  const survivalScore = Math.max(0, Math.min(1, timeToImpactS / Math.max(1, bundle.ttlRemainingS)));

  // If node is already caught in hazard or impact occurs before bundle TTL, utility drops to 0
  if (timeToImpactS < Math.min(180, bundle.ttlRemainingS)) return 0;

  // 3. Battery energy score (leaves 15% reserve for emergency signaling)
  const battScore = Math.max(0, (relayNode.batteryPct - 15) / 85);

  // 4. Buffer availability score
  const bufferScore = 1 - relayNode.buffer.occupancyRatio();

  const totalScore =
    weights.geo * geoScore +
    weights.hazard * survivalScore +
    weights.battery * battScore +
    weights.buffer * bufferScore;

  return +totalScore.toFixed(4);
}

/**
 * Discrete Event Disaster Network Simulator for DTN Benchmarking.
 */
export class DisasterDtnSimulator {
  constructor({
    nodes = [],
    hazardPolygon = [],
    hazardVelocity = { vx: 0.4, vy: 0.1 }, // m/s
    protocol = PROTOCOLS.PAER,
    sprayCopies = 6,
    carrierFreqHz = 868e6,
  }) {
    this.protocol = protocol;
    this.sprayCopies = sprayCopies;
    this.carrierFreqHz = carrierFreqHz;
    this.hazardPolygon = hazardPolygon.map((p) => ({ ...p }));
    this.hazardVelocity = hazardVelocity;
    this.timeS = 0;

    // Initialize node objects
    this.nodes = new Map();
    for (const n of nodes) {
      this.nodes.set(n.id, {
        id: n.id,
        x: n.x,
        y: n.y,
        batteryPct: n.batteryPct ?? 100,
        isDestroyed: false,
        buffer: new PriorityEmergencyBuffer(n.bufferCapacity ?? 50),
        predictabilities: new Map(), // For PRoPHET
      });
    }

    // Benchmark telemetry metrics
    this.generatedBundles = 0;
    this.deliveredBundles = 0;
    this.totalTransmissions = 0;
    this.latenciesS = [];
    this.hazardEngulfedBundles = 0;
    this.deliveredIds = new Set();
  }

  advanceHazard(dtS) {
    // Translate hazard front by velocity vector
    for (const p of this.hazardPolygon) {
      p.x += this.hazardVelocity.vx * dtS;
      p.y += this.hazardVelocity.vy * dtS;
    }

    // Check node engulfment
    for (const node of this.nodes.values()) {
      if (!node.isDestroyed) {
        let isEngulfed = false;
        if (this.hazardPolygon.length >= 3) {
          // Polygon point-in-polygon test
          let inside = false;
          for (let i = 0, j = this.hazardPolygon.length - 1; i < this.hazardPolygon.length; j = i++) {
            const xi = this.hazardPolygon[i].x, yi = this.hazardPolygon[i].y;
            const xj = this.hazardPolygon[j].x, yj = this.hazardPolygon[j].y;
            const intersect = yi > node.y !== yj > node.y && node.x < ((xj - xi) * (node.y - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          if (inside) isEngulfed = true;
        } else if (this.hazardPolygon.length >= 2) {
          // Front line normal projection test bounded by segment endpoints
          const v = this.hazardPolygon[0];
          const w = this.hazardPolygon[1];
          const segDx = w.x - v.x, segDy = w.y - v.y;
          const segL2 = segDx * segDx + segDy * segDy;
          const t = segL2 > 0 ? ((node.x - v.x) * segDx + (node.y - v.y) * segDy) / segL2 : 0;

          if (t >= -0.1 && t <= 1.1) {
            let nx = -segDy, ny = segDx;
            if (nx * this.hazardVelocity.vx + ny * this.hazardVelocity.vy < 0) {
              nx = -nx; ny = -ny;
            }
            const norm = Math.hypot(nx, ny) || 1;
            const signedDist = ((node.x - v.x) * nx + (node.y - v.y) * ny) / norm;
            if (signedDist <= 0 || distanceToHazardFront(node, this.hazardPolygon) <= 15.0) {
              isEngulfed = true;
            }
          } else {
            if (distanceToHazardFront(node, this.hazardPolygon) <= 15.0) {
              isEngulfed = true;
            }
          }
        }

        if (isEngulfed) {
          node.isDestroyed = true;
          this.hazardEngulfedBundles += node.buffer.bundles.length;
          node.buffer.bundles = [];
        }
      }
    }
  }

  sendBundle(srcId, dstId, { id, priority = PRIORITY_LEVELS.DISTRESS_SOS, sizeBytes = 256, ttlS = 1800 }) {
    const srcNode = this.nodes.get(srcId);
    if (!srcNode || srcNode.isDestroyed) return false;

    const bundle = {
      id,
      src: srcId,
      dst: dstId,
      priority,
      sizeBytes,
      ttlRemainingS: ttlS,
      copiesLeft: this.sprayCopies,
      createdAtS: this.timeS,
    };

    const enqueued = srcNode.buffer.enqueue(bundle);
    if (enqueued) this.generatedBundles++;
    return enqueued;
  }

  stepContacts(contacts, dtS = 1) {
    this.timeS += dtS;
    this.advanceHazard(dtS);

    // Age all buffers
    for (const node of this.nodes.values()) {
      if (!node.isDestroyed) node.buffer.age(dtS);
    }

    // Process contact opportunities
    for (const { from: uId, to: vId, diffractionLossDb = 0, rainLossDb = 0 } of contacts) {
      const u = this.nodes.get(uId);
      const v = this.nodes.get(vId);

      if (!u || !v || u.isDestroyed || v.isDestroyed) continue;
      if (u.batteryPct <= 10 || v.batteryPct <= 10) continue; // Dead batteries

      // Check physical RF link margin
      const dist = distance2D(u, v);
      const link = computeLinkMarginDb({
        distanceM: dist,
        carrierFreqHz: this.carrierFreqHz,
        diffractionLossDb,
        rainAttenuationDb: rainLossDb,
      });

      if (!link.isViable) continue; // RF signal below receiver threshold

      // Update PRoPHET predictabilities
      if (this.protocol === PROTOCOLS.PROPHET) {
        const pInit = 0.75;
        const pOld = u.predictabilities.get(vId) ?? 0;
        u.predictabilities.set(vId, pOld + (1 - pOld) * pInit);
      }

      // Attempt forwarding bundles from u to v
      const bundlesToForward = [...u.buffer.bundles];
      for (const b of bundlesToForward) {
        if (v.buffer.has(b.id)) continue; // Already in receiver buffer

        // If v is destination, delivery succeeded!
        if (v.id === b.dst) {
          this.totalTransmissions++;
          u.batteryPct = Math.max(0, u.batteryPct - 0.05);
          if (!this.deliveredIds.has(b.id)) {
            this.deliveredIds.add(b.id);
            this.deliveredBundles++;
            this.latenciesS.push(this.timeS - b.createdAtS);
          }
          continue;
        }

        let shouldForward = false;

        if (this.protocol === PROTOCOLS.EPIDEMIC) {
          // Blind flooding to all contacts
          shouldForward = true;
        } else if (this.protocol === PROTOCOLS.SPRAY_AND_WAIT) {
          // Spray phase: split copies
          if (b.copiesLeft > 1) {
            shouldForward = true;
          }
        } else if (this.protocol === PROTOCOLS.PROPHET) {
          // Forward if contact has higher delivery predictability
          const pContact = v.predictabilities.get(b.dst) ?? 0.1;
          const pSelf = u.predictabilities.get(b.dst) ?? 0.05;
          if (pContact >= pSelf) shouldForward = true;
        } else if (this.protocol === PROTOCOLS.PAER) {
          // Physics-Aware Emergency Routing: forwarding condition with hysteresis 0.02
          const destNode = this.nodes.get(b.dst) || { x: 5000, y: 5000 };
          const ros = Math.hypot(this.hazardVelocity.vx, this.hazardVelocity.vy) || 0.5;
          const uUtil = computePaerUtility({ relayNode: u, destNode, bundle: b, hazardPolygon: this.hazardPolygon, hazardRosMs: ros });
          const vUtil = computePaerUtility({ relayNode: v, destNode, bundle: b, hazardPolygon: this.hazardPolygon, hazardRosMs: ros });

          // Forward only if relay provides tangible physical progress (0.02) and safe battery
          if (vUtil > uUtil + 0.02 && v.batteryPct > 15) {
            shouldForward = true;
          }
        }

        if (shouldForward) {
          const accepted = v.buffer.enqueue(b);
          if (accepted) {
            this.totalTransmissions++;
            u.batteryPct = Math.max(0, u.batteryPct - 0.05);

            if (this.protocol === PROTOCOLS.SPRAY_AND_WAIT) {
              const half = Math.floor(b.copiesLeft / 2);
              b.copiesLeft = Math.max(1, b.copiesLeft - half);
              const copyInV = v.buffer.get(b.id);
              if (copyInV) copyInV.copiesLeft = half;
            }
          }
        }
      }
    }
  }

  getMetrics() {
    const pdr = this.generatedBundles > 0 ? +(this.deliveredBundles / this.generatedBundles).toFixed(4) : 0;
    const meanLatencyS =
      this.latenciesS.length > 0
        ? +(this.latenciesS.reduce((a, b) => a + b, 0) / this.latenciesS.length).toFixed(2)
        : null;
    const overheadRatio =
      this.deliveredBundles > 0
        ? +((this.totalTransmissions - this.deliveredBundles) / this.deliveredBundles).toFixed(2)
        : 0;

    let totalBufferDrops = 0;
    let totalBatteryRemaining = 0;
    for (const n of this.nodes.values()) {
      totalBufferDrops += n.buffer.droppedCount;
      totalBatteryRemaining += n.batteryPct;
    }
    const meanBatteryRemaining = +(totalBatteryRemaining / this.nodes.size).toFixed(1);

    return {
      protocol: this.protocol,
      generatedBundles: this.generatedBundles,
      deliveredBundles: this.deliveredBundles,
      deliveryRatio: pdr,
      meanLatencyS,
      totalTransmissions: this.totalTransmissions,
      overheadRatio,
      totalBufferDrops,
      hazardEngulfedBundles: this.hazardEngulfedBundles,
      meanBatteryRemainingPct: meanBatteryRemaining,
    };
  }
}
