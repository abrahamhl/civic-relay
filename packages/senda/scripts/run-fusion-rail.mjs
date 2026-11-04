#!/usr/bin/env node
/** Evidencia reproducible del motor de fusión (calibración) y de la vigilancia ferroviaria → evidence/senda/. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCalibration, fusionInputFromBuildingSim } from '../src/rescue-scenario.mjs';
import { fuseOccupancy } from '../src/occupancy.mjs';
import { simulateBuildingIncident } from '../src/building-scenario.mjs';
import { runRailWatchDemo } from '../src/rail-watch-scenario.mjs';
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../evidence/senda');
mkdirSync(dir, { recursive: true });
const calib = { wellSpecified: runCalibration({ runs: 200 }), misspecified: runCalibration({ runs: 200, misspecified: true }) };
const f = fuseOccupancy(fusionInputFromBuildingSim(simulateBuildingIncident()));
const fusion = { kind: 'DETERMINISTIC_SIMULATION', calibration: calib, building14: { summary: f.summary, top: f.ranked.slice(0, 8).map(({ id, p, lo, hi, cls, families, badge98, priority }) => ({ id, p: +p.toFixed(3), lo: +lo.toFixed(3), hi: +hi.toFixed(3), cls, families, badge98, priority: +priority.toFixed(3) })) } };
writeFileSync(resolve(dir, 'fusion-calibration.json'), JSON.stringify(fusion, null, 2) + '\n');
const rail = runRailWatchDemo(); delete rail.circuit.samples; delete rail.geometry.segments;
writeFileSync(resolve(dir, 'rail-watch.json'), JSON.stringify({ kind: 'DETERMINISTIC_SIMULATION', ...rail }, null, 2) + '\n');
const w = calib.wellSpecified, m = calib.misspecified;
console.log(JSON.stringify({ brier: [w.engine.brier, w.baseline.brier, w.brierImprovementPct], badge98: w.badge98, lo90: w.lowerBoundAtLeast90, mis: { brier: [m.engine.brier, m.baseline.brier, m.brierImprovementPct], badge98: m.badge98, lo90: m.lowerBoundAtLeast90 }, rail: { leadTimeH: rail.circuit.leadTimeH, alerts: rail.geometry.alerts.length } }));
