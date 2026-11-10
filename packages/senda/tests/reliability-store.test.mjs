import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeliveryReceipt,
  ReliabilityStore,
  DEFAULT_CHANNEL_PRIORS
} from '../src/reliability-store.mjs';

test('createDeliveryReceipt: genera recibo conforme al esquema v1, hash SHA-256 y sin identificadores personales', () => {
  const receipt = createDeliveryReceipt({
    bearerId: 'lora-868',
    zoneH3: '873908280ffffff',
    hazardState: 'BLACKOUT',
    sentAt: 1731200000000,
    ackedAt: 1731200001450,
    outcome: 'DELIVERED',
    fragments: 3,
    k: 2,
    appVersion: 'v0.22.4'
  });

  assert.equal(receipt.schema, 'senda-delivery-receipt/v1');
  assert.equal(receipt.bearerId, 'lora-868');
  assert.equal(receipt.zoneH3, '873908280ffffff');
  assert.equal(receipt.hazardState, 'BLACKOUT');
  assert.equal(receipt.success, true);
  assert.equal(receipt.latencyMs, 1450);
  assert.ok(receipt.receiptHash && receipt.receiptHash.length === 64, 'Debe incluir hash SHA-256 de 64 caracteres');

  // Privacidad por diseño: asegurar que no hay IP, IMEI, MAC ni nombres
  const keys = Object.keys(receipt);
  assert.ok(!keys.includes('userId'));
  assert.ok(!keys.includes('phone'));
  assert.ok(!keys.includes('imei'));
  assert.ok(!keys.includes('mac'));
});

test('ReliabilityStore: actualización conjugada Beta-Binomial y convergencia de shrinkage', () => {
  const store = new ReliabilityStore({
    channelPriors: {
      'lora-868': { alpha: 18, beta: 2 } // Prior media 0.90, concentracion 20
    }
  });

  const zone = '873908280ffffff';

  // 1. Sin observaciones: devuelve exactamente el prior global
  const r0 = store.getReliability('lora-868', zone);
  assert.equal(r0.mean, 0.9);
  assert.equal(r0.sampleCount, 0);
  assert.equal(r0.shrinkageWeight, 0);

  // 2. Con 2 fallos locales (n=2, 0 éxitos)
  store.ingestReceipt(createDeliveryReceipt({
    bearerId: 'lora-868',
    zoneH3: zone,
    sentAt: 1000,
    ackedAt: 0,
    outcome: 'EXPIRED'
  }));
  store.ingestReceipt(createDeliveryReceipt({
    bearerId: 'lora-868',
    zoneH3: zone,
    sentAt: 2000,
    ackedAt: 0,
    outcome: 'EXPIRED'
  }));

  const r2 = store.getReliability('lora-868', zone);
  assert.equal(r2.sampleCount, 2);
  // Con 2 muestras de fallo, alpha=18, beta=4 -> media = 18 / 22 = 0.8182
  assert.ok(r2.mean > 0.80 && r2.mean < 0.83, 'El prior debe amortiguar el fallo con solo 2 muestras');
  assert.ok(r2.shrinkageWeight < 0.15, 'El peso muestral debe ser pequeño frente a la concentración 20');

  // 3. Con 100 observaciones de éxito en esa zona
  for (let i = 0; i < 100; i++) {
    store.ingestReceipt(createDeliveryReceipt({
      bearerId: 'lora-868',
      zoneH3: zone,
      sentAt: 3000 + i * 10,
      ackedAt: 3500 + i * 10,
      outcome: 'DELIVERED'
    }));
  }

  const r102 = store.getReliability('lora-868', zone);
  assert.equal(r102.sampleCount, 102);
  // alpha = 18 + 100 = 118, beta = 2 + 2 = 4 -> mean = 118 / 122 = 0.9672
  assert.ok(r102.mean > 0.96);
  assert.ok(r102.shrinkageWeight > 0.80, 'Con 102 muestras, el peso de los datos observados domina');
  assert.ok(r102.credibleInterval99[0] > 0.90, 'El límite inferior del intervalo creíble al 99% debe subir');
});

test('ReliabilityStore: CRDT conmutativo y asociativo para sincronización entre nodos offline', () => {
  const storeA = new ReliabilityStore();
  const storeB = new ReliabilityStore();
  const storeC = new ReliabilityStore();

  const zone = '873908280ffffff';

  // Nodo A observa 5 éxitos en LoRa
  for (let i = 0; i < 5; i++) {
    storeA.ingestReceipt(createDeliveryReceipt({
      bearerId: 'lora-868',
      zoneH3: zone,
      sentAt: 1000 + i,
      ackedAt: 1500,
      outcome: 'DELIVERED'
    }));
  }

  // Nodo B observa 3 fallos en LoRa
  for (let i = 0; i < 3; i++) {
    storeB.ingestReceipt(createDeliveryReceipt({
      bearerId: 'lora-868',
      zoneH3: zone,
      sentAt: 2000 + i,
      ackedAt: 0,
      outcome: 'EXPIRED'
    }));
  }

  // Nodo C observa 2 éxitos en LoRa
  for (let i = 0; i < 2; i++) {
    storeC.ingestReceipt(createDeliveryReceipt({
      bearerId: 'lora-868',
      zoneH3: zone,
      sentAt: 3000 + i,
      ackedAt: 3200,
      outcome: 'DELIVERED'
    }));
  }

  // Conmutatividad: A merge B == B merge A
  const mergeAB = storeA.merge(storeB);
  const mergeBA = storeB.merge(storeA);

  const relAB = mergeAB.getReliability('lora-868', zone);
  const relBA = mergeBA.getReliability('lora-868', zone);

  assert.equal(relAB.sampleCount, 8);
  assert.equal(relBA.sampleCount, 8);
  assert.equal(relAB.mean, relBA.mean);

  // Asociatividad: (A merge B) merge C == A merge (B merge C)
  const mergeABC1 = mergeAB.merge(storeC);
  const mergeABC2 = storeA.merge(storeB.merge(storeC));

  const relABC1 = mergeABC1.getReliability('lora-868', zone);
  const relABC2 = mergeABC2.getReliability('lora-868', zone);

  assert.equal(relABC1.sampleCount, 10);
  assert.equal(relABC2.sampleCount, 10);
  assert.equal(relABC1.mean, relABC2.mean);
});

test('ReliabilityStore: Detección de deriva de canal mediante Wald SPRT', () => {
  const store = new ReliabilityStore();
  const zone = '873908280ffffff';

  // 1. Canal sano: 20 entregas consecutivas sin fallos
  for (let i = 0; i < 20; i++) {
    store.ingestReceipt(createDeliveryReceipt({
      bearerId: 'c-its',
      zoneH3: zone,
      sentAt: 1000 + i * 50,
      ackedAt: 1038 + i * 50,
      outcome: 'DELIVERED'
    }));
  }

  const driftNormal = store.detectDrift('c-its', zone);
  assert.equal(driftNormal.driftDetected, false);
  assert.equal(driftNormal.status, 'HEALTHY');

  // 2. Canal colapsa: 15 fallos consecutivos debidos a interferencia o caída de torre
  for (let i = 0; i < 15; i++) {
    store.ingestReceipt(createDeliveryReceipt({
      bearerId: 'c-its',
      zoneH3: zone,
      sentAt: 2000 + i * 50,
      ackedAt: 0,
      outcome: 'DROPPED'
    }));
  }

  const driftAlarm = store.detectDrift('c-its', zone);
  assert.equal(driftAlarm.driftDetected, true);
  assert.equal(driftAlarm.status, 'CHANNEL_DEGRADED_ALARM');
  assert.ok(driftAlarm.logLikelihoodRatio >= driftAlarm.threshold);
});

test('ReliabilityStore: Serialización toJSON y reconstrucción fromJSON', () => {
  const store = new ReliabilityStore({ decayFactor: 0.98 });
  store.ingestReceipt(createDeliveryReceipt({
    bearerId: 'ble-mesh',
    zoneH3: '873908280ffffff',
    sentAt: 1000,
    ackedAt: 1100,
    outcome: 'DELIVERED'
  }));

  const json = store.toJSON();
  const restored = ReliabilityStore.fromJSON(json);

  const orig = store.getReliability('ble-mesh', '873908280ffffff');
  const rest = restored.getReliability('ble-mesh', '873908280ffffff');

  assert.equal(orig.sampleCount, rest.sampleCount);
  assert.equal(orig.mean, rest.mean);
  assert.equal(restored.decayFactor, 0.98);
});
