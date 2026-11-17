import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRE_SOURCES, BEARING_SD, compassHeading, phoneSighting, bearingFix, hotspotPerimeter, fireProgress, FRE_TO_BIOMASS, satVapHpa, emcPct, fosbergFfwi, isiFromFfmc,
  fireWeather, fireBehavior, ATTACK, fireCriticality, roadThreats, fireRoadAlerts, smokeRoadAdvice, vehicleFireIgnitionRisk, CASE_SMV_2026, fireScenario, fireWatch, distanceToPerimeter,
} from '../src/fire-watch.mjs';
import { parseFirmsCsv } from '../src/wildfire.mjs';
import { HAZARD, decodeHazard } from '../src/road-guard.mjs';
import { localFrame } from '../src/geo-offline.mjs';

const errM = (a, b) => { const q = localFrame(a.lat, a.lon).toXY(b.lat, b.lon); return Math.hypot(q.x, q.y); };

test('fuentes: modo de acceso en todas; radios de emergencia y drones sobre el fuego, NUNCA; torres del INFOMA por convenio', () => {
  for (const s of FIRE_SOURCES) { assert.match(s.access, /^(PASIVO|CONVENIO|NUNCA)$/, s.id); assert.ok(s.name && s.legal, s.id); }
  const by = Object.fromEntries(FIRE_SOURCES.map((s) => [s.id, s.access]));
  assert.equal(by['escucha-radio'], 'NUNCA'); assert.equal(by['drones-sobre-fuego'], 'NUNCA'); assert.equal(by['camaras-privadas'], 'NUNCA');
  assert.equal(by.torres, 'CONVENIO'); assert.equal(by.firms, 'PASIVO'); assert.equal(by.movil, 'PASIVO');
});

test('brújula del móvil: rumbo de la cámara trasera según W3C (norte, oeste, este) y declinación', () => {
  assert.equal(Math.round(compassHeading(0, 90, 0)), 0);
  assert.equal(Math.round(compassHeading(90, 90, 0)), 270);
  assert.equal(Math.round(compassHeading(270, 90, 0)), 90);
  const s = phoneSighting({ lat: 40.36, lon: -4.33, headingDeg: 359, declDeg: 2 });
  assert.equal(s.azDeg, 1); assert.equal(s.sdDeg, BEARING_SD.movil); assert.equal(s.kind, 'movil');
});

test('triangulación: la columna sale a menos de 400 m con elipse coherente; la brújula descalibrada se descarta casi siempre', () => {
  let rejected = 0;
  for (const seed of [1, 2, 3, 7, 11, 19]) {
    const sc = fireScenario({ seed }), fix = bearingFix(sc.sightings), e = errM(sc.smokeTruth, fix);
    assert.ok(fix.ok); assert.ok(e < 400, `seed ${seed}: ${e.toFixed(0)} m`); assert.ok(e < 3 * fix.majorM, `seed ${seed}: fuera de 3σ`);
    assert.ok(fix.crossingDeg > 60, 'buen cruce de visuales');
    if (fix.rejected.some((r) => r.id === 'movil-4')) rejected++;
    assert.ok(!fix.rejected.some((r) => r.kind === 'torre'), 'nunca descarta una torre buena');
  }
  assert.ok(rejected >= 4, `descartada en ${rejected} de 6`);
  assert.equal(bearingFix([{ id: 'a', kind: 'torre', lat: 40, lon: -4, azDeg: 10 }]).ok, false);
  const par = bearingFix([{ id: 'a', kind: 'torre', lat: 40, lon: -4, azDeg: 0 }, { id: 'b', kind: 'torre', lat: 40, lon: -3.99, azDeg: 0 }]);
  assert.equal(par.ok, false); assert.match(par.reason, /no se cruzan/);
});

test('satélite: perímetro como cota superior, FRP y biomasa; avance entre pasadas ≈ velocidad real y hacia el este', () => {
  const sc = fireScenario({ seed: 7 }), [a, b] = sc.passes.map((p) => hotspotPerimeter(p.points, { origin: sc.ignition }));
  assert.ok(a.areaHa >= sc.truthAt(90).areaHa && b.areaHa >= sc.truthAt(210).areaHa, 'la envolvente de píxeles no infravalora');
  assert.ok(Math.abs(b.biomassKgS - FRE_TO_BIOMASS * b.frpMW) < 0.2);
  const p = fireProgress(a, b);
  assert.equal(p.dtMin, 120); assert.ok(Math.abs(p.rosMMin - sc.rosHeadMMin) / sc.rosHeadMMin < 0.2, `ros ${p.rosMMin}`);
  assert.ok(Math.abs(p.headingDeg - 90) <= 10, `rumbo ${p.headingDeg}`); assert.ok(p.growthHaH > 0);
  assert.equal(distanceToPerimeter(b, sc.ignition), 0);
  assert.throws(() => fireProgress(b, a), /ordenadas/);
});

test('FIRMS: el lector conserva instrumento y tamaño de píxel, y el perímetro los usa', () => {
  const csv = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n40.362,-4.385,360.0,1.0,1.0,2026-07-23,1430,N,MODIS,h,6.1NRT,300.0,40.0,D';
  const [p] = parseFirmsCsv(csv);
  assert.equal(p.instrument, 'MODIS'); assert.equal(p.scanKm, 1); assert.equal(p.daynight, 'D');
  assert.equal(hotspotPerimeter([p]).areaHa, 100);
});

test('meteorología del incendio: 30-30-30, déficit de vapor, HDW, Fosberg e ISI se comportan como deben', () => {
  assert.ok(Math.abs(satVapHpa(30) - 42.4) < 0.2);
  const w = fireWeather({ tempC: 38, rh: 15, windKmh: 32, windFromDeg: 270, ffmc: 94 });
  assert.deepEqual([w.rule30.temp, w.rule30.rh, w.rule30.wind, w.rule30.count], [true, true, true, 3]);
  assert.equal(w.spreadToDeg, 90); assert.ok(Math.abs(w.hdw - w.vpdHpa * (32 / 3.6)) < 1);
  assert.equal(fireWeather({ tempC: 30, rh: 30, windKmh: 30 }).rule30.count, 0, 'los umbrales son estrictos');
  assert.ok(emcPct(38, 15) < emcPct(20, 60), 'más seco y cálido → combustible más seco');
  assert.ok(fosbergFfwi(38, 15, 32) > fosbergFfwi(25, 50, 10));
  assert.ok(isiFromFfmc(94, 32) > isiFromFfmc(85, 32) && isiFromFfmc(85, 32) > isiFromFfmc(85, 0));
  assert.ok(Math.abs(isiFromFfmc(85, 0) - 2.1) < 0.1);
});

test('comportamiento: intensidad de Byram, llama y clase de ataque; criticidad de extrema a vigilancia', () => {
  const calm = fireBehavior({ rosMMin: 0.5, fuel: 'pasto' }), hot = fireBehavior({ rosMMin: 25, fuel: 'matorral' });
  assert.equal(calm.attack.k, 1); assert.equal(hot.attack.k, 4); assert.equal(hot.intensityKWm, 15000);
  assert.ok(Math.abs(fireBehavior({ rosMMin: (346 * 60) / (18000 * 1) , fuelKgM2: 1 }).flameM - 1.1) < 0.1, '346 kW/m ≈ 1,1–1,2 m (Andrews y Rothermel)');
  assert.equal(ATTACK.length, 4);
  const r = fireWatch(fireScenario({ seed: 7 }), { people: 240 });
  assert.equal(r.criticality.level, 'extrema'); assert.ok(r.criticality.reasons.length >= 4);
  const mild = fireCriticality({ behavior: calm, weather: fireWeather({ tempC: 22, rh: 55, windKmh: 8 }), exposure: { towns: [{ name: 'X', etaMin: 900 }] } });
  assert.equal(mild.level, 'vigilancia');
});

test('carreteras y coches: corta la M-501 en el tramo del km 57 y avisa con tramas HAZARD.FIRE; la N-403 queda en vigilancia', () => {
  const r = fireWatch(fireScenario({ seed: 7 }));
  const m501 = r.roads.find((x) => x.id === 'M-501'), n403 = r.roads.find((x) => x.id === 'N-403');
  assert.equal(m501.action, 'cortar'); assert.ok(m501.section.pkFrom < 57 && m501.section.pkTo >= 56.5, JSON.stringify(m501.section));
  assert.equal(n403.action, 'vigilar');
  const [al] = fireRoadAlerts(r.roads, { t: 1000 }), h = decodeHazard(al.frame);
  assert.equal(al.frame.length, 24); assert.equal(h.type, HAZARD.FIRE); assert.equal(h.flags & 1, 1);
  assert.equal(r.towns[0].name, 'Pelayos de la Presa');
  assert.ok(smokeRoadAdvice(30).kmh < smokeRoadAdvice(150).kmh);
  assert.equal(vehicleFireIgnitionRisk({ weather: r.weather, vegetationM: 10 }).risk, 'alto');
  assert.equal(vehicleFireIgnitionRisk({ weather: fireWeather({ tempC: 20, rh: 60, windKmh: 5 }), vegetationM: 200 }).notify112, false);
  assert.equal(roadThreats([], r.perimeters[1], { rosHeadMMin: 25, spreadToDeg: 90, windKmh: 32 }).length, 0);
});

test('caso real: cada hecho con fuente https y la reconstrucción marcada como ilustrativa y determinista', () => {
  for (const f of [...CASE_SMV_2026.facts, ...CASE_SMV_2026.context]) assert.match(f.src, /^https:\/\//);
  assert.match(CASE_SMV_2026.facts[0].text, /km 57 de la M-501/);
  const a = fireScenario({ seed: 3 }), b = fireScenario({ seed: 3 });
  assert.equal(a.illustrative, true); assert.deepEqual(a.sightings, b.sightings); assert.deepEqual(a.passes, b.passes);
  assert.equal(a.ellipseAt(60).length, 73);
});
