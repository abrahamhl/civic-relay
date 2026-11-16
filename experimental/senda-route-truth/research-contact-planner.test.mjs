import test from 'node:test';
import assert from 'node:assert/strict';
import {planHypotheticalContacts as plan} from './research-contact-planner.mjs';
const n=(id,role='RELAY',override={})=>({id,role,consent:true,powered:true,radioEnabled:true,...override});
const c=(from,to,startMs=0,endMs=10000,probabilityLowerBound=.95,overrides={})=>({from,to,startMs,endMs,probabilityLowerBound,rateBytesPerSec:1000,handshakeMs:100,energyMj:30,kind:'ACTIVE_RADIO',authorized:true,enabled:true,dutyCycleAllowed:true,...overrides});
const example=(contacts,overrides={})=>plan({nodes:[n('A','SENDER'),n('B'),n('C','RECEIVER')],contacts,source:'A',destination:'C',startMs:0,deadlineMs:10000,payloadBytes:100,maxHops:3,...overrides});
test('reliability threshold selects two contacts despite shortest direct physical hop',()=>{
 const r=example([c('A','C',0,5000,.55),c('A','B',0,5000,.95),c('B','C',250,5000,.95)],{minLowerBound:.85});
 assert.deepEqual(r.path,['A','B','C']);
 assert.ok(Math.abs(r.conservativeSuccessLowerBound-.9)<1e-12);
 assert.equal(r.arrivalMs,450);
 assert.equal(r.evidenceLevel,'HYPOTHETICAL_CONTACT_MODEL_ONLY');
 assert.equal(r.physicalDeliveryVerified,false);
});
test('too-short contact, missed windows, deadline and low energy fail closed',()=>{
 assert.equal(example([c('A','C',0,100)],{}).modelFeasible,false);
 assert.equal(example([c('A','B',0,1000),c('B','C',0,200)],{}).modelFeasible,false);
 assert.equal(example([c('A','C',0,3000)],{deadlineMs:100}).modelFeasible,false);
 assert.equal(example([c('A','C')],{maxEnergyMj:29}).modelFeasible,false);
});
test('passive reflection, unknown role and nonconsenting node never produce route',()=>{
 assert.equal(example([c('A','C',0,5000,.99,{kind:'PASSIVE_REFLECTION'})]).modelFeasible,false);
 assert.equal(example([c('A','C',0,5000,.99,{authorized:false})]).modelFeasible,false);
 assert.equal(example([c('A','C',0,5000,.99,{dutyCycleAllowed:false})]).modelFeasible,false);
 assert.equal(plan({nodes:[n('A','UNKNOWN'),n('C','RECEIVER')],contacts:[c('A','C')],source:'A',destination:'C',startMs:0,deadlineMs:5000,payloadBytes:100}).modelFeasible,false);
});
test('Bonferroni lower bound never assumes link independence',()=>{
 const r=example([c('A','B',0,1000,.6),c('B','C',0,1000,.6)]);
 assert.ok(Math.abs(r.conservativeSuccessLowerBound-.2)<1e-12);
 assert.equal(r.physicalDeliveryVerified,false);
 assert.equal(example([c('A','B',0,1000,.6),c('B','C',0,1000,.6)],{minLowerBound:.3}).modelFeasible,false);
});
test('invalid probability/unknown gateway/duplicate node cannot enable route',()=>{
 assert.equal(example([c('A','C',0,5000,1.01)]).modelFeasible,false);
 assert.throws(()=>plan({nodes:[n('A'),n('A')],contacts:[],source:'A',destination:'A',startMs:0,deadlineMs:5000,payloadBytes:1}),/node/i);
 const r=plan({nodes:[n('A','SENDER'),n('SATELLITE','GATEWAY'),n('C','RECEIVER')],contacts:[c('A','SATELLITE',0,5000),c('SATELLITE','C',0,5000)],source:'A',destination:'C',startMs:0,deadlineMs:5000,payloadBytes:100});
 assert.equal(r.modelFeasible,true);
 assert.equal(r.satelliteAccessVerified,false);
});
