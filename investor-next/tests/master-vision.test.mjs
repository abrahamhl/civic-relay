import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {MODULES,SURFACES,SCENARIOS,GATES,VISION} from '../lib/master-vision.mjs';
import {assessTransport,assessSatelliteOpportunity,classifySituation,authorizeMessage,reduceDelivery,summarizeOccupancy,simulateFamilyDelivery} from '../lib/vision-contracts.mjs';
import {generateRealEcdsaKeyPair,signAndPackRealOepPacket,verifyRealOepPacket} from '../lib/live-protocol-node.mjs';
import {crc16Ccitt} from '../lib/telecom-suite.mjs';
const root = new URL('../../',import.meta.url);
const file = path => fileURLToPath(new URL(path,root));
const now=5000;
const link={observedAt:1000,expiresAt:9000,consent:true,authorized:true,hardwareCompatible:true,evidence:'MEASURED',linkActive:true};
const message={id:'message-a',recipient:'ismael-key',createdAt:1000,expiresAt:9000};
const receipt={level:'DESTINATION_ACK',signer:'ismael-key',recipient:'ismael-key',messageId:'message-a',verification:'VERIFIED',at:4000};
const delivery = changes => reduceDelivery({message,now,receipts:[],routes:[],...changes});

test('master registry preserves all 20 modules, 8 scenarios, 8 gates and 6 surfaces with localized acceptance',()=>{
 assert.deepEqual(MODULES.map(m=>m.id),Array.from({length:20},(_,i)=>`M${String(i+1).padStart(2,'0')}`));
 assert.equal(SCENARIOS.length,8); assert.equal(GATES.length,8); assert.equal(SURFACES.length,6);
 for(const m of MODULES){
  assert.equal(m.operational,false); assert.ok(m.state.length);
  assert.ok(GATES.some(g=>g.id===m.gate));
  for(const id of m.scenarios) assert.ok(SCENARIOS.some(s=>s.id===id));
  for(const id of m.surfaces) assert.ok(SURFACES.some(s=>s.id===id));
  for(const locale of ['es','en','nl']) {assert.ok(m.title[locale]);assert.ok(m.acceptance[locale]);}
  for(const path of [...m.existing,m.contract,m.test,m.evidence]) assert.ok(existsSync(file(path)),`${m.id}: ${path}`);
 }
 const master=readFileSync(file(VISION.document),'utf8');
 for(const m of MODULES) assert.ok(master.includes(`**${m.id}**`));
 assert.equal(readFileSync(file('investor-next/public/vision-master.md'),'utf8'),master,'download must equal the canonical master');
 assert.ok(GATES.every(g=>g.status==='EVIDENCE_REQUIRED'));
});

test('S01 no route, gateway custody, recipient confirmation, reading and expiry remain distinct',()=>{
 assert.equal(simulateFamilyDelivery().status,'NO_ROUTE');
 assert.equal(simulateFamilyDelivery('GATEWAY_ACK').delivered,false);
 assert.equal(simulateFamilyDelivery('DESTINATION_ACK').status,'DESTINATION_ACK');
 assert.equal(simulateFamilyDelivery('READ').status,'READ');
 assert.equal(simulateFamilyDelivery('EXPIRED').status,'EXPIRED');
 for(const stage of ['NO_ROUTE','GATEWAY_ACK','DESTINATION_ACK','READ','EXPIRED']){
  const r=simulateFamilyDelivery(stage); assert.equal(r.kind,'SYNTHETIC_SCENARIO');assert.equal(r.physicalDelivery,false);
  assert.equal(r.encryptionImplemented,false);assert.equal(r.durableCustodyImplemented,false);
 }
});

test('delivery rejects wrong endpoint, wrong message, unverified, future, expired and intermediate receipts',()=>{
 for(const change of [{signer:'neighbor'},{recipient:'other'},{messageId:'other'},{verification:'UNVERIFIED'},{at:9999},{at:999},{level:'HOP_ACK'},{level:'GATEWAY_ACK'},{level:'READ'}]) {
  assert.equal(delivery({receipts:[{...receipt,...change}]}).delivered,false,JSON.stringify(change));
 }
 assert.equal(delivery({receipts:[receipt]}).delivered,true);
 assert.equal(delivery({receipts:[receipt,receipt]}).status,'DESTINATION_ACK');
 assert.equal(delivery({receipts:[receipt],now:10000}).delivered,true,'historical receipt remains valid');
 assert.equal(delivery({receipts:[{...receipt,at:9500}],now:10000}).status,'EXPIRED');
 assert.equal(delivery({receipts:[receipt],consent:false}).status,'REVOKED');
 assert.equal(delivery({now:NaN}).status,'UNKNOWN');
 assert.equal(delivery({message:{...message,expiresAt:1000}}).status,'UNKNOWN');
});

test('read requires a preceding destination receipt; replay ordering does not regress the status',()=>{
 const read={...receipt,level:'READ',at:4500};
 assert.equal(delivery({receipts:[read,receipt]}).status,'READ');
 assert.equal(delivery({receipts:[{...read,at:3000},receipt]}).status,'DESTINATION_ACK');
});

test('routes fail closed on absent consent, authorization, hardware, stale or modelled metrics',()=>{
 assert.equal(assessTransport(link,now).available,true);
 for(const change of [{consent:false},{authorized:false},{hardwareCompatible:false},{evidence:'MODELLED'},{linkActive:false},{expiresAt:now},{observedAt:now+1},{expiresAt:NaN}]){
  assert.equal(assessTransport({...link,...change},now).available,false);
  assert.equal(delivery({routes:[{...link,...change}]}).status,'NO_ROUTE');
 }
 assert.equal(delivery({routes:[link]}).status,'PENDING');
});

test('orbital geometry is never an uplink or guaranteed delivery, including GEO',()=>{
 const orbit={observedAt:1000,expiresAt:9000,orbit:'LEO',format:'TLE',source:'fixture-only',propagator:'SGP4',elevationDeg:30,uncertaintySeconds:10};
 assert.equal(assessSatelliteOpportunity(orbit,now).status,'GEOMETRY_ONLY');
 const compatible={...orbit,hardwareCompatible:true,authorized:true,serviceCompatible:true};
 for(const kind of ['LEO','GEO']) {
  const r=assessSatelliteOpportunity({...compatible,orbit:kind},now);
  assert.equal(r.status,'SERVICE_CANDIDATE');assert.equal(r.deliveryGuaranteed,false);
 }
 for(const change of [{expiresAt:now},{source:''},{propagator:'KEPLER_SYNTHETIC'},{elevationDeg:NaN},{elevationDeg:-1},{uncertaintySeconds:undefined}]) assert.equal(assessSatelliteOpportunity({...compatible,...change},now).status,'NOT_AVAILABLE');
});

test('observations, forecasts and risk models never become official orders',()=>{
 const signal={observedAt:1000,expiresAt:9000,source:'fixture',permission:'AUTHORIZED'};
 for(const kind of ['OBSERVATION','FORECAST','MODEL_RISK','COMMUNITY_REPORT']) {
  const r=classifySituation({...signal,kind},now);assert.equal(r.kind,kind);assert.equal(r.canIssueOrder,false);
 }
 assert.equal(classifySituation({...signal,kind:'OFFICIAL_WARNING'},now).accepted,false);
 assert.equal(classifySituation({...signal,kind:'FORECAST',expiresAt:4000},now).accepted,false);
 assert.equal(classifySituation({...signal,kind:'FORECAST',permission:'UNKNOWN'},now).accepted,false);
 assert.equal(classifySituation({...signal,kind:'OFFICIAL_WARNING',authorityVerdict:'VERIFIED_TRUST_ANCHOR'},now).canIssueOrder,false);
});

test('institutional message types require current authority, scope and explicit non-revocation',()=>{
 const context={consent:true,observedAt:1000,expiresAt:9000,authorityVerdict:'VERIFIED_TRUST_ANCHOR',revoked:false,scopes:['OFFICIAL_ALERT','OPERATIONAL_ORDER']};
 for(const type of ['OFFICIAL_ALERT','OPERATIONAL_ORDER']) {
  assert.equal(authorizeMessage(type,context,now),true);
  for(const change of [{consent:false},{revoked:true},{revoked:undefined},{scopes:[]},{authorityVerdict:'SELF_SIGNED'},{expiresAt:now}]) assert.equal(authorizeMessage(type,{...context,...change},now),false);
 }
 assert.equal(authorizeMessage('PERSONAL',{consent:true},now),true);
 assert.equal(authorizeMessage('UNKNOWN',context,now),false);
});

test('RF counts and cadastral capacity cannot establish human occupancy',()=>{
 assert.deepEqual(summarizeOccupancy({wifiCount:5,registeredCapacity:5}),{status:'UNKNOWN',people:null});
 assert.equal(summarizeOccupancy({confirmedPeople:-1}).status,'UNKNOWN');
 assert.equal(summarizeOccupancy({confirmedPeople:0}).people,0);
});

test('P0 signed packet rejects every independently mutable display field and substituted valid frame',async()=>{
 const keys=await generateRealEcdsaKeyPair();
 const packet=await signAndPackRealOepPacket({privateKey:keys.keyPair.privateKey,publicKeySpkiHex:keys.publicKeySpkiHex,fingerprint:keys.fingerprint,status:'SAFE'});
 assert.equal((await verifyRealOepPacket(packet)).identityAuthenticated,false);
 const attacks=[{messageId:'OTHER'},{status:'SOS_EXPLICIT'},{zoneId:'OTHER'},{sectorIndex:2},{batteryPct:1},{timestampMs:packet.timestampMs+1},{protocol:'OFFICIAL_ALERT'},{byteLength:23},{crc16Hex:'0x0000'},{signerFingerprint:'00:00:00:00:00:00:00:00'},{publicKeySpkiHex:packet.publicKeySpkiHex+'G'},{signatureHex:packet.signatureHex+'Z'}];
 for(const change of attacks) assert.equal((await verifyRealOepPacket({...packet,...change})).valid,false,JSON.stringify(change));
 const bytes=Uint8Array.from(packet.binaryFrameHex.split(' ').map(h=>parseInt(h,16)));
 bytes[5]^=1; const crc=crc16Ccitt(bytes.subarray(0,22)); bytes[22]=crc>>8; bytes[23]=crc&255;
 const frame=Array.from(bytes,b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
 assert.equal((await verifyRealOepPacket({...packet,binaryFrameHex:frame,crc16Hex:'0x'+crc.toString(16).padStart(4,'0').toUpperCase()})).valid,false);
 // An attacker updating both fields and canonical text still cannot re-sign.
 assert.equal((await verifyRealOepPacket({...packet,status:'SOS_EXPLICIT',canonicalString:packet.canonicalString.replace('|SAFE|','|SOS_EXPLICIT|')})).valid,false);
});
