import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGdacsRss, parseReliefWeb, parseMtgEvents, osintNear } from '../src/osint-feeds.mjs';

const SAMPLE_GDACS_XML = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:georss="http://www.georss.org/georss" xmlns:gdacs="http://www.gdacs.org">
<channel>
  <item>
    <title>Orange forest fire alert in Spain</title>
    <pubDate>Tue, 24 Nov 2026 08:00:00 GMT</pubDate>
    <georss:point>39.52 -0.42</georss:point>
    <gdacs:eventtype>WF</gdacs:eventtype>
    <gdacs:eventid>1024812</gdacs:eventid>
    <gdacs:alertlevel>Orange</gdacs:alertlevel>
    <gdacs:alertscore>1.6</gdacs:alertscore>
    <gdacs:country>Spain</gdacs:country>
  </item>
  <item>
    <title>Red flood alert in Valencia</title>
    <pubDate>Tue, 24 Nov 2026 09:00:00 GMT</pubDate>
    <georss:point>39.47 -0.38</georss:point>
    <gdacs:eventtype>FL</gdacs:eventtype>
    <gdacs:eventid>1024899</gdacs:eventid>
    <gdacs:alertlevel>Red</gdacs:alertlevel>
    <gdacs:alertscore>2.5</gdacs:alertscore>
    <gdacs:country>Spain</gdacs:country>
  </item>
</channel>
</rss>`;

test('osint-feeds: analiza GDACS GeoRSS, ReliefWeb y EUMETSAT MTG-I1 con procedencia explícita', () => {
  const gdacs = parseGdacsRss(SAMPLE_GDACS_XML);
  assert.equal(gdacs.length, 2);
  assert.equal(gdacs[0].id, 'gdacs:WF:1024812');
  assert.equal(gdacs[0].source, 'GDACS');
  assert.equal(gdacs[0].score, 1.6);

  const rw = parseReliefWeb({
    data: [{
      id: '5511',
      fields: {
        name: 'Spain: Heavy Rain Flash Update',
        status: 'alert',
        type: [{ code: 'FL' }],
        country: [{ name: 'Spain', location: { lat: 40.41, lon: -3.70 } }],
        date: { created: '2026-11-24T08:00:00Z' },
      },
    }],
  });
  assert.equal(rw.length, 1);
  assert.equal(rw[0].level, 'Red');
  assert.equal(rw[0].source, 'RELIEFWEB');

  const mtg = parseMtgEvents({
    features: [
      { id: 'fci-1', geometry: { type: 'Point', coordinates: [-0.45, 39.50] }, properties: { instrument: 'FCI', frpMw: 82.5, utc: '2026-11-24T09:10:00Z' } },
      { id: 'li-1', geometry: { type: 'Point', coordinates: [-0.50, 39.55] }, properties: { instrument: 'LI', utc: '2026-11-24T09:11:00Z' } },
    ],
  });
  assert.equal(mtg.length, 2);
  assert.equal(mtg[0].type, 'FIRE_FRP');
  assert.equal(mtg[0].level, 'Red');
  assert.equal(mtg[0].uncertaintyKm, 2.0);
  assert.equal(mtg[1].type, 'LIGHTNING');
  assert.equal(mtg[1].uncertaintyKm, 4.5);

  // Fusión espacial ordenada por severidad y distancia alrededor de Valencia
  const near = osintNear({ pos: [-0.376, 39.469], events: [...gdacs, ...rw, ...mtg], radiusKm: 50 });
  assert.equal(near.length, 4, 'excluye el evento de Madrid a ~300 km');
  assert.equal(near[0].level, 'Red');
  assert.equal(near[0].id, 'gdacs:FL:1024899');
});
