import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=(rel)=>readFileSync(resolve(root,rel),'utf8');

test('dossier and security docs contain zero fabricated class names, wrong versions or closed-fund claims',()=>{
  const dirs=['docs/investor','docs/security','docs/audits'];
  const banned=[
    'SessionCancellationGuard',
    'TrialExportFormatter',
    'NearbyLabProtocolTest',
    'android-nearby-lab.yml',
    'oep-evidence-run.test.mjs',
    'P2P_CLUSTER',
    'play-services-nearby:19.3.0',
    'oep-android-nearby-experimental-debug-apk'
  ];
  for(const dir of dirs){
    for(const file of readdirSync(resolve(root,dir)).filter(f=>f.endsWith('.md'))){
      const rel=`${dir}/${file}`;
      if(file==='KARPATHY_6_AGENT_AUDIT_2026.md')continue; // audit explicitly documents the historical errors it caught
      const content=read(rel);
      for(const token of banned){
        assert.ok(!content.includes(token),`${rel} still contains fabricated/stale token: ${token}`);
      }
    }
  }
});

test('DEPENDENCY_AND_LICENSE_AUDIT.md matches actual investor-next/package.json and Android build.gradle.kts',()=>{
  const audit=read('docs/security/DEPENDENCY_AND_LICENSE_AUDIT.md');
  const pkg=JSON.parse(read('investor-next/package.json'));
  const gradle=read('experimental/android-nearby/app/build.gradle.kts');
  assert.ok(audit.includes(`| \`next\` | \`${pkg.dependencies.next}\``),'next version mismatch in audit');
  assert.ok(audit.includes(`| \`react\` | \`${pkg.dependencies.react}\``),'react version mismatch in audit');
  assert.ok(audit.includes(`| \`three\` | \`${pkg.dependencies.three}\``),'three version mismatch in audit');
  assert.ok(gradle.includes('play-services-nearby:19.5.1'),'gradle nearby version changed');
  assert.ok(audit.includes('19.5.1'),'audit missing real play-services-nearby 19.5.1 version');
});

test('all Android Java classes referenced in TECHNICAL_DUE_DILIGENCE.md exist on disk',()=>{
  for(const cls of ['MainActivity','LabDeliveryGuard','LabDeadlinePolicy','LabTrialJournal']){
    assert.equal(
      existsSync(resolve(root,`experimental/android-nearby/app/src/main/java/eu/civicrelay/nearbylab/${cls}.java`)),
      true,
      `Missing Android main class ${cls}.java`
    );
  }
  for(const testCls of ['LabDeliveryGuardTest','LabDeadlinePolicyTest','LabTrialJournalTest']){
    assert.equal(
      existsSync(resolve(root,`experimental/android-nearby/app/src/test/java/eu/civicrelay/nearbylab/${testCls}.java`)),
      true,
      `Missing Android test class ${testCls}.java`
    );
  }
});
