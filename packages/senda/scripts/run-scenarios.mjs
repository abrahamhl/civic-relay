#!/usr/bin/env node
/** Ejecuta los escenarios de referencia y guarda la evidencia en evidence/senda/scenarios.json. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAllScenarios } from '../src/scenarios.mjs';
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../../evidence/senda/scenarios.json');
mkdirSync(dirname(out), { recursive: true });
const r = await runAllScenarios();
writeFileSync(out, JSON.stringify(r, null, 2) + '\n');
console.log(JSON.stringify({ s01: r.s01.plan, s01_onlySatellite: r.s01_onlySatellite.plan.etaMinutes, s01_noAlternatives: r.s01_noAlternatives.plan, s04: r.s04.location, s05: { err: r.s05.horizontalErrorM, bridge: r.s05.bridge?.id, csi: r.s05.csiThroughWall } }, null, 1));
console.log('→', out);
