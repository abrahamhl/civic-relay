import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/stranger-gateway.mjs';
import { generateIdentity, sealMessage, packEnvelope, unpackEnvelope, openMessage } from '../src/envelope.mjs';

const subtle = globalThis.crypto.subtle;
const POLICY = { consent: true, acceptSOS: true, acceptPersonal: true, maxKBPerHour: 64, minBatteryPct: 20, maxBlobBytes: 4096, baseBits: 6, sosBits: 2, bytesPerExtraBit: 1024 };
const ecdh = async () => { const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { privateKey: kp.privateKey, publicJwk: await subtle.exportKey('jwk', kp.publicKey) }; };
const contains = (hay, needle) => { outer: for (let i = 0; i + needle.length <= hay.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return true; } return false; };

test('baliza de 18 B: ida y vuelta, cabe en un anuncio BLE legacy y el identificador rota', async () => {
  const secret = new Uint8Array(32).fill(7);
  const e1 = await G.ephemeralId(secret, 100), e2 = await G.ephemeralId(secret, 101);
  assert.notDeepEqual(e1, e2, 'el identificador cambia en cada ranura: no se puede seguir a quien presta su conexión');
  const b = G.encodeBeacon({ ephId: e1, slot: 100, uplink: 'CELL', quality: 11, batteryPct: 63, quotaKB: 512, accepts: { sos: true, personal: false, fetch: true } });
  assert.equal(b.length, G.BEACON_BYTES); assert.ok(b.length <= 31 - 3 - 4);
  const d = G.decodeBeacon(b);
  assert.deepEqual({ ...d, ephId: undefined }, { accepts: { sos: true, personal: false, fetch: true }, uplink: 'CELL', quality: 11, batteryPct: 63, quotaKB: 512, slot: 100, ephId: undefined });
  assert.equal(G.decodeBeacon(new Uint8Array(5)), null);
});

test('buzón cegado: las dos personas lo calculan igual, rota cada día y distingue destinatarios', async () => {
  const a = await ecdh(), b = await ecdh();
  const sa = await G.deriveMailboxSecret(a.privateKey, a.publicJwk, b.publicJwk), sb = await G.deriveMailboxSecret(b.privateKey, b.publicJwk, a.publicJwk);
  assert.deepEqual(sa, sb);
  const m1 = await G.mailboxId(sa, 'hermano', 20412), m2 = await G.mailboxId(sa, 'hermano', 20413), m3 = await G.mailboxId(sa, 'yo', 20412);
  assert.equal(m1.length, 32); assert.notEqual(m1, m2); assert.notEqual(m1, m3);
  assert.equal(G.dayIndexOf(Date.UTC(2026, 10, 20, 23, 59)), G.dayIndexOf(Date.UTC(2026, 10, 20, 0, 0)));
});

test('sello de trabajo: cuesta ~2^bits a quien pide, 1 hash a la pasarela, y está ligado a ESA pasarela y ranura', () => {
  const d = G.blobDigest(new Uint8Array([1, 2, 3]));
  const s = G.mintStamp(d, 'aa'.repeat(8), 5, 8);
  assert.ok(G.verifyStamp(d, 'aa'.repeat(8), 5, 8, s.nonce));
  assert.ok(!G.verifyStamp(d, 'bb'.repeat(8), 5, 8, s.nonce) || s.nonce === 0, 'otro identificador de pasarela invalida el sello (salvo coincidencia trivial)');
  // media de intentos ≈ 2^bits (ley geométrica): 200 sellos de 6 bits → media cercana a 64
  let tries = 0; for (let i = 0; i < 200; i++) tries += G.mintStamp(G.blobDigest(new Uint8Array([i, i >> 8])), 'cc'.repeat(8), 1, 6).tries;
  const mean = tries / 200; assert.ok(mean > 40 && mean < 95, `media ${mean}`);
  assert.equal(G.stampBits(POLICY, { bytes: 3000, sos: false }), 6 + 3);
  assert.equal(G.stampBits(POLICY, { bytes: 3000, sos: true }), 2);
  assert.throws(() => G.stampBits({ baseBits: 6 }, { bytes: 1, sos: false }), /declararse/);
});

test('sin consentimiento no hay pasarela; sin parámetros declarados no hay política', async () => {
  assert.equal(G.createGatewayPolicy({ consent: false }).consent, false);
  assert.throws(() => G.createGatewayPolicy({ consent: true }), /declararse/);
  const off = await G.createStrangerGateway({ policy: G.createGatewayPolicy({}), uplinkKind: 'CELL', quality: 9, slotSeconds: 900, uplink: async () => true });
  assert.equal(off.active, false); assert.equal(await off.beacon(0, 90), null);
});

test('DE PUNTA A PUNTA: mi hermano sin datos → dos desconocidos con datos → buzón → yo lo abro; nadie en medio lo lee', async () => {
  const now = Date.UTC(2026, 10, 20, 12, 0, 0), day = G.dayIndexOf(now);
  const yo = await generateIdentity(), hermano = await generateIdentity();
  const pa = await ecdh(), pb = await ecdh();
  const sHermano = await G.deriveMailboxSecret(pb.privateKey, pb.publicJwk, pa.publicJwk);
  const sYo = await G.deriveMailboxSecret(pa.privateKey, pa.publicJwk, pb.publicJwk);

  // 1. El hermano escribe; el sobre E2E va firmado y cifrado para mí, y luego dentro del sobre exterior.
  const texto = 'Estoy bien. Sin cobertura en el pueblo. Mañana bajo a Arnhem.';
  const env = await sealMessage({ sender: hermano, recipient: yo.publicIdentity, body: texto, priority: 5, ttlS: 86400, now });
  const inner = packEnvelope(env);
  const mbox = await G.mailboxId(sHermano, yo.publicIdentity.fingerprint, day);
  const blob = await G.sealOuter(sHermano, mbox, inner);
  const pieces = G.splitForGateways(blob, 2, 4); // k = 2 de n = 4: basta con dos fragmentos cualesquiera

  // 2. Servidor de buzones en memoria (en la realidad: relé SENDA, correo o relé público, varios a la vez).
  const server = new Map();
  const upload = async (m, b) => { server.set(m, [...(server.get(m) ?? []), b]); return true; };
  const g1 = await G.createStrangerGateway({ policy: G.createGatewayPolicy(POLICY), uplinkKind: 'CELL', quality: 10, slotSeconds: 900, uplink: upload });
  const g2 = await G.createStrangerGateway({ policy: G.createGatewayPolicy(POLICY), uplinkKind: 'WIFI', quality: 13, slotSeconds: 900, uplink: upload });
  const g3 = await G.createStrangerGateway({ policy: G.createGatewayPolicy(POLICY), uplinkKind: 'CELL', quality: 6, slotSeconds: 900, uplink: upload });
  assert.equal(await g3.beacon(now, 10), null, 'con batería por debajo de su mínimo, la pasarela no se anuncia');

  // 3. El móvil del hermano oye dos balizas y entrega fragmentos DISTINTOS a cada una.
  const receipts = [];
  for (const [g, idx] of [[g1, [0, 1]], [g2, [2, 3]]]) {
    const beacon = G.decodeBeacon(await g.beacon(now, 80));
    for (const i of idx) {
      const bits = G.stampBits(POLICY, { bytes: pieces[i].length, sos: false });
      const req = G.prepareHandoff({ mbox, blob: pieces[i], sos: false, beacon, policyBits: bits });
      const r = await g.offer(req, now, 80);
      assert.equal(r.accepted, true, r.reason);
      assert.ok(await G.verifyCustodyReceipt(r.receipt, pieces[i]), 'recibo de custodia válido (el «✓»)');
      receipts.push(r.receipt);
    }
  }
  assert.equal(receipts.length, 4);
  // Lo que vio cada pasarela: ni el texto, ni la huella del destinatario, ni la cabecera del sobre interior.
  for (const p of pieces) {
    assert.ok(!contains(p, new TextEncoder().encode('Estoy bien')));
    assert.ok(!contains(p, inner.subarray(17, 33)), 'la huella del destinatario no aparece en claro');
  }

  // 4. Yo recojo con señuelos, junto dos fragmentos cualesquiera y abro.
  const fetch = G.planFetch([mbox], { decoys: 7 });
  assert.equal(fetch.request.length, 8); assert.equal(fetch.pGatewayGuessesReal, 1 / 8);
  const got = fetch.request.flatMap((m) => server.get(m) ?? []);
  const joined = G.joinFromGateways([got[3], got[0]]);
  const opened = await G.openOuter(sYo, await G.mailboxId(sYo, yo.publicIdentity.fingerprint, day), joined);
  const msg = await openMessage({ recipient: yo, envelope: unpackEnvelope(opened), now });
  assert.equal(msg.body, texto);
  assert.equal(await G.openOuter(sYo, await G.mailboxId(sYo, yo.publicIdentity.fingerprint, day + 1), joined), null, 'buzón de otro día: no abre');
});

test('abusos rechazados: sello falso, sello de otra pasarela, repetido, cuota, ranura caducada, tipo no aceptado', async () => {
  const now = 1_800_000_000_000, policy = G.createGatewayPolicy({ ...POLICY, maxKBPerHour: 2, acceptPersonal: false });
  const gw = await G.createStrangerGateway({ policy, uplinkKind: 'WIFI', quality: 12, slotSeconds: 900, uplink: async () => true });
  const other = await G.createStrangerGateway({ policy, uplinkKind: 'WIFI', quality: 12, slotSeconds: 900, uplink: async () => true });
  const beacon = G.decodeBeacon(await gw.beacon(now, 90)), otherBeacon = G.decodeBeacon(await other.beacon(now, 90));
  const blob = new Uint8Array(1200).map((_, i) => i * 7);
  const bits = G.stampBits(policy, { bytes: blob.length, sos: true });
  assert.equal((await gw.offer({ ...G.prepareHandoff({ mbox: 'ab'.repeat(16), blob, sos: false, beacon, policyBits: 6 }) }, now, 90)).reason, 'KIND_NOT_ACCEPTED');
  const good = G.prepareHandoff({ mbox: 'ab'.repeat(16), blob, sos: true, beacon, policyBits: bits });
  let bad = good.nonce + 1; while (G.verifyStamp(G.blobDigest(blob), beacon.ephId, beacon.slot, bits, bad)) bad++;
  assert.equal((await gw.offer({ ...good, nonce: bad }, now, 90)).reason, 'BAD_STAMP');
  const forOther = G.prepareHandoff({ mbox: 'ab'.repeat(16), blob, sos: true, beacon: otherBeacon, policyBits: bits });
  if (!G.verifyStamp(G.blobDigest(blob), beacon.ephId, beacon.slot, bits, forOther.nonce)) assert.equal((await gw.offer(forOther, now, 90)).reason, 'BAD_STAMP');
  assert.equal((await gw.offer({ ...good, slot: good.slot - 5 }, now, 90)).reason, 'STALE_SLOT');
  assert.equal((await gw.offer(good, now, 90)).accepted, true);
  assert.equal((await gw.offer(good, now, 90)).reason, 'DUPLICATE');
  const blob2 = blob.map((x) => x ^ 1), r2 = G.prepareHandoff({ mbox: 'ab'.repeat(16), blob: blob2, sos: true, beacon, policyBits: bits });
  assert.equal((await gw.offer(r2, now, 90)).reason, 'QUOTA', 'la persona que presta su conexión fija su cuota y se respeta');
  assert.equal((await gw.offer(r2, now, 10)).reason, 'LOW_BATTERY');
});

test('reparto entre desconocidos: óptimo exacto y repartir gana a la mejor pasarela sola', () => {
  const c = [{ id: 'a', p: 0.9, capShards: 6 }, { id: 'b', p: 0.7, capShards: 6 }, { id: 'c', p: 0.6, capShards: 6 }];
  const plan = G.planShardSpread(c, { k: 3, n: 6 });
  assert.equal(plan.method, 'EXACT');
  assert.ok(Math.abs(plan.pDelivery - 0.97) < 1e-12, `${plan.pDelivery}`); // 1 − 0,1·0,3
  assert.ok(plan.pDelivery > plan.bestSingleGateway.p);
  // contra el óptimo por enumeración en instancias aleatorias (generador determinista)
  let seed = 3; const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let t = 0; t < 200; t++) {
    const cs = Array.from({ length: 2 + Math.floor(r() * 3) }, (_, i) => ({ id: `g${i}`, p: 0.2 + 0.75 * r(), capShards: 1 + Math.floor(r() * 4) }));
    const n = Math.min(cs.reduce((s, x) => s + x.capShards, 0), 2 + Math.floor(r() * 5)), k = 1 + Math.floor(r() * n);
    assert.ok(Math.abs(G.planShardSpread(cs, { k, n }).pDelivery - G.exhaustiveAllocation(cs, { k, n }).pDelivery) < 1e-12);
  }
  // instancia grande → heurístico, sigue siendo una probabilidad válida y mejor que concentrar
  const big = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, p: 0.3 + 0.05 * i, capShards: 6 }));
  const pb = G.planShardSpread(big, { k: 10, n: 24 });
  assert.equal(pb.method, 'HEURISTIC'); assert.ok(pb.pDelivery > 0.9 && pb.pDelivery <= 1);
});

test('causa común: si todas las pasarelas cuelgan de la misma antena, la fiabilidad no supera la de la antena', () => {
  const c = [{ id: 'a', p: 0.95, capShards: 3, uplink: 'CELL' }, { id: 'b', p: 0.95, capShards: 3, uplink: 'CELL' }, { id: 'w', p: 0.8, capShards: 3, uplink: 'WIFI' }];
  const alloc = [{ id: 'a', shards: 2 }, { id: 'b', shards: 2 }];
  const pc = G.spreadProbabilityCommonCause(c, alloc, 2, { CELL: 0.5 });
  assert.ok(pc <= 0.5 + 1e-12);
  const mixed = G.spreadProbabilityCommonCause(c, [{ id: 'a', shards: 2 }, { id: 'w', shards: 2 }], 2, { CELL: 0.5 });
  assert.ok(mixed > pc, 'diversificar el tipo de salida (antena + Wi-Fi de un bar) vence al fallo común');
});

test('física: pérdida en espacio libre, alcance, descubrimiento BLE y pasarelas al alcance (Poisson espacial)', () => {
  assert.ok(Math.abs(G.fsplDb(1, 2.44e9) - 40.2) < 0.05);
  assert.ok(Math.abs(G.fsplDb(100, 2.44e9) - G.fsplDb(10, 2.44e9) - 20) < 1e-9, '+20 dB por década en espacio libre');
  const base = { txDbm: 0, rxSensitivityDbm: -90, fHz: 2.44e9, extraLossDb: 0 };
  const r2 = G.linkRangeM({ ...base, pathLossExponent: 2 }), r3 = G.linkRangeM({ ...base, pathLossExponent: 3 });
  assert.ok(Math.abs(G.fsplDb(r2, 2.44e9) - 90) < 1e-6, 'con n = 2 el alcance es donde la pérdida iguala el presupuesto');
  assert.ok(r3 < r2);
  assert.throws(() => G.linkRangeM({ ...base }), /pathLossExponent/);
  const ble = G.bleDiscoveryMeanS({ advIntervalS: 0.1, scanWindowS: 0.03, scanIntervalS: 0.3 });
  assert.ok(Math.abs(ble.meanS - 1) < 1e-12);
  const av = G.gatewayAvailability({ densityPerKm2: 1000, fraction: 0.1, rangeM: 50, relSpeedMs: 1 });
  assert.ok(Math.abs(av.expectedInRange - 100e-6 * Math.PI * 2500) < 1e-12);
  assert.ok(Math.abs(av.pAtLeastOneNow - (1 - Math.exp(-av.expectedInRange))) < 1e-12);
  assert.ok(Math.abs(av.newGatewaysPerHour - 2 * 50 * 1 * 100e-6 * 3600) < 1e-9);
});

test('simulación coherente con la teoría: con entrega segura y una pasarela basta, la mediana es ln2/ritmo', () => {
  const sc = { densityPerKm2: 0.001, fraction: 1, rangeM: 1000, relSpeedMs: 1, pHandoff: 1, k: 2, n: 4, shardsPerGateway: 2 };
  const s = G.simulateStrangerRelay(sc, { runs: 4000, seed: 9, horizonS: 1e9 });
  const rate = 2 * 1000 * 1 * 0.001 / 1e6;
  assert.equal(s.basis, 'SIMULACION');
  assert.ok(Math.abs(s.p50S / (Math.LN2 / rate) - 1) < 0.06, `${s.p50S} vs ${Math.LN2 / rate}`);
  assert.throws(() => G.simulateStrangerRelay({ k: 2 }), /declararse/);
  assert.match(G.EXAMPLE_VILLAGE.basis, /EJEMPLO_DECLARADO/);
});
