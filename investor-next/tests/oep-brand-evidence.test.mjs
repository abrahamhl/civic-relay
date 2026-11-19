import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const base=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const read=(path)=>readFileSync(resolve(base,path),'utf8');

test('public SENDA & OEP name and i18n alternates are consistent across investor metadata and Android lab',()=>{
 const page=read('investor-next/app/investor-page.tsx');
 const locales=read('investor-next/app/copy.ts');
 const layoutMeta=read('investor-next/app/(en)/layout.tsx');
 const localePage=read('investor-next/app/(localized)/[locale]/page.tsx');
 const sendaMeta=read('investor-next/app/_senda/data/metadata.ts');
 const manifest=read('experimental/android-nearby/app/src/main/AndroidManifest.xml');
 assert.match(page,/OEP — Offline Emergency Protocol/);
 assert.match(locales,/OEP — Offline Emergency Protocol/g);
 assert.match(layoutMeta,/buildPageMetadata\('en', 'home'\)/);
 assert.match(localePage,/buildPageMetadata\(lang, 'home'\)/);
 assert.match(sendaMeta,/SENDA/);
 assert.match(sendaMeta,/canonical/);
 assert.match(sendaMeta,/en:\s*localeHref\('en'/);
 assert.match(sendaMeta,/es:\s*localeHref\('es'/);
 assert.match(sendaMeta,/nl:\s*localeHref\('nl'/);
 assert.match(manifest,/OEP — OFFLINE EMERGENCY PROTOCOL \/ LAB ONLY/);
 for(const text of [page,locales,layoutMeta,localePage,sendaMeta])
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
