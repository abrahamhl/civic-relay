/**
 * SENDA como CAPA CENTRALIZADORA: cualquier dispositivo que mueva bytes es un «portador»
 * (bearer). El teléfono, una pasarela de barrio o el vehículo de emergencias reparten los
 * fragmentos k-de-n (erasure.mjs) entre los portadores disponibles y calculan con exactitud
 * la probabilidad de entrega (distribución de Poisson-binomial agrupada).
 *
 * Restricciones legales reales:
 *  - Bandas de radioaficionado (APRS, QO-100): prohibido cifrar → solo mensajes públicos firmados.
 *  - ISM 868 MHz (LoRa/Meshtastic en la UE): ciclo de trabajo limitado (10 % en EU_868 según la guía de Meshtastic).
 * Los valores de éxito `p` son previos de planificación; en campo se sustituyen por lo medido.
 */
import { SHARD_HEADER, encodeShards, packShard } from './erasure.mjs';
import { b64, unb64 } from './b64.mjs';

export const BEARERS = Object.freeze({
  PHONE_MESH: { label: 'Teléfonos cercanos (Bluetooth / Wi-Fi Direct / sonido)', family: 'PROXIMITY', mtu: 4096, p: 0.6, latencyS: 600, costEUR: 0, encryptionAllowed: true, hardware: 'Ninguno', access: 'PUBLIC_PHONE', perWindow: 4, note: 'Cada encuentro con un vecino distinto es un intento independiente' },
  CELL_DATA: { label: 'Datos móviles (si queda antena)', family: 'TERRESTRIAL', mtu: 65536, p: 0.5, latencyS: 2, costEUR: 0, encryptionAllowed: true, hardware: 'Ninguno', access: 'PUBLIC_PHONE' },
  SMS: { label: 'SMS (2G/señal débil)', family: 'TERRESTRIAL', mtu: 116, text: true, p: 0.55, latencyS: 15, costEUR: 0, encryptionAllowed: true, hardware: 'Ninguno', access: 'PUBLIC_PHONE', perWindow: 3, note: '160 caracteres GSM-7 → 116 B en base64url tras el prefijo' },
  SAT_D2C_SMS: { label: 'Satélite directo al móvil (SMS)', family: 'SATELLITE', mtu: 116, text: true, p: 0.7, latencyS: 120, costEUR: 0, encryptionAllowed: true, hardware: 'Móvil + operador con servicio D2C', access: 'PUBLIC_PHONE', network: 'STARLINK_D2C', perWindow: 2 },
  MESHTASTIC: { label: 'LoRa Meshtastic (868 MHz)', family: 'LORA', mtu: 200, p: 0.75, latencyS: 30, costEUR: 0, encryptionAllowed: true, hardware: 'Nodo LoRa Meshtastic (ESP32/nRF52 + radio SX126x)', access: 'PUBLIC_ACCESSORY', note: 'Carga útil ≤ 233 B (DATA_PAYLOAD_LEN; 237 en versiones antiguas) → 200 B por prudencia; ciclo de trabajo UE 10 %', perWindow: 4 },
  IRIDIUM_SBD: { label: 'Iridium SBD (RockBLOCK)', family: 'SATELLITE', mtu: 340, p: 0.9, latencyS: 60, costEUR: 1.0, encryptionAllowed: true, hardware: 'RockBLOCK 9603 + antena con cielo despejado', access: 'PUBLIC_ACCESSORY', network: 'IRIDIUM_SBD', perWindow: 3, note: 'Subida 340 B; coste orientativo por mensaje completo (≈7 créditos si 1 crédito = 50 B)' },
  APRS: { label: 'APRS (radioaficionado, VHF/ISS)', family: 'AMATEUR', mtu: 46, text: true, p: 0.5, latencyS: 60, costEUR: 0, encryptionAllowed: false, hardware: 'Equipo VHF + TNC + licencia', access: 'AMATEUR_LICENSED', note: 'Texto ≤ 67 caracteres; prohibido cifrar' },
  QO100: { label: 'QO-100 geoestacionario (radioaficionado)', family: 'AMATEUR', mtu: 200, p: 0.85, latencyS: 30, costEUR: 0, encryptionAllowed: false, hardware: 'Transverter 2,4 GHz + parábola + LNB + licencia', access: 'AMATEUR_LICENSED', network: 'QO100' },
  DRONE_MULE: { label: 'Dron mula (recoge y entrega paquetes)', family: 'AERIAL', mtu: 1 << 20, p: 0.8, latencyS: 900, costEUR: 0, encryptionAllowed: true, hardware: 'Dron con ESP32/teléfono SENDA a bordo', access: 'GOVERNMENT' },
  RELAY_INTERNET: { label: 'Relé SENDA por Internet (satélite de banda ancha de un vecino)', family: 'BACKBONE', mtu: 1 << 20, p: 0.6, latencyS: 5, costEUR: 0, encryptionAllowed: true, hardware: 'Terminal satelital/fibra de un tercero', access: 'PUBLIC_ACCESSORY' },
});

/* ---------------- probabilidad exacta ---------------- */
/**
 * Probabilidad de recibir ≥k fragmentos cuando el portador i envía m_i mensajes independientes
 * (éxito p_i cada uno) que llevan q_i fragmentos cada uno. DP sobre la suma (Poisson-binomial agrupada).
 */
export function deliveryProbability(groups, k) {
  let dist = [1];
  for (const { p, shards } of groups) {
    const next = new Array(dist.length + shards).fill(0);
    for (let s = 0; s < dist.length; s++) { if (!dist[s]) continue; next[s] += dist[s] * (1 - p); next[s + shards] += dist[s] * p; }
    dist = next;
  }
  return dist.reduce((acc, v, s) => (s >= k ? acc + v : acc), 0);
}

/**
 * Plan multiportador: elige tamaño de fragmento, k, n y reparto para alcanzar `target` con el
 * menor coste y, a igualdad, la menor latencia. `available`: [{id, p?, messages?}].
 * `publicCleartext`: true si el mensaje es un estado público firmado (puede ir por bandas de aficionado).
 */
export function planMultiBearer(lengthBytes, available, { target = 0.99, publicCleartext = false, maxShards = 60 } = {}) {
  const usable = available.map((a) => ({ id: a.id, ...BEARERS[a.id], p: a.p ?? BEARERS[a.id]?.p, messages: a.messages ?? BEARERS[a.id]?.perWindow ?? 1 }))
    .filter((b) => b.label && (b.encryptionAllowed || publicCleartext));
  const excluded = available.filter((a) => BEARERS[a.id] && !BEARERS[a.id].encryptionAllowed && !publicCleartext).map((a) => ({ id: a.id, reason: 'Banda de radioaficionado: no admite contenido cifrado' }));
  if (!usable.length) return { feasible: false, reason: 'NO_BEARER', excluded };
  const sizes = [...new Set(usable.map((b) => Math.min(b.mtu, 4096) - SHARD_HEADER).filter((s) => s > 8))].sort((a, b) => a - b);
  let best = null;
  for (const s of sizes) {
    const k = Math.ceil(lengthBytes / s);
    if (k > maxShards) continue;
    // Huecos: cada mensaje de cada portador admite hasta q fragmentos (su fallo arrastra a todos).
    const slots = [];
    for (const b of usable) { const q = Math.floor(b.mtu / (s + SHARD_HEADER)); if (q < 1) continue; for (let m = 0; m < b.messages; m++) slots.push({ id: b.id, p: b.p, cap: q, shards: 0, latencyS: b.latencyS, costEUR: b.costEUR }); }
    // Asignación voraz fragmento a fragmento: el que más sube la probabilidad por euro.
    let n = 0, P = 0;
    const prob = () => deliveryProbability(slots.filter((g) => g.shards > 0), k);
    while (n < 255) {
      let bestSlot = null, bestScore = -1, bestP = P;
      for (const g of slots) {
        if (g.shards >= g.cap) continue;
        g.shards++; const p = n + 1 >= k ? prob() : (n + 1) / k; g.shards--;
        const extraCost = g.shards === 0 ? g.costEUR : 0;
        const score = (p - P + 1e-9) / (1 + extraCost) - g.latencyS * 1e-9;
        if (score > bestScore) { bestScore = score; bestSlot = g; bestP = p; }
      }
      if (!bestSlot) break;
      bestSlot.shards++; n++; P = bestP;
      if (n >= k && P >= target) break;
    }
    const chosen = slots.filter((g) => g.shards > 0);
    if (n < k) continue;
    const pDelivery = deliveryProbability(chosen, k);
    const costEUR = chosen.reduce((a, g) => a + g.costEUR, 0);
    const etaS = etaForTarget(chosen, k, target);
    const cand = { feasible: pDelivery >= target, shardSize: s, k, n, pDelivery, costEUR, etaS, messages: chosen.map(({ id, shards, p, latencyS }) => ({ id, shards, p, latencyS })) };
    const better = (a, b) => (a.feasible !== b.feasible ? a.feasible : a.feasible ? (Math.abs(a.costEUR - b.costEUR) > 1e-9 ? a.costEUR < b.costEUR : a.etaS !== b.etaS ? a.etaS < b.etaS : a.pDelivery > b.pDelivery) : a.pDelivery > b.pDelivery);
    if (!best || better(cand, best)) best = cand;
  }
  if (!best) return { feasible: false, reason: 'TOO_LARGE', excluded };
  const single = usable.map((b) => ({ id: b.id, p: b.mtu >= lengthBytes ? b.p : 0 })).sort((a, b) => b.p - a.p)[0];
  return { ...best, excluded, bestSingleBearer: single, gainOverSingle: +(best.pDelivery - single.p).toFixed(4) };
}

/** Tiempo mínimo en el que la probabilidad de tener k fragmentos supera el objetivo. */
export function etaForTarget(groups, k, target) {
  const ts = [...new Set(groups.map((g) => g.latencyS))].sort((a, b) => a - b);
  for (const t of ts) if (deliveryProbability(groups.filter((g) => g.latencyS <= t), k) >= target) return t;
  return Infinity;
}

/* ---------------- adaptadores de trama por portador ---------------- */
export const TEXT_PREFIX = 'SND1 ';
/** Un fragmento empaquetado → lo que realmente se transmite por ese portador (bytes o texto). */
export function toBearerFrame(bearerId, shardBytes) {
  const b = BEARERS[bearerId]; if (!b) throw new Error(`Portador desconocido: ${bearerId}`);
  if (shardBytes.length > b.mtu) throw new Error(`${bearerId}: ${shardBytes.length} B > MTU ${b.mtu}`);
  if (!b.text) return shardBytes;
  const t = TEXT_PREFIX + b64(shardBytes);
  if (bearerId === 'APRS' && t.length > 67) throw new Error('APRS: más de 67 caracteres');
  if ((bearerId === 'SMS' || bearerId === 'SAT_D2C_SMS') && t.length > 160) throw new Error('SMS: más de 160 caracteres');
  return t;
}
export function fromBearerFrame(frame) {
  if (typeof frame !== 'string') return frame;
  const i = frame.indexOf(TEXT_PREFIX); if (i < 0) return null;
  return unb64(frame.slice(i + TEXT_PREFIX.length).trim().split(/\s/)[0]);
}

/** Ejecuta un plan: devuelve las tramas listas para cada portador (texto o binario). */
export function shardForPlan(bytes, plan, id = globalThis.crypto.getRandomValues(new Uint8Array(8))) {
  const enc = encodeShards(bytes, plan.k, plan.n);
  const out = []; let idx = 0;
  for (const m of plan.messages) {
    const parts = [];
    for (let j = 0; j < m.shards && idx < plan.n; j++, idx++) parts.push(packShard({ id, k: plan.k, n: plan.n, len: bytes.length, index: idx, data: enc.shards[idx] }));
    // Varios fragmentos en un mismo mensaje: se concatenan (cada uno lleva su cabecera y tamaño fijo).
    const joined = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { joined.set(p, o); o += p.length; }
    out.push({ bearer: m.id, frame: toBearerFrame(m.id, joined), shardCount: parts.length });
  }
  return out;
}

/** Separa un mensaje recibido que contiene uno o varios fragmentos concatenados (el tamaño sale de la cabecera). */
export function splitShards(bytes) {
  if (bytes.length < SHARD_HEADER) return [];
  const k = bytes[3], len = (bytes[14] << 8) | bytes[15], shardSize = Math.max(1, Math.ceil(len / k));
  const step = SHARD_HEADER + shardSize, out = [];
  for (let o = 0; o + step <= bytes.length; o += step) out.push(bytes.subarray(o, o + step));
  return out;
}
