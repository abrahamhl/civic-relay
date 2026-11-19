import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('orbital investor UI conspicuously labels synthetic shells in all three languages',()=>{
 const file=readFileSync(resolve(root,'app/live-hardware-console.tsx'),'utf8');
 for(const label of [
  'Geometría orbital ilustrativa (simulación, no efemérides reales)',
  'Illustrative Orbital Geometry (Synthetic Model, Not Live Ephemerides)',
  'Illustratieve baangeometrie (synthetisch model, geen echte efemeriden)',
  'orbital-synthetic-disclosure','MODELO SINTÉTICO','SYNTHETIC MODEL','SYNTHETISCH MODEL',
  'Modeled Doppler:','Modeled Slant Range:','MODEL EL'
 ])assert.ok(file.includes(label),`Missing synthetic truth label: ${label}`);
 for(const outdated of ['Real-Time Satellite Orbital Ephemerides','Efemérides Orbitales Satelitales en Tiempo Real','Realtime Satelliet-Ephemeriden','Live Doppler:'])
  assert.ok(!file.includes(outdated),`Old false operational label: ${outdated}`);
});
