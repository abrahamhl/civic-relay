import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seededNormalRng,
  filterAssimilableObservations,
  gaspariCohnWeight,
  enkfUpdate,
  runFloodAssimilationExperiment,
  assimilateFireFrontObservations,
} from '../src/data-assimilation.mjs';

test('Gaspari & Cohn (1999): valores exactos en r=0, r=c y soporte compacto r ≥ 2c', () => {
  assert.equal(gaspariCohnWeight(0, 100), 1);
  // En r = c (z = 1): 1 - 1/4 + 1/2 + 5/8 - 5/3 = 5/24 ≈ 0.208333...
  assert.ok(Math.abs(gaspariCohnWeight(100, 100) - 5 / 24) < 1e-12);
  assert.equal(gaspariCohnWeight(200, 100), 0);
  assert.equal(gaspariCohnWeight(500, 100), 0);
  assert.ok(gaspariCohnWeight(50, 100) > gaspariCohnWeight(100, 100));
});

test('verificación analítica: EnKF lineal-gaussiano reproduce el filtro de Kalman exacto', () => {
  const rng = seededNormalRng(12345);
  const Ne = 800;
  const muPrior = 10.0, sdPrior = 2.0, yObs = 14.0, sdObs = 1.0;
  const ensemble = Array.from({ length: Ne }, () => [muPrior + sdPrior * rng.normal()]);

  // Media y varianza exactas de la muestra prior
  const meanF = ensemble.reduce((s, x) => s + x[0], 0) / Ne;
  const varF = ensemble.reduce((s, x) => s + (x[0] - meanF) ** 2, 0) / (Ne - 1);
  const Kexact = varF / (varF + sdObs ** 2);
  const muExact = meanF + Kexact * (yObs - meanF);
  const sdExact = Math.sqrt((1 - Kexact) * varF);

  const res = enkfUpdate(
    ensemble,
    [{ id: 'obs-1', level: 'N3', value: yObs, observationStd: sdObs, stateIndex: 0 }],
    { seed: 99 }
  );

  assert.equal(res.assimilatedCount, 1);
  assert.ok(Math.abs(res.kalmanGain[0][0] - Kexact) < 1e-9, `K=${res.kalmanGain[0][0]} vs ${Kexact}`);
  assert.ok(Math.abs(res.analysisMean[0] - muExact) < 1e-9, `mu=${res.analysisMean[0]} vs ${muExact}`);
  assert.ok(Math.abs(res.analysisSpread[0] - sdExact) / sdExact < 0.08, `sd=${res.analysisSpread[0]} vs ${sdExact}`);
});

test('puerta de admisión N2+: rechaza N0, N1, contradichos y observaciones sin observationStd', () => {
  const out = filterAssimilableObservations([
    { id: 'r0', level: 'N0', value: 1.2, observationStd: 0.1 },
    { id: 'r1', level: 'N1', value: 1.2, observationStd: 0.1 },
    { id: 'r2', level: 'N2', value: 1.2, observationStd: 0.1 },
    { id: 'r3', level: 'N3', value: 1.5, observationStd: 0.05 },
    { id: 'r4', level: 'N2', value: 1.2, observationStd: 0.1, contradicted: true },
    { id: 'r5', level: 'N3', value: 1.2 }, // falta observationStd
  ]);
  assert.equal(out.accepted.length, 2);
  assert.deepEqual(out.accepted.map((x) => x.id), ['r2', 'r3']);
  assert.equal(out.rejected.length, 4);
});

test('asimilación hidrodinámica (shallow-water + EnKF): mejora demostrable en CSI, RMSE y horquilla', () => {
  // Valle rectangular con cauce central y llanura de inundación (24×12 celdas de 25 m)
  const w = 24, h = 12, dx = 25;
  const z = new Float32Array(w * h);
  const sink = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const cross = Math.abs(j - 5.5);
      // Pendiente longitudinal + sección transversal en V suave
      z[k] = (w - 1 - i) * 0.18 + (cross <= 1 ? 0 : (cross - 1) * 0.32);
      if (i === w - 1) sink[k] = 1;
    }
  }
  const inflowCells = [5 * w + 0, 6 * w + 0];
  const baseHydrograph = [[0, 0], [300, 55], [1200, 75], [2400, 10]];
  // Realidad: hidrograma 1,9× mayor que la estimación inicial (subestimada)
  const truthParams = { inflowScale: 1.9, manningN: 0.045 };

  // Conjunto prior con incertidumbre amplia y sesgado hacia abajo (escala 0,7–1,6)
  const rng = seededNormalRng(2026);
  const priorMembers = Array.from({ length: 16 }, () => ({
    inflowScale: Math.max(0.5, 1.05 + 0.35 * rng.normal()),
    manningN: Math.max(0.025, Math.min(0.10, 0.055 + 0.015 * rng.normal())),
  }));

  // 3 marcas ciudadanas peritadas (N2/N3) + 1 marca N0 falsa que debe ser ignorada por la puerta N2+
  const fieldMarks = [
    { id: 'm1', level: 'N2', cellIndex: 5 * w + 5, observationStd: 0.05 },
    { id: 'm2', level: 'N3', cellIndex: 6 * w + 10, observationStd: 0.04 },
    { id: 'm3', level: 'N2', cellIndex: 4 * w + 8, observationStd: 0.06 },
    { id: 'm-falsa', level: 'N0', cellIndex: 5 * w + 3, value: 9.9, observationStd: 0.05 },
  ];

  const exp = runFloodAssimilationExperiment({
    w, h, z, dx, sink, inflowCells, baseHydrograph,
    truthParams, priorMembers, fieldMarks,
    tAssimilateS: 750, tEndS: 1600, dtMax: 4, seed: 77,
  });

  assert.equal(exp.assimilatedMarks, 3);
  assert.equal(exp.rejectedMarks, 1);
  // El caudal estimado tras asimilar se acerca notablemente a la verdad (1.9)
  assert.ok(Math.abs(exp.inflowScalePosteriorMean - 1.9) < Math.abs(exp.inflowScalePriorMean - 1.9),
    `scale prior=${exp.inflowScalePriorMean} post=${exp.inflowScalePosteriorMean}`);
  // Mejora medible en RMSE y horquilla (y CSI >= bucle abierto)
  assert.ok(exp.assimilated.rmseM < exp.openLoop.rmseM, `RMSE open=${exp.openLoop.rmseM} vs assim=${exp.assimilated.rmseM}`);
  assert.ok(exp.assimilated.meanHorquilla90M < exp.openLoop.meanHorquilla90M,
    `horquilla open=${exp.openLoop.meanHorquilla90M} vs assim=${exp.assimilated.meanHorquilla90M}`);
  assert.ok(exp.assimilated.csi >= exp.openLoop.csi, `CSI open=${exp.openLoop.csi} vs assim=${exp.assimilated.csi}`);

  // Caso con desbordamiento de mota: el bucle abierto subestima y no alcanza la llanura, EnKF mejora el CSI
  const zLevee = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const inChannel = j === 5 || j === 6;
      const isLevee = j === 4 || j === 7;
      zLevee[k] = (w - 1 - i) * 0.12 + (inChannel ? 0 : isLevee ? 1.15 : 0.65);
    }
  }
  const expLevee = runFloodAssimilationExperiment({
    w, h, z: zLevee, dx, sink, inflowCells,
    baseHydrograph: [[0, 0], [300, 60], [1200, 80], [2400, 10]],
    truthParams: { inflowScale: 2.3, manningN: 0.05 },
    priorMembers,
    fieldMarks: [
      { id: 'ml1', level: 'N2', cellIndex: 5 * w + 4, observationStd: 0.04 },
      { id: 'ml2', level: 'N3', cellIndex: 4 * w + 6, observationStd: 0.05 },
      { id: 'ml3', level: 'N2', cellIndex: 6 * w + 9, observationStd: 0.05 },
    ],
    tAssimilateS: 650, tEndS: 1500, wetThresholdM: 0.1, dtMax: 4, seed: 88,
  });
  assert.ok(expLevee.assimilated.csi > expLevee.openLoop.csi,
    `CSI levee open=${expLevee.openLoop.csi} vs assim=${expLevee.assimilated.csi}`);
  assert.ok(expLevee.assimilated.rmseM < expLevee.openLoop.rmseM);
});

test('asimilación de frente de incendio (N2+): corrige velocidad de cabeza y reduce incertidumbre', () => {
  const rng = seededNormalRng(55);
  // Realidad: rosHead = 28 m/min, windKmh = 30, spreadTo = 70°
  const priorMembers = Array.from({ length: 24 }, () => ({
    rosHeadMMin: Math.max(5, 18 + 6 * rng.normal()),
    windKmh: Math.max(5, 25 + 6 * rng.normal()),
    spreadToDeg: 95 + 18 * rng.normal(),
  }));
  // Observaciones N2/N3 del frente a t=60 min en cabeza (70°) y flanco (160°)
  const LB = 1 + 8.729 * (1 - Math.exp(-0.03 * 30)) ** 2.155;
  const ecc = Math.sqrt(1 - 1 / (LB * LB));
  const distTrue = (az) => ((28 * (1 - ecc)) / (1 - ecc * Math.cos(((az - 70) * Math.PI) / 180))) * 60;

  const out = assimilateFireFrontObservations({
    priorMembers,
    observations: [
      { id: 'f1', level: 'N2', tMin: 60, azimuthDeg: 70, frontDistM: distTrue(70), observationStd: 45 },
      { id: 'f2', level: 'N3', tMin: 60, azimuthDeg: 115, frontDistM: distTrue(115), observationStd: 40 },
    ],
    seed: 11,
  });
  assert.equal(out.assimilatedCount, 2);
  assert.ok(Math.abs(out.posteriorMean.rosHeadMMin - 28) < Math.abs(out.priorMean.rosHeadMMin - 28));
  assert.ok(out.posteriorSpreadRos < out.priorSpreadRos);
});
