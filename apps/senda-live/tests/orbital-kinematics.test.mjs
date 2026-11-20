import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ILLUSTRATIVE_TLES,
  TLE_CHECKSUM_VALID,
  parseTle,
  propagateKeplerJ2,
  lookAngles,
} from '../web/src/science/orbital-kinematics.mjs';

test('Orbital Kinematics P0-07: illustrative TLEs parse into plausible LEO orbits (not real ephemerides)', () => {
  const keys = Object.keys(ILLUSTRATIVE_TLES);
  assert.ok(keys.includes('SENTINEL_3A'));
  assert.ok(keys.includes('TERRA'));
  assert.ok(keys.includes('SUOMI_NPP'));
  assert.ok(keys.includes('ISS'));

  for (const [key, t] of Object.entries(ILLUSTRATIVE_TLES)) {
    const el = parseTle(t.name, t.line1, t.line2);
    assert.equal(el.norad, t.norad);
    assert.ok(el.epoch > Date.parse('2025-01-01T00:00:00Z'));
    assert.ok(el.nRevDay > 14 && el.nRevDay < 16.5, `LEO mean motion should be 14-16 rev/day, got ${el.nRevDay}`);
    assert.ok(el.ecc >= 0 && el.ecc < 0.05, `LEO orbits should be near circular, got ${el.ecc}`);
    assert.ok(el.inc > 0.8 && el.inc < 1.8, `LEO inclination in rad should be realistic, got ${el.inc}`);
    assert.equal(t.basis, 'ILLUSTRATIVE', `${key} must be declared as illustrative`);
  }
});

test('Orbital Kinematics P0-07: Kepler J2 propagation computes physically valid ECI coordinates', () => {
  const s3 = ILLUSTRATIVE_TLES.SENTINEL_3A;
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
  const s3 = ILLUSTRATIVE_TLES.SENTINEL_3A;
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

test('Veracidad: TLE_CHECKSUM_VALID implementa la suma de control estándar', () => {
  // Líneas reales de la ISS copiadas literalmente de AMSAT nasabare.txt descargado el 20-11-2026
  // (investor-next/public/senda/data/tle/amsat-nasabare-2026-11-20.txt, commit 1d52e6e;
  // sha256 del fichero en el .json hermano).
  const l1 = '1 25544U 98067A   26323.26944508  .00013909  00000-0  25567-3 0  9994';
  const l2 = '2 25544  51.6317 252.6441 0007411  42.3196 317.8363 15.49482233595794';
  assert.equal(TLE_CHECKSUM_VALID(l1), true);
  assert.equal(TLE_CHECKSUM_VALID(l2), true);
  // Cambiar un solo dígito rompe la suma.
  assert.equal(TLE_CHECKSUM_VALID(l1.slice(0, 68) + '5'), false);
  assert.equal(TLE_CHECKSUM_VALID(l2.replace('51.6317', '51.6318')), false);
  // '-' cuenta 1 y '+' cuenta 0: cambiar el signo del exponente (columna 51) de '-' a '+' resta 1
  // a la suma, así que la línea solo vuelve a ser válida si el dígito de control baja 1 (4 → 3).
  assert.equal(l1[50], '-');
  const plus = l1.slice(0, 50) + '+' + l1.slice(51, 68);
  assert.equal(TLE_CHECKSUM_VALID(plus + '4'), false);
  assert.equal(TLE_CHECKSUM_VALID(plus + '3'), true);
  // Entradas no válidas.
  assert.equal(TLE_CHECKSUM_VALID(''), false);
  assert.equal(TLE_CHECKSUM_VALID(undefined), false);
});

test('Veracidad: los TLE ilustrativos NO pasan la suma de control (no son efemérides reales)', () => {
  const lines = Object.values(ILLUSTRATIVE_TLES).flatMap((t) => [t.line1, t.line2]);
  assert.equal(lines.length, 8);
  const invalid = lines.filter((l) => !TLE_CHECKSUM_VALID(l));
  // Auditoría del 20-11-2026: 7 de 8 inválidas (solo la línea 2 de TERRA pasa por azar).
  assert.equal(invalid.length, 7);
  assert.equal(TLE_CHECKSUM_VALID(ILLUSTRATIVE_TLES.TERRA.line2), true);
  // Épocas redondeadas: ninguna de las cuatro es una época real con fracción de día medida.
  for (const t of Object.values(ILLUSTRATIVE_TLES)) {
    assert.equal(t.line1.slice(18, 32), '26308.50000000');
  }
});
