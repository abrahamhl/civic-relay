import test from 'node:test';
import assert from 'node:assert/strict';
import {clusterReports,assessIncident,incidentToCap,citizenAdvice}
  from '../src/hazard-reports.mjs';

const T=Date.UTC(2026,10,17,4,0);
const pos={lat:39.4269,lon:-0.4174};
const reports=Array.from({length:3},(_,i)=>({
  kind:'STREET_FLOODED',...pos,at:T+i*3000,deviceId:'citizen-key-'+i
}));
const event=()=>clusterReports(reports)[0];

test('P0: arbitrary government-looking source cannot elevate a citizen incident',()=>{
  const c=event();
  const baseline=assessIncident(c);
  const forged=assessIncident(c,{official:[{
    ...pos,at:T,family:'WATER',source:'112-ADMIN-FAKE',
    authorityVerified:true,official:true,ref:'fake'
  }]});
  assert.equal(forged.pReal,baseline.pReal);
  assert.equal(forged.state,baseline.state);
  assert.notEqual(forged.state,'OFFICIAL');
  assert.equal(forged.canPublicWarn,false);
  assert.equal(forged.publicAlertAuthorityVerified,false);
  assert.equal(forged.modelCalibrationVerified,false);
  assert.equal(forged.individualHumanIdentityVerified,false);
  assert.equal(forged.official.authorityVerified,false);
  assert.equal(forged.official.usedForScoring,false);
});
test('P0: caller-provided sensor IDs and official flags cannot boost or suppress incident probability',()=>{
  const c=event();
  const baseline=assessIncident(c);
  for(const agrees of [true,false]){
    const spoofed=assessIncident(c,{sensors:[{
      id:'fake-official-gauge',family:'WATER',...pos,official:true,agrees
    }]});
    assert.equal(spoofed.pReal,baseline.pReal);
    assert.equal(spoofed.canPublicWarn,false);
    assert.equal(spoofed.sensorMeasurementsAuthenticated,false);
  }
});
test('P0: citizen CAP cannot be Actual/Public/Observed even when caller forges authority and high confidence',()=>{
  const c=event(),a=assessIncident(c);
  const xml=incidentToCap(a,c,{now:T+60000});
  assert.match(xml,/<status>Exercise<\/status>/);
  assert.match(xml,/<scope>Restricted<\/scope>/);
  assert.match(xml,/<certainty>Unknown<\/certainty>/);
  assert.doesNotMatch(xml,/<certainty>Observed<\/certainty>/);
  const fake={...a,state:'OFFICIAL',pReal:1,publicAlertAuthorityVerified:true};
  assert.throws(()=>incidentToCap(fake,c,{now:T+60000}),/estado OFFICIAL/);
  assert.throws(()=>incidentToCap(a,c,{now:T+60000,exercise:false}),/CAP Actual bloqueado/);
});
test('P0: an untrusted public reference cannot tell a resident that the emergency authority is managing their case',()=>{
  const a={state:'OFFICIAL',official:{source:'UNVERIFIED_PUBLIC_REFERENCE'}};
  const reply=citizenAdvice('STREET_FLOODED',a);
  assert.equal(reply.call112,false);
  assert.match(reply.text,/no confirma que un organismo esté gestionando tu caso/);
  assert.match(citizenAdvice('PERSON_TRAPPED',a).text,/llama al 112 ahora/i);
});
test('P0: a future or stale alleged official observation cannot enter the contextual evidence',()=>{
  const c=event();
  for(const at of [T-8*3600000,T+8*3600000]){
    const a=assessIncident(c,{official:[{family:'WATER',source:'fake',...pos,at}]});
    assert.equal(a.official,null);
    assert.equal(a.canPublicWarn,false);
  }
});


import {toCap,railIncidentToCap} from '../src/interop.mjs';
import {situationReport} from '../src/incident-ops.mjs';

test('P0: low-level CAP serializer defaults to restricted exercise and required restriction element',()=>{
  const xml=toCap({identifier:'LAB-1',sender:'test@example.invalid',sent:T,info:{
    category:'Rescue',event:'Test-only',urgency:'Unknown',severity:'Unknown',certainty:'Unknown'
  }});
  assert.match(xml,/<status>Exercise<\/status>/);
  assert.match(xml,/<scope>Restricted<\/scope>/);
  assert.match(xml,/<restriction>Exercise participants only;/);
  assert.doesNotMatch(xml,/<scope>Public<\/scope>/);
  const custom=toCap({identifier:'LAB-2',sender:'test@example.invalid',sent:T,
    status:'Exercise',scope:'Restricted',restriction:'Test <only>',
    info:{category:'Rescue',event:'Test-only',urgency:'Unknown',severity:'Unknown',certainty:'Unknown'}});
  assert.match(custom,/<restriction>Test &lt;only&gt;<\/restriction>/);
});
test('P0: experimental rail incident never becomes CAP Actual / Observed by omission',()=>{
  const xml=railIncidentToCap({site:'TEST-SYNTHETIC',center:pos,
    counts:{TRAPPED:1,INJURED_SERIOUS:2,NO_RESPONSE:5}},{now:T});
  assert.match(xml,/<status>Exercise<\/status>/);
  assert.match(xml,/<certainty>Unknown<\/certainty>/);
  assert.match(xml,/<restriction>Exercise participants only;/);
  assert.doesNotMatch(xml,/<certainty>Observed<\/certainty>/);
});
test('P0: self-issued incident-ops exercise credential cannot request an operational CAP',async()=>{
  await assert.rejects(situationReport({}, {}, {}, {now:T,exercise:false}),/CAP Actual bloqueado/);
  await assert.rejects(situationReport({}, {}, {}, {now:T,exercise:'false'}),/CAP Actual bloqueado/);
});
