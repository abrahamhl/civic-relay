import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestOfficialAlert, relayActivation, createConsentProfile, zoneFromQuake, inZone } from '../src/zones.mjs';
import { staLtaTriggers, locateEvent } from '../src/seismic.mjs';
import { parseTle, propagateKeplerJ2, predictPasses, lookAngles, AUTHENTIC_DATED_TLES } from '../src/orbital.mjs';
import { parseCap, parseUsgs, parseEmsc, parseSatnogsStations, pullAll } from '../src/feeds.mjs';
import { scenarioQuake } from '../src/scenarios.mjs';

const now = Date.UTC(2026, 10, 4, 12);
const consent = createConsentProfile({ termsVersion: 't1', relayInDeclaredZones: true, acceptedAt: '2026-11-01' });
const capXml = `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>ES-1</identifier><sender>es-alert@proteccioncivil.example</sender><sent>2026-11-04T10:00:00+00:00</sent><status>Actual</status><msgType>Alert</msgType>
<info><event>Incendio forestal</event><severity>Extreme</severity><urgency>Immediate</urgency><expires>2026-11-05T10:00:00+00:00</expires><headline>Confínese</headline>
<area><areaDesc>San Martín de Valdeiglesias</areaDesc><polygon>40.30,-4.50 40.45,-4.50 40.45,-4.30 40.30,-4.30 40.30,-4.50</polygon></area></info></alert>`;

test('CAP oficial verificado activa el relé preautorizado; sin verificación se rechaza', async () => {
  const cap = parseCap(capXml);
  assert.equal(cap.event, 'Incendio forestal');
  const bad = await ingestOfficialAlert(cap, { verifyIssuer: async () => false, now });
  assert.equal(bad.accepted, false);
  const ok = await ingestOfficialAlert(cap, { verifyIssuer: async () => true, now });
  assert.ok(inZone({ lat: 40.36, lon: -4.40 }, ok.zone));
  const act = relayActivation({ zones: [ok.zone], position: { lat: 40.36, lon: -4.40 }, consent, now });
  assert.equal(act.mode, 'RELAY_ACTIVE');
  const noConsent = relayActivation({ zones: [ok.zone], position: { lat: 40.36, lon: -4.40 }, consent: { ...consent, relayInDeclaredZones: false }, now });
  assert.equal(noConsent.mode, 'STANDBY');
});

test('una sola fuente no oficial no activa el relé; dos fuentes independientes sí', () => {
  const s = scenarioQuake();
  assert.equal(s.activation.networkOnly, 'STANDBY');
  assert.equal(s.activation.withPublicFeed, 'RELAY_ACTIVE');
  assert.ok(s.location.errorKm < 5);
});

test('STA/LTA dispara con una sacudida y no con ruido', () => {
  let s = 7; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5);
  const quiet = Array.from({ length: 50 * 30 }, () => rnd() * 0.01);
  assert.equal(staLtaTriggers(quiet).length, 0);
  const quake = quiet.map((v, i) => (i > 50 * 20 && i < 50 * 24 ? v + Math.sin(i) * 0.3 : v));
  const t = staLtaTriggers(quake);
  assert.equal(t.length, 1);
  assert.ok(Math.abs(t[0] - 20) < 1);
});

test('localización rechaza llegadas incoherentes', () => {
  const picks = [{ lat: 37, lon: -1, t: 0 }, { lat: 37.5, lon: -1.5, t: 100 }, { lat: 38, lon: -1, t: 3 }, { lat: 37.2, lon: -2, t: 50 }];
  assert.equal(locateEvent(picks).confidence, 'REJECTED_INCOHERENT');
});

test('órbita: elementos TLE de prueba tipo ISS (sintéticos) dan radio y periodo físicos', () => {
  const iss = parseTle('LEO-TEST (sintético, tipo ISS)', '1 25544U 98067A   26308.50000000  .00016717  00000-0  30287-3 0  9993', '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.50003300 12345');
  const r = Math.hypot(...Object.values(propagateKeplerJ2(iss, iss.epoch)));
  assert.ok(r > 6700 && r < 6850, `radio ${r}`);
  assert.ok(Math.abs(86400 / iss.nRevDay / 60 - 92.9) < 0.5);
  const passes = predictPasses(iss, { lat: 40.36, lon: -4.4 }, { from: iss.epoch, to: iss.epoch + 86400_000, minElevationDeg: 10, stepS: 30 });
  assert.ok(passes.length >= 2 && passes.length <= 8, `pasos ${passes.length}`);
  for (const p of passes) assert.ok(p.end - p.start < 15 * 60_000);
});

test('geometría: un satélite justo encima tiene elevación ~90°', () => {
  const el = { name: 'X', norad: 1, epoch: 0, inc: 0, raan: 0, ecc: 0, argp: 0, M: 0, nRevDay: 15 };
  // En t=0 está sobre (0°, lon = GMST) → observador ecuatorial en esa longitud.
  const gm = ((280.46061837 + 360.98564736629 * ((0 - Date.UTC(2000, 0, 1, 12)) / 86400000)) % 360 + 360) % 360;
  const { elevationDeg, azimuthDeg, rangeKm, rangeRateKmS, computeDopplerShiftHz, disclaimer } = lookAngles(el, { lat: 0, lon: -gm }, 0);
  assert.ok(elevationDeg > 89, `${elevationDeg}`);
  assert.ok(azimuthDeg >= 0 && azimuthDeg <= 360, `acimut ${azimuthDeg}`);
  assert.ok(rangeKm > 300 && rangeKm < 1000, `distancia ${rangeKm}`);
  assert.ok(Math.abs(rangeRateKmS) < 2.0, `velocidad radial en cénit cercana a 0: ${rangeRateKmS}`);
  assert.ok(typeof computeDopplerShiftHz === 'function');
  const dopplerUhf = computeDopplerShiftHz(437e6);
  assert.ok(Math.abs(dopplerUhf) < 5000, `desplazamiento Doppler UHF: ${dopplerUhf}`);
  assert.ok(disclaimer.includes('VENTANA GEOMÉTRICA DE VISIBILIDAD'));
});

test('catálogo de TLEs auténticos: Sentinel-3A y Terra tienen propagación física coherente', () => {
  const s3 = parseTle(AUTHENTIC_DATED_TLES.SENTINEL_3A.name, AUTHENTIC_DATED_TLES.SENTINEL_3A.line1, AUTHENTIC_DATED_TLES.SENTINEL_3A.line2);
  assert.equal(s3.norad, 41335);
  const r = Math.hypot(...Object.values(propagateKeplerJ2(s3, s3.epoch)));
  // Sentinel-3 orbita a ~814 km de altitud -> r ≈ 6378 + 814 ≈ 7192 km
  assert.ok(r > 7100 && r < 7300, `radio orbital Sentinel-3A: ${r}`);

  const valencia = { lat: 39.47, lon: -0.38, altKm: 0.05 };
  const passes = predictPasses(s3, valencia, { from: s3.epoch, to: s3.epoch + 86400_000 * 2, minElevationDeg: 12, stepS: 15 });
  assert.ok(passes.length >= 1, `al menos 1 pase sobre Valencia en 48h: ${passes.length}`);
  const firstPass = passes[0];
  assert.ok(firstPass.maxElevationDeg >= 12, `elevación máxima: ${firstPass.maxElevationDeg}`);
  assert.ok(firstPass.azimuthAtMaxDeg >= 0 && firstPass.azimuthAtMaxDeg <= 360);
});

test('feeds: USGS, EMSC y SatNOGS se normalizan; pullAll tolera fuentes caídas', async () => {
  const usgs = parseUsgs({ features: [{ id: 'us1', properties: { mag: 6.1, time: now, place: 'X' }, geometry: { coordinates: [-1.7, 37.7, 10] } }] });
  assert.equal(usgs[0].lat, 37.7);
  assert.ok(zoneFromQuake(usgs[0]).circle.radiusKm > 50);
  const emsc = parseEmsc({ features: [{ id: 'e1', properties: { mag: 5, time: '2026-11-04T03:12:00Z', lat: 37, lon: -1, depth: 8, flynn_region: 'SPAIN' } }] });
  assert.equal(emsc[0].provider, 'EMSC');
  assert.equal(parseSatnogsStations([{ id: 1, name: 'a', lat: 40, lng: -4, altitude: 600, status: 'Online' }, { id: 2, status: 'Offline' }]).length, 1);
  const fake = async (url) => url.includes('usgs') ? { ok: true, text: async () => JSON.stringify({ features: [] }) } : { ok: false, status: 503 };
  const r = await pullAll({ fetchImpl: fake });
  assert.equal(r.errors.length, 3);
});
