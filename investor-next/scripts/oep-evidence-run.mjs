/**
 * OEP research evidence harness. 100% simulated, no external calls/sensors/radios.
 * Deterministic scenario sweep, falsifiable invariants and machine-readable evidence.
 * Never interpret an ACK_SYNTHETIC as an actual emergency delivery.
 */
import {runScenario} from '../lib/emergency-routing.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const noPhysicalClaims=Object.freeze({
 proofLevel:'SIMULATED',
 transport:'ABSTRACT_VIRTUAL_TOPOLOGY',
 physicalDeliveryMeasured:false,
 radiosActivated:false,
 satelliteLinkTested:false,
 officialCAPVerified:false,
 distressCallsSent:false,
 humanRescueVerified:false,
 batteryPerformanceMeasured:false
});
const scenarios={
 noParticipants:{participation:0,permissions:100,bluetooth:true,wifi:true,gateway:true,damaged:100},
 isolation:{participation:100,permissions:100,bluetooth:false,wifi:false,gateway:false,damaged:100},
 partialOutage:{participation:80,permissions:65,bluetooth:true,wifi:true,gateway:true,damaged:65},
 conservation:{participation:85,permissions:85,bluetooth:true,wifi:true,gateway:true,damaged:85,battery:20},
 criticalEnergy:{participation:85,permissions:85,bluetooth:true,wifi:true,gateway:true,damaged:85,battery:5},
 noGateway:{participation:80,permissions:65,bluetooth:true,wifi:true,gateway:false,damaged:100}
};
const assert=(pass,reason)=>{if(!pass)throw new Error('OEP MODEL FAILURE: '+reason);};
const checksum=(r)=>JSON.stringify(r);
export function makeEvidenceReport(){
 const groups=[];
 let total=0;const totals={syntheticAcks:0,queued:0,explicitSOS:0,virtualDevices:0},violations=[];
 for(const [name,preset] of Object.entries(scenarios)){
  const metrics={cases:0,syntheticAcks:0,queued:0,explicitSOS:0,virtualDevices:0,minAcks:null,maxAcks:null};
  for(const devices of [20,60,100])for(const seed of [1,7,42,20261020,2147483647])
   for(const responses of [0,8,16])for(const helpRequests of [0,2,5]){
    const params={devices,seed,responses,helpRequests,...preset};
    const r=runScenario(params),s=r.summary;
    const rules={
     devices:r.devices.length===devices,
     participants:s.participating+s.noContact===devices,
     humanStates:s.humanSafe+s.humanSOS+s.humanUnknown===s.participating,
     explicitOnly:s.modelledMessages===s.humanSafe+s.humanSOS,
     syntheticConservation:s.syntheticAcks+s.queued===s.modelledMessages,
     noFalsePhysicalClaim:r.assumptions.realRadio===false&&r.assumptions.realSatellite===false,
     no112:r.assumptions.live112===false,
     noOfficialAuth:r.zone.institutionalAuthentication===false,
     noVictimInference:r.routes.every(x=>x.humanStatus!=='UNKNOWN'),
     allSynthetic:r.routes.every(x=>x.evidence==='SIMULATED_ONLY'),
     cellularBaselineBound:s.cellularOnlyAcks<=s.syntheticAcks,
     isolationFailsClosed:name!=='isolation'||s.syntheticAcks===0,
     participationFailsClosed:name!=='noParticipants'||s.modelledMessages===0,
     noGatewayRelays:name!=='noGateway'||s.simulatedLocalGatewayAcks===0,
     reproducible:checksum(r)===checksum(runScenario(params))
    };
    const failing=Object.entries(rules).filter(([,ok])=>!ok).map(([k])=>k);
    if(failing.length)violations.push({scenario:name,params,failed:failing});
    total++;metrics.cases++;metrics.syntheticAcks+=s.syntheticAcks;metrics.queued+=s.queued;
    metrics.explicitSOS+=s.humanSOS;metrics.virtualDevices+=devices;
    metrics.minAcks=Math.min(metrics.minAcks??s.syntheticAcks,s.syntheticAcks);
    metrics.maxAcks=Math.max(metrics.maxAcks??s.syntheticAcks,s.syntheticAcks);
  }
  groups.push({name,presets:preset,...metrics});
  for(const k of Object.keys(totals))totals[k]+=metrics[k];
 }
 assert(violations.length===0,'invariant violations: '+JSON.stringify(violations.slice(0,4)));
 return {
  schema:'OEP_RESEARCH_EVIDENCE_V1',project:'OEP — Offline Emergency Protocol',
  methodology:'Fixed virtual scenario matrix. No random sampling of a physical population.',
  evidence:noPhysicalClaims,
  runCount:total,invocationsPerGroup:135,caseGroups:groups.length,
  invariantsCheckedPerRun:15,passedInvariantChecks:total*15,
  failedInvariantChecks:0,
  dataSemantics:'Counts are sums of modelled synthetic events across independent runs, not unique people/devices nor real deliveries.',
  totals,groups,
  limitations:[
   'The abstract range is normalised graph distance and not a measured Bluetooth or Wi-Fi range.',
   'Synthetic ACKs confirm virtual receipt in the model, not successful RF transmission.',
   'No measured physical power, latency, reliability, location or emergency response outcome.',
   'Test sweep checks defined invariants only; it is not formal verification, a safety certificate or independent audit.',
   'Security review, two-phone field data and third-party validation remain separate gates.'
  ]
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=makeEvidenceReport();
 const outFlag=process.argv.indexOf('--out');
 if(outFlag!==-1){
  const name=process.argv[outFlag+1];
  if(!name||name.startsWith('--'))throw Error('Missing --out file');
  const target=resolve(name);mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,JSON.stringify(report,null,2)+'\n','utf8');
  process.stdout.write('OEP: '+report.runCount+' synthetic runs, '+report.passedInvariantChecks+
   ' invariant checks, output: '+target+'\n');
 }else process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
