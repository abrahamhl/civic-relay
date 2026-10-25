// Captures existing local observations; does not run tests or certify hardware.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {MODULES,VISION} from '../investor-next/lib/master-vision.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dest=resolve(root,'evidence/vision-integration');mkdirSync(dest,{recursive:true});
const json=p=>JSON.parse(readFileSync(resolve(root,p),'utf8').replace(/^\uFEFF/,''));
const sha=p=>createHash('sha256').update(readFileSync(resolve(root,p))).digest('hex');
const browser=json('evidence/browser-release/summary.json');
assert.equal(browser.runs.length,15);assert.ok(browser.runs.every(r=>r.verdict==='PASS'));
const device=json('evidence/device-field/summary.json');assert.equal(device.outcome,'PASS');
const remote=json('evidence/remote-ci-baseline.json');assert.ok(remote.checks.length>0);
assert.ok(remote.checks.every(c=>c.head_sha===VISION.baselineSha && c.conclusion==='success'));
const logs=['vision-tests.log','vision-build.log','vision-browser.log','workspace-build.log','workspace-types.log','workspace-tests.log'];
const logFiles=logs.map(p=>{assert.ok(existsSync(resolve(root,p)));const target=p.replace('.log','.txt');copyFileSync(resolve(root,p),resolve(dest,target));return {path:'evidence/vision-integration/'+target,sha256:sha(p)};});
const unitText=readFileSync(resolve(root,'vision-tests.log'),'utf8');
assert.match(unitText,/# tests 98\s/);assert.match(unitText,/# pass 98\s/);assert.match(unitText,/# fail 0\s/);
const changed=execFileSync('git',['diff','--name-only'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const added=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const files=[...new Set([...changed,...added])].filter(p=>p&&!p.startsWith('evidence/')&&!p.endsWith('next-env.d.ts')).sort();
const manifest={schema:'civic-relay-master-integration/v1',recordedAt:new Date().toISOString(),baseSha:VISION.baselineSha,
 sourceState:'LOCAL_UNCOMMITTED_CHANGES',remoteCiForChanges:'NOT_RUN',physicalValidation:'NOT_PERFORMED',
 browser:{count:browser.runs.length,pass:browser.runs.filter(r=>r.verdict==='PASS').length,completedAt:browser.completed_at_utc},
 unitTests:{lab:98,core:26},device:{outcome:device.outcome,measurementCount:device.measurementCount},
 remoteBaseline:remote,files:files.map(path=>({path,sha256:sha(path)})),logs:logFiles,modules:MODULES};
writeFileSync(resolve(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({manifest:'evidence/vision-integration/manifest.json',files:files.length,browser:manifest.browser,baseSha:manifest.baseSha,sourceState:manifest.sourceState}));
