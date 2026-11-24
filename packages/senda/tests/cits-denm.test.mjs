import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ETSI_CAUSE_CODES,
  DENM_COMPACT_BYTES,
  utcMsToTimestampIts,
  timestampItsToUtcMs,
  sendaToDenm,
  denmToSenda,
  encodeDenmCompact,
  decodeDenmCompact,
  isDenmCompact,
  isInsideDenmRelevance,
} from '../src/cits-denm.mjs';

test('ETSI C-ITS DENM: época TAI 2004, conversión canónica y mapeo exacto V-16/accidente/puente', () => {
  const now = Date.UTC(2026, 10, 24, 17, 0, 0);
  const ts = utcMsToTimestampIts(now);
  assert.equal(timestampItsToUtcMs(ts), now);

  const denmV16 = sendaToDenm({ kind: 'v16', lat: 40.41678, lon: -3.70379, headingDeg: 92.4, tMs: now, stationId: 0x10203040, sequenceNumber: 7 });
  assert.equal(denmV16.denm.situation.eventType.causeCode, ETSI_CAUSE_CODES.VEHICLE_BREAKDOWN);
  assert.equal(denmV16.denm.management.eventPosition.latitude, 404167800);

  const back = denmToSenda(denmV16);
  assert.equal(back.kind, 'parado');
  assert.equal(back.causeCode, 91);
  assert.ok(Math.abs(back.lat - 40.41678) < 1e-6);
  assert.equal(back.headingDeg, 92.4);
});

test('ETSI C-ITS DENM compacto 36 B: ida y vuelta byte a byte, rechazo CRC-16 corrupto y área de relevancia', () => {
  const now = Date.UTC(2026, 10, 24, 17, 0, 0);
  const denm = sendaToDenm({ kind: 'accidente', lat: 52.3676, lon: 4.9041, headingDeg: 185.5, tMs: now, stationId: 998877, sequenceNumber: 42, validityDurationS: 300, relevanceDistanceM: 800 });
  const wire = encodeDenmCompact(denm);
  assert.equal(wire.length, DENM_COMPACT_BYTES);
  assert.equal(isDenmCompact(wire), true);

  const dec = decodeDenmCompact(wire);
  assert.equal(dec.header.stationID, 998877);
  assert.equal(dec.denm.situation.eventType.causeCode, ETSI_CAUSE_CODES.ACCIDENT);
  assert.equal(dec.denm.location.eventPositionHeadingDeg, 185.5);

  // Corrupción de 1 bit -> CRC-16-CCITT la rechaza
  const corrupted = new Uint8Array(wire);
  corrupted[14] ^= 0x04;
  assert.throws(() => decodeDenmCompact(corrupted), /CRC-16/);

  // Comprobación de relevancia espacial y temporal
  assert.equal(isInsideDenmRelevance(dec, [4.9041, 52.3640], now + 60_000).relevant, true);
  assert.equal(isInsideDenmRelevance(dec, [4.9041, 52.3000], now + 60_000).relevant, false);
  assert.equal(isInsideDenmRelevance(dec, [4.9041, 52.3676], now + 400_000).relevant, false);
});
