#!/usr/bin/env node
/**
 * Non-secret, non-cryptographic build provenance for the static investor site.
 * This does not attest to Vercel's actual alias or hardware readiness.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(resolve(project,'package.json'),'utf8'));
let gitCommit=null;
try{gitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000}).trim();}
catch{/* Some Vercel builds omit a Git checkout. */}
const sha=/^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA??'')
  ?process.env.VERCEL_GIT_COMMIT_SHA
  : /^[a-f0-9]{40}$/i.test(gitCommit??'')?gitCommit
  : /^[a-f0-9]{40}$/i.test(process.env.GITHUB_SHA??'')?process.env.GITHUB_SHA
  :'UNVERIFIED_LOCAL_BUILD';
const evidence={
 schema:'oep-public-build-provenance/v1',
 sourceSha:sha.toLowerCase(),
 canonical:'https://civic-relay-investor.vercel.app',
 nextVersion:manifest.dependencies.next,
 commitSource:'SOURCE_BUILD_ID_ONLY_NOT_A_SIGNED_ATTESTATION',
 physicalValidation:'NOT_PERFORMED',
 emergencyService:false
};
mkdirSync(resolve(project,'public'),{recursive:true});
writeFileSync(resolve(project,'public/release-provenance.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('Release provenance:',evidence.sourceSha,'(not an emergency validation)');
