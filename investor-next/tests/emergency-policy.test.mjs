import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capabilityState,recordSafetyResponse,revokeSafetyRecord,expireSafetyRecord,
 energyPolicy,acceptAuthorizedCapAlert} from '../lib/emergency-policy.mjs';
test('all capability states map consistently',()=>{
 assert.equal(capabilityState({supported:false}),'UNSUPPORTED');
 assert.equal(capabilityState({restricted:true}),'RESTRICTED');
 assert.equal(capabilityState({enabled:false}),'DISABLED');
 assert.equal(capabilityState({enabled:true}),'PERMISSION_REQUIRED');
 assert.equal(capabilityState({enabled:true,permission:true}),'AVAILABLE');
});
test('no implicit human harm or location leakage',()=>{
 assert.throws(()=>recordSafetyResponse({response:'SOS_EXPLICIT'}),/consent/);
 assert.throws(()=>recordSafetyResponse({response:'NO_CONTACT',consented:true}),/explicit/);
 const r=recordSafetyResponse({response:'SAFE',consented:true,shareLocation:false,location:{lat:1,lon:2},now:10000});
 assert.equal(r.location,null);
 assert.equal(revokeSafetyRecord(r).response,'UNKNOWN');
 assert.equal(revokeSafetyRecord(r).location,null);
 assert.equal(expireSafetyRecord(r,Date.parse(r.expiresAt)+1).revoked,true);
});
test('energy policy does not claim OS-level changes or measured power',()=>{
 assert.equal(energyPolicy(5,true).relay,false);
 assert.equal(energyPolicy(10,true).profile,'CRITICAL');
 assert.equal(energyPolicy(27,true).profile,'CONSERVATION');
 assert.equal(energyPolicy(70,true).profile,'ALERT');
 assert.equal(energyPolicy(70,false).profile,'NORMAL');
 assert.equal(energyPolicy(70,false).systemBatterySaverChanged,false);
});
const alert={identifier:'ZONE-1',sender:'example.test',sent:'2026-10-20T12:00:00Z',expires:'2026-10-21T12:00:00Z',
 status:'Actual',scope:'Public',msgType:'Alert',event:'Earthquake',polygons:[[[1,2],[3,4],[1,4]]]};
test('unverified or test alerts never activate institutional zone',async()=>{
 const options={now:Date.parse('2026-10-20T14:00:00Z')};
 await assert.rejects(acceptAuthorizedCapAlert(alert,undefined,options),/verifier/);
 await assert.rejects(acceptAuthorizedCapAlert(alert,async()=>false,options),/Untrusted/);
 await assert.rejects(acceptAuthorizedCapAlert({...alert,status:'Exercise'},async()=>({authenticated:true,trustAnchorId:'x'}),options),/Non-actual/);
 await assert.rejects(acceptAuthorizedCapAlert({...alert,expires:'2026-10-19T14:00:00Z'},async()=>({authenticated:true,trustAnchorId:'x'}),options),/Expired/);
 const trusted=await acceptAuthorizedCapAlert(alert,async()=>({authenticated:true,trustAnchorId:'TEST_ONLY_ANCHOR'}),options);
 assert.equal(trusted.action,'ACTIVATE');
 assert.equal(trusted.permissionPolicy,'EXPLICIT_OPT_IN');
});
