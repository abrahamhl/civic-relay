/** SENDA model-only authorization and reachability gate.
 * No radio is transmitted, controlled or measured. No ACK is generated.
 * A graph path NEVER demonstrates physical delivery.
 */
export function assessModelRoute({ nodes, links, source, destination, maxHops = 12 }) {
  if (!Array.isArray(nodes) || !Array.isArray(links) ||
      !Number.isSafeInteger(maxHops) || maxHops < 1 || maxHops > 64) {
    throw new TypeError('Invalid topology or maxHops');
  }
  const byId = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id || byId.has(node.id)) {
      throw new TypeError('Invalid or duplicate node id');
    }
    byId.set(node.id, node);
  }
  const result = (modelReachable, reason, path) => Object.freeze({
    modelReachable, reason, path: Object.freeze(path),
    evidenceLevel: 'SYNTHETIC_MODEL_ONLY',
    physicalDeliveryVerified: false, recipientAcknowledged: false, operationallySafe: false
  });
  if (!byId.has(source) || !byId.has(destination)) return result(false, 'UNKNOWN_ENDPOINT', []);
  if (source === destination) return result(false, 'SAME_ENDPOINT_NOT_DELIVERY', []);
  // Unknown or misspelled roles must not silently become active repeaters.
  const ACTIVE_ROLES = new Set(['SENDER', 'RECEIVER', 'RELAY']);
  const usable = node => node && node.consent === true && node.powered === true &&
    node.radioEnabled === true && ACTIVE_ROLES.has(node.role);
  if (!usable(byId.get(source)) || !usable(byId.get(destination))) {
    return result(false, 'ENDPOINT_NOT_AUTHORIZED_OR_UNAVAILABLE', []);
  }
  const adjacency = new Map([...byId.keys()].map(id => [id, []]));
  for (const link of links) {
    if (!link || !byId.has(link.from) || !byId.has(link.to)) continue;
    // Passive reflections and RF observations cannot act as transport hops.
    if (link.kind !== 'ACTIVE_RADIO' || link.authorized !== true ||
        link.enabled !== true || link.dutyCycleAllowed !== true) continue;
    if (!usable(byId.get(link.from)) || !usable(byId.get(link.to))) continue;
    adjacency.get(link.from).push(link.to);
  }
  for (const adjacent of adjacency.values()) adjacent.sort();
  const queue = [[source]], seen = new Set([source]);
  while (queue.length) {
    const path = queue.shift();
    if (path.length - 1 >= maxHops) continue;
    for (const next of adjacency.get(path[path.length - 1])) {
      if (seen.has(next)) continue;
      const nextPath = [...path, next];
      if (next === destination) return result(true, 'MODEL_PATH_FOUND_NOT_DELIVERED', nextPath);
      seen.add(next); queue.push(nextPath);
    }
  }
  return result(false, 'NO_AUTHORIZED_ACTIVE_PATH', []);
}
