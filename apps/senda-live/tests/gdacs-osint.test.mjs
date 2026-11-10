import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildGdacsUrl, normalizeGdacsEvents, createGdacsFeed } from '../server/domain/gdacs-osint.mjs';
import { correlateGdacsCatalogs } from '../server/domain/osint-catalog-correlation.mjs';

const NOW = Date.parse('2026-11-09T12:00:00Z');
const iso = (minutesAgo) => new Date(NOW - minutesAgo * 60000).toISOString();
const point = ({ eventid = 1234567, episodeid = 1, eventtype = 'EQ', lat = 39.4699, lon = -0.3763,
  minutesAgo = 40, alertlevel = 'Orange', title = 'Earthquake event <script>alert(1)</script>' } = {}) => ({
  type: 'Feature',
  properties: {
    eventid, episodeid, eventtype, name: title,
    alertlevel, alertscore: 2.5, fromdate: iso(minutesAgo),
    datemodified: iso(minutesAgo - 3),
    country: 'Spain',
    severitydata: { severity: 5.8, severityunit: 'M' },
  },
  geometry: { type: 'Point', coordinates: [lon, lat] }
});
const geojson = (features = [point()]) => ({ type: 'FeatureCollection', features });
const usgs = (events) => ({
  dataset: 'USGS_M45_WEEK_GEOJSON', status: 'SOURCE_SNAPSHOT',
  observations: events.map((e, i) => ({
    id: 'usgs:fixture' + i, location: { lat: e.lat, lon: e.lon },
    observedAt: e.time, url: 'https://earthquake.usgs.gov/earthquakes/eventpage/test',
    dataKind: 'HISTORICAL_OBSERVATION'
  }))
});
const eonet = (events) => ({
  dataset: 'NASA_EONET_V3_WILDFIRES', status: 'SOURCE_SNAPSHOT',
  observations: events.map((e, i) => ({
    id: 'eonet:fixture' + i, location: { lat: e.lat, lon: e.lon },
    observedAt: e.time, url: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_123',
    dataKind: 'CURATED_EVENT_METADATA'
  }))
});

test('GDACS fixed authenticated origin and bounded two-week query', () => {
  const url = new URL(buildGdacsUrl(NOW));
  assert.equal(url.hostname, 'www.gdacs.org');
  assert.equal(url.pathname, '/gdacsapi/api/events/geteventlist/SEARCH');
  assert.equal(url.searchParams.get('fromDate'), '2026-10-26');
  assert.equal(url.searchParams.get('toDate'), '2026-11-09');
  assert.equal(url.searchParams.get('eventlist'), 'EQ,WF,FL,TC,VO,DR');
  // Live contract (2026-11-09): without alertlevel the API silently omits Green events.
  assert.equal(url.searchParams.get('alertlevel'), 'green;orange;red');
  assert.equal(url.searchParams.get('pageSize'), '100');
  assert.equal(url.searchParams.get('pageNumber'), '1');
  assert.equal(new URL(buildGdacsUrl(NOW, 3)).searchParams.get('pageNumber'), '3');
  assert.throws(() => buildGdacsUrl(NOW, 0), /GDACS_BAD_PAGE/);
});

test('normalization preserves GDACS provider risk and does not elevate to SENDA alert', () => {
  const result = normalizeGdacsEvents(geojson(), { now: NOW, rawSha256: 'a'.repeat(64) });
  assert.equal(result.observations.length, 1);
  const e = result.observations[0];
  assert.equal(e.id, 'gdacs:EQ:1234567:1');
  assert.equal(e.alertLevel, 'Orange');
  assert.equal(e.eventOrigin, 'GDACS_RISK_ASSESSMENT');
  assert.equal(e.geometryMeaning, 'SOURCE_EVENT_REPRESENTATIVE_POINT_NOT_AFFECTED_AREA');
  assert.equal(e.isNationalPublicWarning, false);
  assert.equal(e.isSendaAlert, false);
  assert.equal(e.isCorroboratedByIndependentSource, false);
  assert.equal(e.title, 'Earthquake event <script>alert(1)</script>');
  assert.equal(e.sourceUrl, 'https://www.gdacs.org/report.aspx?eventid=1234567&eventtype=EQ');
  assert.equal(result.source.rawSha256, 'a'.repeat(64));
});

test('reject malformed, adversarial and duplicated feed entries; no fake polygon centroid', () => {
  const features = [
    point({ eventid: 2, lat: 200 }),
    point({ eventid: 3, eventtype: 'untrusted' }),
    point({ eventid: 4, alertlevel: 'Danger!!!' }),
    { ...point({ eventid: 5 }), geometry: { type: 'Polygon', coordinates: [] } },
    point({ eventid: 6, minutesAgo: -200 }),
    point({ eventid: 7 }), point({ eventid: 7 }),
  ];
  const output = normalizeGdacsEvents(geojson(features), { now: NOW });
  assert.equal(output.observations.length, 1);
  assert.equal(output.rejectedFeatures, 5);
  assert.equal(output.duplicateRecords, 1, 'GDACS paging repeats records: deduplicated, not rejected');
  assert.throws(() => normalizeGdacsEvents({ type: 'FeatureCollection', features: new Array(881).fill(point()) }, { now: NOW }), /GDACS_BAD_GEOJSON/);
});

test('normalizes naive GDACS ISO dates explicitly as UTC', () => {
  const event = point({ eventid: 8 });
  event.properties.fromdate = '2026-11-09T11:20:00';
  event.properties.datemodified = '2026-11-09T11:25:00';
  const normalized = normalizeGdacsEvents(geojson([event]), { now: NOW });
  assert.equal(normalized.observations[0].observedAt, '2026-11-09T11:20:00.000Z');
});

test('bounded fetch, raw SHA, coalescing, cache and fail closed without invented events', async () => {
  const body = geojson(), bytes = JSON.stringify(body);
  let hits = 0, now = NOW, offline = false;
  const feed = createGdacsFeed({
    clock: () => now, ttlMs: 60_000, staleMaxMs: 70_000,
    fetcher: async (url, options) => {
      hits++;
      assert.equal(new URL(url).hostname, 'www.gdacs.org');
      assert.equal(options.redirect, 'error');
      if (offline) throw new Error('unreachable');
      return new Response(bytes, { headers: { 'content-type': 'application/geo+json' } });
    }
  });
  const [a, b] = await Promise.all([feed.read(), feed.read()]);
  assert.equal(hits, 1);
  assert.equal(a.status, 'SOURCE_SNAPSHOT');
  assert.equal(b.observations.length, 1);
  const pageHash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(a.source.rawSha256, createHash('sha256').update(pageHash).digest('hex'), 'hash of the ordered page hashes');
  assert.deepEqual(a.pages.pageSha256, [pageHash]);
  assert.equal(a.pages.exhausted, true);
  assert.equal((await feed.read()).status, 'CACHED_SNAPSHOT');
  now += 61_000; offline = true;
  assert.equal((await feed.read()).status, 'STALE_SNAPSHOT');
  now += 90_000;
  assert.equal((await feed.read()).status, 'UNAVAILABLE');
});

test('invalid JSON, body size limits and HTTP errors reject feed', async () => {
  for (const fetcher of [
    async () => new Response('{bad', { status: 200 }),
    async () => new Response('irrelevant', { status: 200, headers: { 'content-length': '9000000' } }),
    async () => new Response('', { status: 503 })
  ]) {
    const source = createGdacsFeed({ fetcher, clock: () => NOW });
    assert.equal((await source.read()).status, 'UNAVAILABLE');
  }
});

test('only source-specific spatiotemporal candidates, never independent corroboration', () => {
  const catalog = { ...normalizeGdacsEvents(geojson(), { now: NOW }), status: 'SOURCE_SNAPSHOT' };
  const matched = correlateGdacsCatalogs(catalog, usgs([
    { lat: 39.48, lon: -0.39, time: iso(50) },
    { lat: 43.5, lon: -6, time: iso(50) },
    { lat: 39.48, lon: -0.39, time: iso(500) }
  ]), eonet([]));
  assert.equal(matched.totalCandidateLinks, 1);
  assert.equal(matched.observations[0].crossCatalogStatus, 'PROXIMITY_CANDIDATE_NOT_VERIFIED');
  assert.equal(matched.observations[0].crossCatalogCandidates[0].isIndependentVerification, false);
  assert.equal(matched.sourceIndependenceValidated, false);
  assert.equal(matched.isSendaAlert, false);
});

test('wildfire catalog coincidences use different spatial and temporal gates', () => {
  const catalog = { ...normalizeGdacsEvents(geojson([point({ eventtype: 'WF', eventid: 9999 })]), { now: NOW }),
    status: 'SOURCE_SNAPSHOT' };
  const found = correlateGdacsCatalogs(catalog, usgs([]), eonet([
    { lat: 39.60, lon: -0.42, time: iso(800) },
    { lat: 43.0, lon: -0.42, time: iso(800) },
  ]));
  assert.equal(found.totalCandidateLinks, 1);
  assert.equal(found.observations[0].crossCatalogCandidates[0].relation, 'SPATIOTEMPORAL_CANDIDATE_ONLY');
});

test('stale provider data cannot be promoted to current cross-catalog evidence', () => {
  const catalog = { ...normalizeGdacsEvents(geojson(), { now: NOW }), status: 'SOURCE_SNAPSHOT' };
  const stale = { ...usgs([{ lat: 39.47, lon: -0.38, time: iso(40) }]), status: 'STALE_SNAPSHOT' };
  const matched = correlateGdacsCatalogs(catalog, stale, eonet([]));
  assert.equal(matched.totalCandidateLinks, 0);
  assert.equal(matched.observations[0].crossCatalogStatus, 'COMPARISON_SOURCE_UNAVAILABLE_OR_STALE');
});

test('HTTP 204 (no events) is a valid empty snapshot, not a provider outage', async () => {
  const feed = createGdacsFeed({ clock: () => NOW, fetcher: async () => new Response(null, { status: 204 }) });
  const snap = await feed.read();
  assert.equal(snap.status, 'SOURCE_SNAPSHOT');
  assert.equal(snap.observations.length, 0);
  assert.equal(snap.pages.exhausted, true);
});

test('paginates with a hard page cap, stops on a short page and deduplicates repeated records', async () => {
  const pages = {
    1: geojson(Array.from({ length: 100 }, (_, i) => point({ eventid: 1000 + i, minutesAgo: 60 + i }))),
    2: geojson([point({ eventid: 1099, minutesAgo: 30 }), point({ eventid: 2001, minutesAgo: 20, alertlevel: 'Red' })]),
  };
  const asked = [];
  const feed = createGdacsFeed({ clock: () => NOW, maxPages: 5, fetcher: async (url) => {
    const n = +new URL(url).searchParams.get('pageNumber'); asked.push(n);
    return new Response(JSON.stringify(pages[n]), { status: 200 });
  } });
  const snap = await feed.read();
  assert.deepEqual(asked, [1, 2], 'stops after a page with < 100 records');
  assert.equal(snap.duplicateRecords, 1);
  assert.equal(snap.sourceRecordsAccepted, 101);
  assert.equal(snap.observations.length, 100, 'display cap');
  assert.equal(snap.resultLimitReached, true);
  assert.equal(snap.observations[0].alertLevel, 'Red', 'provider alert level ranks first');
  const capped = createGdacsFeed({ clock: () => NOW, maxPages: 1, fetcher: async () => new Response(JSON.stringify(pages[1]), { status: 200 }) });
  const c = await capped.read();
  assert.equal(c.pages.exhausted, false);
  assert.equal(c.resultLimitReached, true, 'more pages may exist: never presented as complete');
  assert.throws(() => createGdacsFeed({ maxPages: 99 }), /GDACS_BAD_PAGE_LIMIT/);
});

test('real GDACS page (captured 2026-11-10 ≈01:40 UTC) normalizes with declared upstream lineage', async () => {
  const { readFileSync } = await import('node:fs');
  const raw = readFileSync(new URL('./fixtures/gdacs-live-2026-11-10-page1.json', import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'), '68b8193e4159b73492606654b94a51ee30d3a7cc368a6025901b07f51f903e4a');
  const out = normalizeGdacsEvents(JSON.parse(raw), { now: Date.parse('2026-11-10T02:00:00Z') });
  assert.equal(out.observations.length, 100, `accepted ${out.observations.length} of 100 real records`);
  assert.ok(out.observations.some((o) => o.eventType === 'EQ' && o.episodeId.length === 7), 'real EQ episode ids have 7 digits');
  for (const o of out.observations) {
    assert.equal(o.isSendaAlert, false);
    assert.equal(o.isCorroboratedByIndependentSource, false);
    assert.ok(o.providerSource, 'every real record declares its upstream source');
  }
  const wf = out.observations.find((o) => o.eventType === 'WF');
  assert.equal(wf.providerSource, 'GWIS');
  assert.ok(wf.sameUpstreamCatalogs.includes('NASA_FIRMS'), 'GWIS fires share the satellite active-fire upstream');
});

test('GDACS earthquake from USGS NEIC vs USGS catalog = same upstream record, never corroboration', () => {
  const ev = point({ eventid: 77 });
  ev.properties.source = 'NEIC';
  const g = { ...normalizeGdacsEvents(geojson([ev]), { now: NOW }), status: 'SOURCE_SNAPSHOT' };
  assert.equal(g.observations[0].sourceDependency, 'DECLARED_UPSTREAM');
  const r = correlateGdacsCatalogs(g, usgs([{ lat: 39.47, lon: -0.38, time: iso(41) }]), null);
  assert.equal(r.observations[0].crossCatalogStatus, 'SAME_UPSTREAM_NOT_CORROBORATION');
  assert.equal(r.observations[0].crossCatalogCandidates[0].relation, 'SAME_UPSTREAM_RECORD');
  assert.equal(r.observations[0].independentlyVerified, false);
  // Without a declared source the relation stays a mere proximity candidate.
  const u = { ...normalizeGdacsEvents(geojson([point({ eventid: 78 })]), { now: NOW }), status: 'SOURCE_SNAPSHOT' };
  assert.equal(u.observations[0].sourceDependency, 'SOURCE_DEPENDENCY_UNKNOWN');
  assert.equal(correlateGdacsCatalogs(u, usgs([{ lat: 39.47, lon: -0.38, time: iso(41) }]), null).observations[0].crossCatalogStatus, 'PROXIMITY_CANDIDATE_NOT_VERIFIED');
});

test('default options work (regression: clock defaulted to a number and crashed the live endpoint)', async () => {
  const feed = createGdacsFeed({ fetcher: async () => new Response(null, { status: 204 }) });
  const snap = await feed.read();
  assert.equal(snap.status, 'SOURCE_SNAPSHOT');
  assert.ok(Date.parse(snap.fetchedAt) > 0);
});
