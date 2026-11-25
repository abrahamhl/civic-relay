import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAVITY_MS2,
  hllcHydrostaticFlux,
  createFvSim,
  fvSetInitialDepth,
  fvStoredVolume,
  fvStep,
  fvRunUntil,
  burnSubgridChannel,
  enforceHydrologicBreach,
  buildUrbanPorosityField,
  WGSL_SWE_FV_SHADER,
  createDualBackendSweRunner,
  verifyPrecisionParity,
  assessHumanFloodStability,
  assessVehicleFloodStability,
  VEHICLE_FLOOD_LIMITS,
} from '../src/shallow-water-fv.mjs';

test('C-property exacta (lago en reposo) con relieve ondulado, isla seca y porosidad urbana variable φ(x,y)', () => {
  const w = 18, h = 16, dx = 10;
  const z = new Float64Array(w * h);
  const phi = new Float64Array(w * h);
  const eta0 = 3.5;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      // Relieve ondulado + isla emergida en el centro (z > eta0)
      const dist2 = (i - 9) ** 2 + (j - 8) ** 2;
      z[k] = 1.0 + 0.7 * Math.sin(i * 0.5) * Math.cos(j * 0.4) + (dist2 < 4 ? 3.2 : 0);
      // Porosidad urbana heterogénea entre 0.45 y 1.0
      phi[k] = i >= 4 && i <= 13 && j >= 3 && j <= 12 ? 0.55 + 0.15 * ((i + j) % 3) : 1.0;
    }
  }

  const sim = createFvSim({ w, h, z, dx, n: 0.035, phi, precision: 'f64' });
  fvSetInitialDepth(sim, (_i, _j, zk) => Math.max(0, eta0 - zk));
  const vol0 = fvStoredVolume(sim);

  for (let s = 0; s < 40; s++) fvStep(sim, 0.25);

  let maxEtaErr = 0;
  let maxVel = 0;
  for (let k = 0; k < w * h; k++) {
    if (sim.d[k] > sim.hDry) {
      maxEtaErr = Math.max(maxEtaErr, Math.abs(sim.d[k] + sim.z[k] - eta0));
      maxVel = Math.max(maxVel, Math.hypot(sim.hu[k], sim.hv[k]) / sim.d[k]);
    }
  }
  const volErr = Math.abs(fvStoredVolume(sim) - vol0) / vol0;
  assert.ok(maxEtaErr < 1e-12, `maxEtaErr=${maxEtaErr}`);
  assert.ok(maxVel < 1e-12, `maxVel=${maxVel}`);
  assert.ok(volErr < 1e-12, `volErr=${volErr}`);
});

test('Verificación analítica: rotura de presa sobre lecho seco (Ritter, 1892)', () => {
  // Canal 1D embebido en malla 2D (120×3, dx = 2 m, fricción despreciable n = 1e-5)
  const w = 120, h = 3, dx = 2, h0 = 1.0;
  const z = new Float64Array(w * h); // lecho plano z = 0
  const sim = createFvSim({ w, h, z, dx, n: 1e-5, cfl: 0.45, precision: 'f64' });
  const xDamIdx = 50;
  fvSetInitialDepth(sim, (i) => (i < xDamIdx ? h0 : 0));

  const tTarget = 6.0;
  fvRunUntil(sim, tTarget, { dtMax: 0.2 });

  // Solución exacta de Ritter (1892):
  //   x_tail = x0 - c0*t,  x_front = x0 + 2*c0*t,  c0 = sqrt(g*h0)
  //   h(x,t) = (1/(9g)) * (2*c0 - (x - x0)/t)^2 en [x_tail, x_front]
  const c0 = Math.sqrt(GRAVITY_MS2 * h0);
  const x0 = xDamIdx * dx;
  let sqErr = 0, count = 0;
  const row = 1; // fila central
  for (let i = 10; i < w - 10; i++) {
    const x = (i + 0.5) * dx;
    let hExact;
    if (x <= x0 - c0 * tTarget) hExact = h0;
    else if (x >= x0 + 2 * c0 * tTarget) hExact = 0;
    else hExact = ((2 * c0 - (x - x0) / tTarget) ** 2) / (9 * GRAVITY_MS2);
    const hNum = sim.d[row * w + i];
    sqErr += (hNum - hExact) ** 2;
    count++;
  }
  const rmse = Math.sqrt(sqErr / count);
  // Esquema de 1er orden HLLC sobre malla dx = 2 m: RMSE esperado < 0.04 m
  assert.ok(rmse < 0.04, `Ritter RMSE demasiado alto: ${rmse.toFixed(4)} m`);

  // Verificar avance del frente (no supera celeridad máxima ni queda estancado)
  let furthestWet = 0;
  for (let i = 0; i < w; i++) {
    if (sim.d[row * w + i] > 0.01) furthestWet = (i + 0.5) * dx;
  }
  const exactFront = x0 + 2 * c0 * tTarget;
  assert.ok(Math.abs(furthestWet - exactFront) < 12, `frente=${furthestWet} m vs exacto=${exactFront.toFixed(1)} m`);
});

test('Conservación exacta de masa y positividad de calado en terreno abrupto con fuente y sumideros', () => {
  const w = 24, h = 16, dx = 20;
  const z = new Float64Array(w * h);
  const sink = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      z[k] = 20 - 0.6 * i + 0.8 * Math.abs(j - 8);
      if (i === w - 1) sink[k] = 1;
    }
  }
  const sim = createFvSim({ w, h, z, dx, n: 0.04, sink });
  fvRunUntil(sim, 300, {
    inflow: (t) => (t < 150 ? 180 : 0),
    cells: [8 * w + 1],
    dtMax: 2,
  });

  for (let k = 0; k < sim.d.length; k++) {
    assert.ok(sim.d[k] >= 0 && Number.isFinite(sim.d[k]), `calado no válido en k=${k}: ${sim.d[k]}`);
  }
  const stored = fvStoredVolume(sim);
  const relErr = Math.abs(sim.volIn - sim.volOut - stored) / sim.volIn;
  assert.ok(relErr < 1e-12, `error relativo de balance de masa: ${relErr}`);
  assert.ok(sim.volOut > 0, 'el flujo debe alcanzar el sumidero de salida');
});

test('Porosidad urbana (Sanders 2008): edificios (φ < 1) elevan el calado y aceleran la llegada en corredor', () => {
  const w = 30, h = 7, dx = 25;
  const z = new Float64Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) z[j * w + i] = 10 - 0.25 * i + 2 * Math.abs(j - 3);
  const urbanMask = new Uint8Array(w * h);
  for (let j = 1; j < h - 1; j++) for (let i = 5; i < 25; i++) urbanMask[j * w + i] = 1;
  const { phi } = buildUrbanPorosityField(w, h, { urbanMask, urbanPhi: 0.55 });

  const openSim = createFvSim({ w, h, z, dx, n: 0.035 });
  const urbanSim = createFvSim({ w, h, z, dx, n: 0.035, phi });

  fvRunUntil(openSim, 200, { inflow: () => 250, cells: [3 * w + 1], dtMax: 2 });
  fvRunUntil(urbanSim, 200, { inflow: () => 250, cells: [3 * w + 1], dtMax: 2 });

  const probe = 3 * w + 15;
  assert.ok(urbanSim.maxD[probe] > openSim.maxD[probe], `calado urbano (${urbanSim.maxD[probe]}) debe superar al abierto (${openSim.maxD[probe]}) por reducción de almacenamiento φ=0.55`);
  assert.ok(urbanSim.arrive[probe] < openSim.arrive[probe], `llegada urbana (${urbanSim.arrive[probe]} s) debe ser anterior a abierta (${openSim.arrive[probe]} s)`);
});

test('Paridad f32 (WebGPU) ↔ f64 (CPU) dentro de tolerancia declarada (< 1e-4 m) y estructura WGSL', async () => {
  const w = 16, h = 12, dx = 20;
  const z = new Float64Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) z[j * w + i] = 8 - 0.3 * i + 0.5 * Math.abs(j - 6);

  const parity = verifyPrecisionParity(
    { w, h, z, dx, n: 0.04 },
    { tEnd: 60, inflow: () => 120, cells: [6 * w + 1], dtMax: 2, toleranceM: 1e-4 },
  );
  assert.equal(parity.withinTolerance, true, `paridad excedida: maxAbsDiffM=${parity.maxAbsDiffM}`);
  assert.equal(parity.basis, 'MODEL');

  // Validar shader WGSL y ejecutor dual (en esta VM sin GPU debe declarar CPU_FALLBACK honestamente)
  assert.ok(WGSL_SWE_FV_SHADER.includes('fn flux_pass'));
  assert.ok(WGSL_SWE_FV_SHADER.includes('fn update_pass'));
  assert.ok(WGSL_SWE_FV_SHADER.includes('@workgroup_size(16, 16, 1)'));
  const runner = await createDualBackendSweRunner({ w, h, z, dx, n: 0.04 });
  assert.equal(runner.declaredParityToleranceM, 1e-4);
  assert.ok(['CPU_FALLBACK', 'WEBGPU_READY_WITH_CPU_FALLBACK'].includes(runner.backend));
  runner.runUntil(20, { inflow: () => 100, cells: [6 * w + 1], dtMax: 2 });
  assert.ok(runner.sim.steps > 0);
});

test('Estabilidad de personas (Cox 2010 / DEFRA FD2320) y vehículos (Shand 2011 / Martínez-Gomariz 2018)', () => {
  // Adulto en 0.4 m a 0.5 m/s con DF=0.5 → d*v=0.2 (<0.6 estable Cox), HR = 0.4*1.0 + 0.5 = 0.9 (DANGER_FOR_SOME)
  const adultSafe = assessHumanFloodStability(0.4, 0.5, { profile: 'adult', debrisFactor: 0.5 });
  assert.equal(adultSafe.unstable, false);
  assert.equal(adultSafe.defraClass, 'DANGER_FOR_SOME');

  // Niño en 0.55 m a 0.8 m/s → inestable por d>0.5 y d*v=0.44>0.4
  const childDanger = assessHumanFloodStability(0.55, 0.8, { profile: 'child', debrisFactor: 1.0 });
  assert.equal(childDanger.unstable, true);
  assert.equal(childDanger.defraClass, 'DANGER_FOR_MOST');

  // Turismo pequeño en 0.35 m a 1.0 m/s → flotación y arrastre (d>=0.3 y d*v=0.35>=0.3)
  const carSmall = assessVehicleFloodStability(0.35, 1.0, { vehicleClass: 'small_passenger' });
  assert.equal(carSmall.unstable, true);
  assert.equal(carSmall.mechanism, 'FLOTACION_Y_ARRASTRE');

  // 4×4 grande en 0.35 m a 1.0 m/s → aún estable (<0.5 m y d*v=0.35<0.6)
  const suv = assessVehicleFloodStability(0.35, 1.0, { vehicleClass: 'large_4wd' });
  assert.equal(suv.unstable, false);
  assert.equal(suv.mechanism, 'ESTABLE');
  assert.equal(VEHICLE_FLOOD_LIMITS.large_4wd.maxDepthM, 0.5);
});

test('Regla de veracidad: rechaza parámetros obligatorios sin fuente (Manning n, debrisFactor, incisionM, urbanPhi)', () => {
  assert.throws(() => createFvSim({ w: 4, h: 4, z: new Float64Array(16), dx: 10 }), /Manning n/);
  assert.throws(() => assessHumanFloodStability(0.5, 1.0, { profile: 'adult' }), /debrisFactor/);
  assert.throws(() => burnSubgridChannel(new Float64Array(16), 4, 4, { channelCells: [5] }), /incisionM/);
  assert.throws(() => enforceHydrologicBreach(new Float64Array(16), [1, 2], 10, {}), /minSlope/);
  assert.throws(() => buildUrbanPorosityField(4, 4, { urbanMask: new Uint8Array(16) }), /urbanPhi/);

  // Apertura hidrológica (Lindsay & Dhun 2015) elimina tapones sin elevar ninguna cota
  const bumpy = new Float64Array([10, 9, 12, 8, 7]);
  const br = enforceHydrologicBreach(bumpy, [0, 1, 2, 3, 4], 100, { minSlope: 0.001 });
  assert.ok(br.z[2] < br.z[1] && br.breachedCount >= 1);

  // Flujo HLLC sobre celdas secas devuelve ceros finitos sin NaN
  const dry = hllcHydrostaticFlux(0, 0, 0, 10, 0, 0, 0, 12);
  assert.equal(dry.fh, 0);
  assert.equal(dry.maxWave, 0);
});
