import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computePercolationThreshold,
  computeDtnEpidemicSpreading,
  computeFresnelV,
  computeKnifeEdgeLossDb,
  computeDeygoutDiffractionLoss,
  computeRainAttenuation,
  computeCompleteLinkBudget,
  computeFadingOutageAndCapacity,
  computeSatelliteDopplerKinematics,
} from '../src/telecom-mathematical-physics.mjs';

test('Percolation: computes exact critical density and phase transition state', () => {
  // Effective range = 1000m (1 km)
  const perc1km = computePercolationThreshold(1000);
  assert.equal(perc1km.etaC, 4.512);
  // lambda_c = 4.512 / (pi * 1^2) ≈ 1.436 nodes/km2
  assert.ok(Math.abs(perc1km.criticalDensityKm2 - 1.436) < 0.01);

  // Subcritical regime: 0.5 nodes/km2 -> no giant component
  const sub = perc1km.percolationState(0.5);
  assert.equal(sub.isPercolating, false);
  assert.ok(sub.densityRatio < 1.0);
  assert.equal(sub.giantComponentEstimate, 0);

  // Supercritical regime: 3.0 nodes/km2 -> giant component emerges
  const superCrit = perc1km.percolationState(3.0);
  assert.equal(superCrit.isPercolating, true);
  assert.ok(superCrit.densityRatio > 1.0);
  assert.ok(superCrit.giantComponentEstimate > 0.6);
});

test('DTN Epidemic Spreading: calculates R0, delivery percentiles and extinction probability', () => {
  const dtn = computeDtnEpidemicSpreading(100, 2.5, 24, 0.01);
  assert.ok(dtn.r0 > 1.0, 'R0 must be greater than 1 for emergency epidemic dissemination');
  assert.ok(dtn.epidemicGrowthRate > 0);
  assert.ok(dtn.t50Hours > 0 && dtn.t50Hours < dtn.t90Hours);
  assert.ok(dtn.t90Hours < dtn.t99Hours);
  assert.ok(dtn.extinctionProb < 0.2);

  // Invalid parameters throw TypeError
  assert.throws(() => computeDtnEpidemicSpreading(1, 0, 0), TypeError);
});

test('Diffraction: Fresnel v, knife-edge loss and multi-obstacle Deygout reduction', () => {
  // Single knife edge: h = 25m, d1 = 2000m, d2 = 2000m, freq = 868 MHz (lambda ≈ 0.345m)
  const wavelength = 299792458 / 868e6;
  const v = computeFresnelV(25, 2000, 2000, wavelength);
  assert.ok(v > 1.0);
  const lossDb = computeKnifeEdgeLossDb(v);
  assert.ok(lossDb > 12.0 && lossDb < 30.0, 'Knife edge diffraction loss must be within 12-30 dB');

  // Deygout multi-obstacle profile: Tx=100m, Rx=100m, Total=5000m, 868 MHz
  const terrainProfile = [
    { distanceM: 1000, elevationM: 80 },  // clearance
    { distanceM: 2500, elevationM: 140 }, // main ridge (40m above LOS)
    { distanceM: 3500, elevationM: 125 }, // secondary ridge (25m above LOS)
  ];
  const deygout = computeDeygoutDiffractionLoss(terrainProfile, 100, 100, 5000, 868e6);
  assert.equal(deygout.mainObstacleIndex, 1);
  assert.ok(deygout.totalDiffractionLossDb >= deygout.components.lossMainDb);
  assert.ok(deygout.components.lossRightDb > 0);
});

test('Rain Attenuation: ITU-R P.838 frequency-dependent specific loss', () => {
  // 868 MHz should have virtually zero rain loss (< 0.001 dB/km) even in torrential rain (50 mm/h)
  const rainUhf = computeRainAttenuation(0.868, 50);
  assert.ok(rainUhf.specificAttenuationDbPerKm < 0.01);

  // 5.8 GHz has noticeable rain loss in torrential rain
  const rain58 = computeRainAttenuation(5.8, 50);
  assert.ok(rain58.specificAttenuationDbPerKm > 0.1);
  assert.ok(rain58.pathAttenuationDb(10) > 0.5);

  // Ka-band (28 GHz) has severe attenuation (> 3 dB/km) in cloudburst
  const rainKa = computeRainAttenuation(28.0, 50);
  assert.ok(rainKa.specificAttenuationDbPerKm > 3.0);
});

test('Fading: Nakagami-m outage and Shannon capacity', () => {
  // SNR = 10 (10 dB), Threshold = 2 (3 dB), B = 125 kHz
  const rayleigh = computeFadingOutageAndCapacity(10, 2, 125000, 1.0); // m=1
  assert.ok(rayleigh.outageProbability > 0 && rayleigh.outageProbability < 0.5);
  assert.ok(rayleigh.shannonCapacityBps > 125000);
  assert.ok(rayleigh.reliabilityPercentage > 50);

  // With Rician LOS (m=4.0), outage drops dramatically compared to Rayleigh
  const rician = computeFadingOutageAndCapacity(10, 2, 125000, 4.0);
  assert.ok(rician.outageProbability < rayleigh.outageProbability);
  assert.ok(rician.reliabilityPercentage > rayleigh.reliabilityPercentage);
});

test('Satellite Doppler: orbital velocity, shift and PLL loop bandwidth', () => {
  // 437 MHz UHF CubeSat pass at 550 km
  const sat = computeSatelliteDopplerKinematics(437e6, 550, 45);
  assert.ok(sat.vOrbitKmS > 7.5 && sat.vOrbitKmS < 7.7);
  assert.ok(sat.maxDopplerShiftHz > 7000 && sat.maxDopplerShiftHz < 15000);
  assert.ok(sat.minPllLoopBandwidthHz > 20);
  // At 45° elevation, Doppler shift is around 6-7 kHz -> exceeds 5 kHz COTS limit
  assert.equal(typeof sat.isNarrowbandCotsFeasible, 'boolean');
});

test('Rain Attenuation: ITU-R P.838-3 continuity and polarization tests', () => {
  // Test continuity at the previous discontinuity boundary (6.00 GHz vs 6.01 GHz at 20 mm/h)
  const rain600 = computeRainAttenuation(6.00, 20, 'V');
  const rain601 = computeRainAttenuation(6.01, 20, 'V');
  const relativeDiff = Math.abs(rain601.specificAttenuationDbPerKm - rain600.specificAttenuationDbPerKm) / rain600.specificAttenuationDbPerKm;

  // The relative difference must be less than 1.5% (smooth continuity, no step jump)
  assert.ok(relativeDiff < 0.015, `Continuity failed: relative jump was ${(relativeDiff * 100).toFixed(2)}%`);
  assert.ok(rain600.specificAttenuationDbPerKm > 0.04 && rain600.specificAttenuationDbPerKm < 0.07);

  // Horizontal polarization has higher specific attenuation than vertical polarization on terrestrial path
  const rain10H = computeRainAttenuation(10.0, 30, 'H');
  const rain10V = computeRainAttenuation(10.0, 30, 'V');
  assert.ok(rain10H.specificAttenuationDbPerKm > rain10V.specificAttenuationDbPerKm, 'Horizontal loss must exceed vertical loss');

  // Circular polarization attenuation is intermediate between H and V
  const rain10Circ = computeRainAttenuation(10.0, 30, 'CIRCULAR');
  assert.ok(
    rain10Circ.specificAttenuationDbPerKm >= rain10V.specificAttenuationDbPerKm &&
    rain10Circ.specificAttenuationDbPerKm <= rain10H.specificAttenuationDbPerKm,
    'Circular polarization loss must lie between V and H'
  );

  // For horizontal polarization, increasing elevation angle tilts towards circular cross-section, reducing specific loss
  const rainSlant45H = computeRainAttenuation(12.0, 25, 'H', 45);
  const rainHorizH = computeRainAttenuation(12.0, 25, 'H', 0);
  assert.ok(rainSlant45H.specificAttenuationDbPerKm <= rainHorizH.specificAttenuationDbPerKm, 'Slant path for H polarization must have lower or equal specific loss');

  // For vertical polarization, path attenuation over slant path includes reduction in rain cell path length
  const rainSlant45V = computeRainAttenuation(12.0, 25, 'V', 45);
  assert.ok(rainSlant45V.specificAttenuationDbPerKm > 0);
});

test('Link Budget: complete end-to-end telecom budget and regulatory compliance', () => {
  // LoRa 868.1 MHz link over 4 km with 6 dB terrain diffraction loss
  const loraLink = computeCompleteLinkBudget({
    txPowerDbm: 14.0,       // 25 mW ETSI limit
    txAntennaGainDbi: 2.15, // dipole
    txCableLossDb: 0.5,
    rxAntennaGainDbi: 2.15,
    rxCableLossDb: 0.5,
    frequencyHz: 868.1e6,
    distanceM: 4000,
    diffractionLossDb: 6.0,
    rainRateMmHr: 20,
    bandwidthHz: 125e3,
    rxNoiseFigureDb: 6.0,
    rxSensitivityDbm: -137.0, // LoRa SF12 sensitivity
    requiredFadeMarginDb: 10.0,
  });

  assert.equal(loraLink.isRegulatoryCompliant, true);
  assert.ok(loraLink.eirpDbm <= 15.65);
  assert.ok(loraLink.fsplDb > 100 && loraLink.fsplDb < 110);
  assert.ok(loraLink.fadeMarginDb > 10.0, 'LoRa SF12 should maintain healthy fade margin at 4km with 6dB diffraction');
  assert.equal(loraLink.linkStatus, 'VIABLE');

  // Wi-Fi 2.4 GHz link over 1500m with 25 dB severe obstacle diffraction loss -> Outage
  const wifiLink = computeCompleteLinkBudget({
    txPowerDbm: 20.0,
    txAntennaGainDbi: 3.0,
    txCableLossDb: 1.0,
    rxAntennaGainDbi: 3.0,
    rxCableLossDb: 1.0,
    frequencyHz: 2.437e9,
    distanceM: 1500,
    diffractionLossDb: 25.0,
    rainRateMmHr: 30,
    bandwidthHz: 20e6,
    rxNoiseFigureDb: 7.0,
    rxSensitivityDbm: -85.0,
    requiredFadeMarginDb: 10.0,
  });

  assert.equal(wifiLink.isRegulatoryCompliant, false); // 20 + 3 - 1 = 22 dBm > 20 dBm ETSI limit
  assert.equal(wifiLink.linkStatus, 'OUTAGE');
  assert.equal(wifiLink.isViable, false);
});

