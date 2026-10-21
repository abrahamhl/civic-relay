import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=(path)=>readFileSync(resolve(base,path),'utf8');

test('public OEP name is consistent across investor languages, metadata and Android lab',()=>{
 const page=read('investor-next/app/investor-page.tsx');
 const locales=read('investor-next/app/copy.ts');
 const metadata=read('investor-next/app/(en)/layout.tsx');
 const localeMetadata=read('investor-next/app/(localized)/[locale]/page.tsx');
 const manifest=read('experimental/android-nearby/app/src/main/AndroidManifest.xml');
 assert.match(page,/OEP — Offline Emergency Protocol/);
 assert.match(locales,/OEP — Offline Emergency Protocol/g);
 assert.match(metadata,/OEP — Offline Emergency Protocol/);
 assert.match(metadata,/alternates:\{canonical:'\/',languages:\{en:'\/',es:'\/es\/',nl:'\/nl\/'\}\}/);
 assert.match(localeMetadata,/alternates:\{canonical:'\/'\+lang\+'\/',languages:\{en:'\/',es:'\/es\/',nl:'\/nl\/'\}\}/);
 assert.match(manifest,/OEP — OFFLINE EMERGENCY PROTOCOL \/ LAB ONLY/);
 for(const text of [page,locales,metadata,localeMetadata])
   assert.doesNotMatch(text,/Proyecto de comunicaciones por satélite para emergencias offline/i);
});
test('the evidence board explicitly distinguishes model-only checks from physical deployment',()=>{
 const page=read('investor-next/app/investor-page.tsx');
 const board=read('investor-next/app/evidence-board.tsx');
 assert.match(page,/<EvidenceBoard locale=\{locale\}\/>/);
 assert.match(board,/NOT PHYSICALLY TESTED/);
 assert.match(board,/SIN PRUEBA FÍSICA/);
 assert.match(board,/NIET FYSIEK GETEST/);
 assert.match(board,/No official alerts, no rescue confirmation/);
});

test('investor can export complete deterministic synthetic routes with evidence warning',()=>{
 const lab=read('investor-next/app/coordination-lab.tsx');
 assert.match(lab,/OEP_SYNTHETIC_EVIDENCE_EXPORT/);
 assert.match(lab,/SIMULATION_ONLY_NOT_PHYSICALLY_TESTED_NOT_AN_EMERGENCY_SERVICE/);
 assert.match(lab,/input:params,result/);
 assert.match(lab,/application\/json/);
});
