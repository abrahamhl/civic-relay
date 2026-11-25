import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCOTT_BURGAN_MODELS,
  rothermelSpread,
  fireEllipseLengthToBreadth,
  computeHuygensEllipse,
  createLevelSetFireSim,
  runLevelSetFireUntil,
  runFireEnsemble,
} from '../src/fire-rothermel.mjs';

const DRY_ENV = {
  dead1hMoisture: 0.06,
  dead10hMoisture: 0.07,
  dead100hMoisture: 0.08,
  liveHerbMoisture: 0.60,
  liveWoodyMoisture: 0.90,
  midflameWindMs: 2.235, // 5 mi/h (referencia habitual en tablas Scott & Burgan 2005)
  slopeDeg: 0,
};

test('Rothermel (1972) + Scott & Burgan (2005): consistencia física, orden de modelos y extinción por humedad', () => {
  const gr2 = rothermelSpread('GR2', DRY_ENV);
  const gr4 = rothermelSpread('GR4', DRY_ENV);
  const sh5 = rothermelSpread('SH5', DRY_ENV);
  const tl1 = rothermelSpread('TL1', DRY_ENV);
  const nb8 = rothermelSpread('NB8', DRY_ENV);

  assert.equal(gr2.basis, 'MODEL');
  assert.equal(nb8.burnable, false);
  assert.equal(nb8.rosMs, 0);

  // Orden físico publicado en Scott & Burgan (2005) a 5 mph / escenario D2L2:
  // Pasto alto GR4 > pasto moderado GR2 > hojarasca compacta TL1; matorral alto SH5 > TL1 en llama e intensidad
  assert.ok(gr4.rosMMin > gr2.rosMMin, `GR4 (${gr4.rosMMin}) debe superar a GR2 (${gr2.rosMMin})`);
  assert.ok(gr2.rosMMin > tl1.rosMMin, `GR2 (${gr2.rosMMin}) debe superar a TL1 (${tl1.rosMMin})`);
  assert.ok(sh5.flameLengthM > tl1.flameLengthM, `SH5 llama (${sh5.flameLengthM} m) > TL1 (${tl1.flameLengthM} m)`);
  // Rango publicado para GR2 seco con 5 mph (2.235 m/s): ~15–45 ch/h (~5–15 m/min)
  assert.ok(gr2.rosMMin > 3 && gr2.rosMMin < 30, `GR2 rosMMin=${gr2.rosMMin} fuera de orden físico`);

  // Extinción por humedad >= Mx
  const wet = rothermelSpread('GR2', { ...DRY_ENV, dead1hMoisture: 0.20, liveHerbMoisture: 1.50 });
  assert.equal(wet.rosMs, 0, 'por encima de humedad de extinción la propagación muerta/viva debe anularse');

  // Sensibilidad monótona a viento y pendiente
  const calm = rothermelSpread('SH2', { ...DRY_ENV, midflameWindMs: 0, slopeDeg: 0 });
  const windy = rothermelSpread('SH2', { ...DRY_ENV, midflameWindMs: 4.5, slopeDeg: 0 });
  const steep = rothermelSpread('SH2', { ...DRY_ENV, midflameWindMs: 0, slopeDeg: 25 });
  assert.ok(windy.rosMs > calm.rosMs && windy.windFactorPhiW > 0);
  assert.ok(steep.rosMs > calm.rosMs && steep.slopeFactorPhiS > 0);

  // Transferencia dinámica herbácea (curado 30% arde más rápido que verde 120%)
  const cured = rothermelSpread('GR2', { ...DRY_ENV, liveHerbMoisture: 0.30 });
  const green = rothermelSpread('GR2', { ...DRY_ENV, liveHerbMoisture: 1.20 });
  assert.ok(cured.rosMs > green.rosMs, `curado (${cured.rosMs}) debe propagar más rápido que verde (${green.rosMs})`);
});

test('Verificación analítica: expansión circular isotrópica (viento=0, pendiente=0) y convergencia O(dx) en Level-Set 2D', () => {
  const wx = { ...DRY_ENV, midflameWindMs: 0, windToDeg: 90 };
  const r0 = rothermelSpread('SH5', { ...wx, slopeDeg: 0 }).rosMs;
  assert.ok(r0 > 0);
  const rInit = 40;
  const tEnd = 2400; // 40 min
  const rExact = rInit + r0 * tEnd;

  const measureRadius = (dx) => {
    const half = Math.ceil(150 / dx);
    const w = 2 * half + 1, h = 2 * half + 1;
    const fuelGrid = new Array(w * h).fill('SH5');
    const sim = createLevelSetFireSim({ w, h, dx, fuelGrid, ignition: { i: half, j: half, radiusM: rInit } });
    runLevelSetFireUntil(sim, tEnd, wx, { dtMax: 15 });
    // Radio subcelda por interpolación lineal del cruce φ = 0 en los 4 ejes cardinales
    const cross = (di, dj) => {
      for (let step = 1; step < half - 1; step++) {
        const pPrev = sim.phi[(half + (step - 1) * dj) * w + (half + (step - 1) * di)];
        const pCurr = sim.phi[(half + step * dj) * w + (half + step * di)];
        if (pPrev <= 0 && pCurr > 0) {
          const frac = -pPrev / (pCurr - pPrev);
          return (step - 1 + frac) * dx;
        }
      }
      return 0;
    };
    const rE = cross(1, 0), rW = cross(-1, 0), rN = cross(0, -1), rS = cross(0, 1);
    return { rE, rW, rN, rS, err: Math.abs(rE - rExact) / rExact };
  };

  const coarse = measureRadius(10);
  const fine = measureRadius(5);
  assert.ok(Math.abs(coarse.rE - coarse.rW) < 1e-6 && Math.abs(coarse.rE - coarse.rN) < 1e-6, 'isotropía axial exacta');
  assert.ok(coarse.err < 0.05, `error radial dx=10m=${(coarse.err * 100).toFixed(2)}%`);
  assert.ok(fine.err < coarse.err, `el refinamiento dx=5m (${(fine.err * 100).toFixed(2)}%) debe reducir el error frente a dx=10m (${(coarse.err * 100).toFixed(2)}%)`);
  assert.ok(fine.err < 0.03, `error radial dx=5m=${(fine.err * 100).toFixed(2)}%`);
});

test('Verificación analítica: elipse de Huygens con viento (Finney 1998) y cortafuegos no combustible NB8', () => {
  const lb0 = fireEllipseLengthToBreadth(0);
  const lb5 = fireEllipseLengthToBreadth(5);
  assert.ok(Math.abs(lb0 - 1.0) < 0.01);
  assert.ok(lb5 > 2.5 && lb5 <= 8.0);

  const w = 71, h = 51, dx = 20;
  const fuelGrid = new Array(w * h).fill('GR2');
  // Barrera cortafuegos / río de 2 celdas de ancho al oeste de la ignición (i = 20..21)
  for (let j = 0; j < h; j++) {
    fuelGrid[j * w + 20] = 'NB8';
    fuelGrid[j * w + 21] = 'NB8';
  }
  const wx = { ...DRY_ENV, midflameWindMs: 3.0, windToDeg: 90 }; // viento soplando hacia el Este (+x)
  const ell = computeHuygensEllipse('GR2', { ...wx, slopeDeg: 0 }, { windToDeg: 90 });
  assert.ok(ell.headRosMs > ell.flankRosMs && ell.flankRosMs > ell.backRosMs);

  const sim = createLevelSetFireSim({ w, h, dx, fuelGrid, ignition: { i: 25, j: 25, radiusM: 20 } });
  runLevelSetFireUntil(sim, 360, wx, { dtMax: 15 });

  // El frente debe avanzar mucho más hacia el Este (cabeza) que hacia el Norte/Sur (flanco) y NO cruzar el río al Oeste
  let maxE = 0, maxN = 0;
  for (let i = 25; i < w; i++) if (sim.phi[25 * w + i] <= 0) maxE = (i - 25) * dx;
  for (let j = 25; j >= 0; j--) if (sim.phi[j * w + 25] <= 0) maxN = (25 - j) * dx;
  assert.ok(maxE > maxN * 1.4, `avance en cabeza (${maxE} m) debe superar claramente el flanco (${maxN} m)`);
  // Nada al oeste de la barrera NB8 (i < 20) debe haberse quemado
  let crossedBarrier = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < 20; i++) if (sim.phi[j * w + i] <= 0) crossedBarrier++;
  assert.equal(crossedBarrier, 0, 'el fuego no debe cruzar una barrera NB8 sin pavesas');
});

test('Caso real SMV 2026 (datos abiertos locales: dem_100m, fuel_100m, burn_100m, GFS) + conjunto probabilista LHS', () => {
  const base = new URL('../../../investor-next/public/senda/data/smv2026/', import.meta.url);
  const f3d = JSON.parse(readFileSync(new URL('fire3d.json', base), 'utf8'));
  const gfs = JSON.parse(readFileSync(new URL('gfs_20260723_12z.json', base), 'utf8'));
  const demBuf = readFileSync(new URL('dem_100m.bin', base));
  const demFull = new Int16Array(demBuf.buffer, demBuf.byteOffset, demBuf.byteLength / 2);
  const fuelFull = readFileSync(new URL('fuel_100m.bin', base));
  const burnFull = readFileSync(new URL('burn_100m.bin', base));

  // Recorte centrado en la ignición (204, 134) de 90×90 celdas (9 km × 9 km a 100 m) para prueba rápida reproducible
  const Wfull = f3d.malla.w;
  const i0 = 165, j0 = 95, w = 90, h = 90, dx = 100;
  const dem = new Float32Array(w * h);
  const fuelGrid = new Array(w * h);
  const obsDay1 = new Uint8Array(w * h);
  // Mapeo explícito y documentado de clases NDVI de SENDA (0..4) a modelos Scott & Burgan (2005) mediterráneos:
  // 0=agua→NB8, 1=pasto→GR2, 2=matorral→SH5, 3=arbolado→TU2, 4=urbano/sin veg→NB1
  const CLASS_TO_SB = ['NB8', 'GR2', 'SH5', 'TU2', 'NB1'];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const kf = (j0 + j) * Wfull + (i0 + i);
      const k = j * w + i;
      dem[k] = demFull[kf];
      fuelGrid[k] = CLASS_TO_SB[fuelFull[kf]] ?? 'NB9';
      obsDay1[k] = (burnFull[kf] & 1) ? 1 : 0;
    }
  }

  // Extraer viento REAL a 10 m y HR a 2 m de NOAA GFS (run 2026-07-23 12Z, fhour=3 = 15Z) en punto más cercano a (40.36°N, -4.38°W) → lat idx 3 (40.25), lon idx 3 (-4.5)
  const gfsEntry = gfs.times.find((t) => t.fhour === 3) ?? gfs.times[0];
  const u10 = gfsEntry.fields['UGRD@10 m above ground'][3][3];
  const v10 = gfsEntry.fields['VGRD@10 m above ground'][3][3];
  const rh2m = gfsEntry.fields['RH@2 m above ground'][3][3];
  assert.ok(Number.isFinite(u10) && Number.isFinite(v10) && Number.isFinite(rh2m));
  // Factor de reducción viento 10 m → media llama (Albini & Baughman 1979: 0,4 en matorral/pasto expuesto)
  const wind10Ms = Math.hypot(u10, v10);
  const midflameWindMs = 0.4 * wind10Ms;
  const windToDeg = (Math.atan2(u10, v10) * 180 / Math.PI + 360) % 360;
  // Humedad fina muerta derivada de HR real GFS (≈ 7 % → ~3–4 % equilibrio según Simard 1968)
  const m1h = Math.max(0.03, Math.min(0.12, 0.02 + 0.002 * rh2m));

  const ensemble = runFireEnsemble({
    gridConfig: {
      w,
      h,
      dx,
      fuelGrid,
      dem,
      ignition: { i: f3d.ignicion.i - i0, j: f3d.ignicion.j - j0, radiusM: 120 },
    },
    tEndSec: 8 * 3600, // 8 horas de propagación vespertina/nocturna
    baseWeather: {
      dead1hMoisture: m1h,
      dead10hMoisture: m1h + 0.02,
      dead100hMoisture: m1h + 0.04,
      liveHerbMoisture: 0.60,
      liveWoodyMoisture: 0.85,
      midflameWindMs,
      windToDeg,
    },
    perturbation: {
      windSpeedMultMin: 0.65,
      windSpeedMultMax: 1.35,
      windDirDeltaDeg: 35,
      deadMoistureDelta: 0.015,
    },
    members: 6,
    seed: 20260723,
    dtMax: 120,
  });

  assert.equal(ensemble.basis, 'MODEL');
  assert.equal(ensemble.members, 6);
  assert.ok(ensemble.burnedHa.p10 <= ensemble.burnedHa.p50 && ensemble.burnedHa.p50 <= ensemble.burnedHa.p90);
  assert.ok(ensemble.burnedHa.p50 > 50, `área mediana esperada > 50 ha, obtenida ${ensemble.burnedHa.p50} ha`);
  // Verificar que la cicatriz real Sentinel-2 del 24-07 tiene intersección no nula con la envolvente probabilista
  let overlapCells = 0;
  for (let k = 0; k < w * h; k++) {
    if (obsDay1[k] && ensemble.probBurn[k] > 0) overlapCells++;
  }
  assert.ok(overlapCells > 0, 'el conjunto probabilista debe solapar parte de la cicatriz observada Sentinel-2');
});

test('Regla de veracidad: exige humedades, viento y pendiente obligatorios y rechaza modelos inexistentes', () => {
  assert.throws(() => rothermelSpread('GR2', { midflameWindMs: 2, slopeDeg: 0 }), /dead1hMoisture/);
  assert.throws(() => rothermelSpread('GR2', { dead1hMoisture: 0.06, dead10hMoisture: 0.07, dead100hMoisture: 0.08, liveHerbMoisture: 0.6, liveWoodyMoisture: 0.9, slopeDeg: 0 }), /midflameWindMs/);
  assert.throws(() => rothermelSpread('MODELO_INVENTADO', DRY_ENV), /desconocido/);
  assert.ok(Object.keys(SCOTT_BURGAN_MODELS).length >= 20);
});
