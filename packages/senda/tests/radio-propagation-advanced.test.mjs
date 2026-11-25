import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  friisFreeSpaceLossDb,
  ituKnifeEdgeLossDb,
  sphericalEarthDiffractionDb,
  deltaBullingtonP526,
  epsteinPetersonDiffraction,
  itmLongleyRiceTerrainSummary,
  ituP2108ClutterLossDb,
  ituP833VegetationLossDb,
  sampleDemProfile,
  evaluateMeshLinkWithUncertainty,
} from '../src/radio-propagation-advanced.mjs';

test('Verificación analítica: Friis FSPL, filo de cuchillo ITU-R P.526-15 J(v) y obstrucción geométrica', () => {
  // Friis a 1 km y 868 MHz: 20*log10(4*pi*1000*868e6/299792458) = 91.22 dB
  const fspl = friisFreeSpaceLossDb(1000, 868e6);
  assert.ok(Math.abs(fspl - 91.22) < 0.05, `FSPL=${fspl}`);

  // Filo de cuchillo ITU-R P.526-15 §4.2:
  // v = -1 -> 0 dB; v = 0 (rayo rasante) -> 6.03 dB (exacto teórico 6.02 dB); v = 1 -> ~13.86 dB
  assert.equal(ituKnifeEdgeLossDb(-1.0), 0);
  assert.ok(Math.abs(ituKnifeEdgeLossDb(0) - 6.03) < 0.08, `J(0)=${ituKnifeEdgeLossDb(0)}`);
  assert.ok(Math.abs(ituKnifeEdgeLossDb(1.0) - 13.86) < 0.15, `J(1)=${ituKnifeEdgeLossDb(1.0)}`);

  // Perfil plano despejado vs perfil con cresta central de 80 m a 5 km (868 MHz)
  const flat = Array.from({ length: 51 }, (_, i) => ({ dM: i * 100, zM: 100 }));
  const ridge = flat.map((p, i) => ({ dM: p.dM, zM: i === 25 ? 180 : 100 }));

  const dbFlat = deltaBullingtonP526(flat, { freqHz: 868e6, hTxAglM: 10, hRxAglM: 10, kFactor: 4 / 3 });
  const dbRidge = deltaBullingtonP526(ridge, { freqHz: 868e6, hTxAglM: 10, hRxAglM: 10, kFactor: 4 / 3 });
  const epRidge = epsteinPetersonDiffraction(ridge, { freqHz: 868e6, hTxAglM: 10, hRxAglM: 10, kFactor: 4 / 3 });

  assert.equal(dbFlat.isTranshorizon, false);
  assert.equal(dbRidge.isTranshorizon, true);
  assert.ok(dbRidge.diffractionLossDb > dbFlat.diffractionLossDb + 20, 'la cresta de 80 m debe añadir > 20 dB de difracción');
  assert.ok(epRidge.diffractionLossDb > 18, `Epstein-Peterson en cresta=${epRidge.diffractionLossDb} dB`);
});

test('Difracción esférica, clutter ITU-R P.2108-1 y vegetación ITU-R P.833-10', () => {
  const sphNear = sphericalEarthDiffractionDb({ distanceM: 5000, freqHz: 868e6, hTxM: 15, hRxM: 15, kFactor: 4 / 3 });
  const sphFar = sphericalEarthDiffractionDb({ distanceM: 60000, freqHz: 868e6, hTxM: 15, hRxM: 15, kFactor: 4 / 3 });
  assert.ok(sphFar > sphNear, `difracción esférica a 60 km (${sphFar} dB) > 5 km (${sphNear} dB)`);

  // Clutter ITU-R P.2108-1 aumenta con la frecuencia (868 MHz vs 5.8 GHz)
  const cl868 = ituP2108ClutterLossDb({ freqGhz: 0.868, distanceKm: 2, locationPct: 50 });
  const cl5800 = ituP2108ClutterLossDb({ freqGhz: 5.8, distanceKm: 2, locationPct: 50 });
  assert.ok(cl5800.lossDb > cl868.lossDb);

  // Vegetación ITU-R P.833-10 satura asintóticamente en maxAttenDb
  const v20 = ituP833VegetationLossDb({ depthM: 20, specificAttenDbM: 0.4, maxAttenDb: 18 });
  const v500 = ituP833VegetationLossDb({ depthM: 500, specificAttenDbM: 0.4, maxAttenDb: 18 });
  assert.ok(v20.lossDb > 0 && v20.lossDb < v500.lossDb && v500.lossDb <= 18);
});

test('Caso real con MDE abierto del Poyo (radio/poyo.json): enlace LoRa 868 MHz Chiva ↔ Paiporta y Chiva ↔ Buñol con horquilla de refractividad k', () => {
  const poyo = JSON.parse(readFileSync(new URL('../../../investor-next/public/senda/data/radio/poyo.json', import.meta.url), 'utf8'));
  const byName = (name) => poyo.municipios.find((m) => m.nombre === name);
  const chiva = byName('Chiva');
  const paiporta = byName('Paiporta');
  const bunol = byName('Buñol');

  const profChivaPaiporta = sampleDemProfile(poyo.dem, [chiva.lon, chiva.lat], [paiporta.lon, paiporta.lat], 120);
  const profChivaBunol = sampleDemProfile(poyo.dem, [chiva.lon, chiva.lat], [bunol.lon, bunol.lat], 100);

  // Enlace LoRa EU868 (14 dBm ERP, antenas 2 dBi, sensibilidad SF11 -134 dBm, 6 m sobre suelo)
  const linkSpec = {
    freqHz: 868.1e6,
    hTxAglM: 6,
    hRxAglM: 6,
    txPowerDbm: 14,
    txGainDbi: 2,
    rxGainDbi: 2,
    rxSensitivityDbm: -134,
    kMin: 2 / 3,
    kNom: 4 / 3,
    kMax: 2.0,
  };

  const resPaiporta = evaluateMeshLinkWithUncertainty(profChivaPaiporta, linkSpec);
  const resBunol = evaluateMeshLinkWithUncertainty(profChivaBunol, linkSpec);

  assert.equal(resPaiporta.basis, 'MODEL');
  assert.ok(resPaiporta.distanceKm > 20 && resPaiporta.distanceKm < 35, `distancia Chiva-Paiporta=${resPaiporta.distanceKm} km`);
  assert.ok(resPaiporta.itmTerrain.deltaHM > 10, `Δh real debe reflejar desnivel de la cuenca (${resPaiporta.itmTerrain.deltaHM} m)`);
  // Orden físico de la horquilla de refractividad: subrefracción (k=2/3) ≤ estándar (4/3) ≤ superrefracción (2.0)
  assert.ok(resPaiporta.marginHorquillaDb.minSubrefraction <= resPaiporta.marginHorquillaDb.nominal + 0.05);
  assert.ok(resPaiporta.marginHorquillaDb.nominal <= resPaiporta.marginHorquillaDb.maxSuperrefraction + 0.05);

  const itmBunol = itmLongleyRiceTerrainSummary(profChivaBunol, { hTxAglM: 6, hRxAglM: 6, kFactor: 4 / 3 });
  assert.ok(itmBunol.distanceM > 5000 && resBunol.nominal.totalLossDb > 90);
});

test('Regla de veracidad: exige kFactor, alturas y frecuencia obligatorios', () => {
  const prof = [{ dM: 0, zM: 10 }, { dM: 500, zM: 20 }, { dM: 1000, zM: 10 }];
  assert.throws(() => deltaBullingtonP526(prof, { freqHz: 868e6, hTxAglM: 5, hRxAglM: 5 }), /kFactor/);
  assert.throws(() => evaluateMeshLinkWithUncertainty(prof, { freqHz: 868e6, hTxAglM: 5, hRxAglM: 5, txPowerDbm: 14, txGainDbi: 2, rxGainDbi: 2, rxSensitivityDbm: -130, kMin: 1.5, kNom: 1.3, kMax: 2.0 }), /kMin < kNom < kMax/);
  assert.throws(() => ituP2108ClutterLossDb({ freqGhz: 0.1, distanceKm: 1, locationPct: 50 }), /0,5 ≤ freqGhz/);
});
