import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCapAlert,
  normalizeCapAlertCollection,
  createAemetCapFeed,
  AEMET_DOCS_URL,
} from '../server/domain/aemet-cap.mjs';

const NOW = Date.parse('2026-11-09T01:00:00Z');

function validAlert({
  id = 'aemet-warn-001',
  severity = 'Orange',
  headline = 'Lluvias torrenciales en litoral',
  onset = '2026-11-09T00:00:00Z',
  expires = '2026-11-09T18:00:00Z',
  area = 'Litoral norte de Valencia',
  lat = 39.47,
  lon = -0.37,
} = {}) {
  return {
    identifier: id,
    sender: 'aemet.es',
    headline,
    severity,
    onset,
    expires,
    areaDesc: area,
    lat,
    lon,
    description: 'Precipitación acumulada en una hora: 40 mm.',
    instruction: 'Extreme precauciones y evite pasos subterráneos.',
  };
}

test('AEMET / Meteoalarm CAP: normalizes official severe weather warnings', () => {
  const collection = [
    validAlert({ id: 'warn-1', severity: 'Orange', headline: 'Lluvias intensas' }),
    validAlert({ id: 'warn-2', severity: 'Red', headline: 'Viento huracanado' }),
    validAlert({ id: 'warn-3', severity: 'Yellow', headline: 'Aviso por oleaje' }),
  ];

  const result = normalizeCapAlertCollection(collection, { now: NOW, rawSha256: 'abcdef1234567890' });
  assert.equal(result.schema, 'senda.osint.official-warnings-cap/1');
  assert.equal(result.totalActiveWarnings, 3);

  // Red (EXTREME) sorted first before Orange (SEVERE)
  assert.equal(result.warnings[0].severity, 'EXTREME');
  assert.equal(result.warnings[0].capIdentifier, 'warn-2');
  assert.equal(result.warnings[0].severityColor, '#dc2626');
  assert.equal(result.warnings[0].isOfficialGovernmentWarning, true);
  assert.equal(result.warnings[0].isSendaGeneratedAlert, false);

  assert.equal(result.warnings[1].severity, 'SEVERE');
  assert.equal(result.warnings[1].capIdentifier, 'warn-1');

  assert.equal(result.warnings[2].severity, 'MODERATE');
  assert.equal(result.warnings[2].capIdentifier, 'warn-3');
});

test('AEMET / Meteoalarm CAP: filters out expired alerts, invalid IDs and duplicates', () => {
  const collection = [
    validAlert({ id: 'active-1' }),
    validAlert({ id: 'active-1' }), // Duplicate
    validAlert({ id: 'expired-1', expires: '2026-11-07T00:00:00Z' }), // Expired 2 days ago
    { invalid: 'payload_without_id' },
  ];

  const result = normalizeCapAlertCollection(collection, { now: NOW });
  assert.equal(result.totalActiveWarnings, 1);
  assert.equal(result.warnings[0].capIdentifier, 'active-1');
});

test('AEMET CAP Feed: fetch, caching and upstream error handling', async () => {
  let calls = 0;
  const mockFetch = async () => {
    calls++;
    if (calls === 1) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([validAlert({ id: 'cached-alert-1' })]),
      };
    }
    return { ok: false, status: 502, text: async () => 'Bad Gateway' };
  };

  const feed = createAemetCapFeed({ fetchFn: mockFetch, clock: () => NOW, ttlMs: 15_000 });

  const first = await feed.read();
  assert.equal(first.status, 'ACTIVE_SNAPSHOT');
  assert.equal(first.totalActiveWarnings, 1);
  assert.equal(calls, 1);

  // Cached read
  const cached = await feed.read();
  assert.equal(cached.totalActiveWarnings, 1);
  assert.equal(calls, 1);

  // Fallback to stale snapshot
  const stale = await feed.read(true);
  assert.equal(stale.status, 'STALE_SNAPSHOT');
  assert.equal(stale.totalActiveWarnings, 1);
});
