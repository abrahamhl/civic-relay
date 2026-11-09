import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTHENTIC_DATED_TLES,
  parseTle,
  propagateKeplerJ2,
  lookAngles,
} from '../web/src/science/orbital-kinematics.mjs';

test('Orbital Kinematics P0-07: authentic dated TLEs have valid NORAD IDs and timestamps', () => {
  const keys = Object.keys(AUTHENTIC_DATED_TLES);
  assert.ok(keys.includes('SENTINEL_3A'));
  assert.ok(keys.includes('TERRA'));
  assert.ok(keys.includes('SUOMI_NPP'));
  assert.ok(keys.includes('ISS'));

  for (const [key, t] of Object.entries(AUTHENTIC_DATED_TLES)) {
    const el = parseTle(t.name, t.line1, t.line2);
    assert.equal(el.norad, t.norad);
    assert.ok(el.epoch > Date.parse('2025-01-01T00:00:00Z'));
    assert.ok(el.nRevDay > 14 && el.nRevDay < 16.5, `LEO mean motion should be 14-16 rev/day, got ${el.nRevDay}`);
    assert.ok(el.ecc >= 0 && el.ecc < 0.05, `LEO orbits should be near circular, got ${el.ecc}`);
    assert.ok(el.inc > 0.8 && el.inc < 1.8, `LEO inclination in rad should be realistic, got ${el.inc}`);
  }
});

test('Orbital Kinematics P0-07: Kepler J2 propagation computes physically valid ECI coordinates', () => {
  const s3 = AUTHENTIC_DATED_TLES.SENTINEL_3A;
  const el = parseTle(s3.name, s3.line1, s3.line2);

  const t0 = el.epoch;
  const eci0 = propagateKeplerJ2(el, t0);

  // Geocentric distance: r = sqrt(x^2 + y^2 + z^2) in km
  const r0 = Math.hypot(eci0.x, eci0.y, eci0.z);
  const alt0 = r0 - 6378.137;
  // Sentinel-3 is at ~814 km altitude (orbital radius ~7192 km)
  assert.ok(alt0 > 790 && alt0 < 840, `Sentinel-3 altitude should be ~814 km, got ${alt0.toFixed(1)} km`);
  assert.ok(r0 > 7150 && r0 < 7250, `Sentinel-3 orbital radius should be ~7192 km, got ${r0.toFixed(1)} km`);

  // Velocity should be ~7.4 km/s in LEO
  assert.ok(eci0.orbitalSpeedKmS > 7.0 && eci0.orbitalSpeedKmS < 7.8, `LEO orbital speed should be ~7.4 km/s, got ${eci0.orbitalSpeedKmS.toFixed(2)} km/s`);

  // Propagate 1/4 orbit (~25 minutes = 1500 seconds)
  const t1 = t0 + 1500 * 1000;
  const eci1 = propagateKeplerJ2(el, t1);
  const r1 = Math.hypot(eci1.x, eci1.y, eci1.z);
  assert.ok(Math.abs(r1 - r0) < 5.0, `Near-circular orbit radius should stay stable, Δr=${Math.abs(r1 - r0)} km`);
  // Satellite must have moved significantly
  const distTravelled = Math.hypot(eci1.x - eci0.x, eci1.y - eci0.y, eci1.z - eci0.z);
  assert.ok(distTravelled > 7000, `Satellite must travel around Earth, dist=${distTravelled.toFixed(0)} km`);
});

test('Orbital Kinematics P0-07: topocentric look angles, elevation, azimuth and Doppler shift', () => {
  const s3 = AUTHENTIC_DATED_TLES.SENTINEL_3A;
  const el = parseTle(s3.name, s3.line1, s3.line2);

  // Ground station in Valencia, Spain (39.4699° N, -0.3763° E, 15m alt)
  const observer = { lat: 39.4699, lon: -0.3763, altKm: 0.015 };
  const angles = lookAngles(el, observer, el.epoch);

  assert.ok(typeof angles.azimuthDeg === 'number');
  assert.ok(angles.azimuthDeg >= 0 && angles.azimuthDeg <= 360, `Azimuth should be [0, 360], got ${angles.azimuthDeg}`);
  assert.ok(typeof angles.elevationDeg === 'number');
  assert.ok(angles.elevationDeg >= -90 && angles.elevationDeg <= 90);
  assert.ok(angles.rangeKm > 700, `Slant range must exceed satellite altitude, got ${angles.rangeKm}`);
  assert.ok(typeof angles.rangeRateKmS === 'number');

  // Doppler shift calculation at L-band (1.621 GHz)
  const dopplerHz = angles.computeDopplerShiftHz(1.621e9);
  assert.ok(Number.isFinite(dopplerHz));
  // Doppler shift at 1.62 GHz in LEO is max ±40 kHz
  assert.ok(Math.abs(dopplerHz) < 50_000, `Doppler shift should be within ±50 kHz, got ${dopplerHz} Hz`);
});
