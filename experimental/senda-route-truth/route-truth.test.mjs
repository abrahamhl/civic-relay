import test from 'node:test';
import assert from 'node:assert/strict';
import { assessModelRoute } from './route-truth.mjs';
const node = (id, extra={}) => ({id,consent:true,powered:true,radioEnabled:true,role:'RELAY',...extra});
const link = (from,to,extra={}) => ({from,to,kind:'ACTIVE_RADIO',authorized:true,enabled:true,dutyCycleAllowed:true,...extra});
const model = (nodes,links,extra={}) => assessModelRoute({nodes,links,source:'A',destination:'C',...extra});
test('authorized multi-hop is only model-reachable, never physically delivered',()=>{
 const r=model([node('A'),node('B'),node('C')],[link('A','B'),link('B','C')]);
 assert.equal(r.reason,'MODEL_PATH_FOUND_NOT_DELIVERED');
 assert.deepEqual(r.path,['A','B','C']);
 assert.equal(r.physicalDeliveryVerified,false);
 assert.equal(r.recipientAcknowledged,false);
});
test('passive RF presence and reflection are not packet relays',()=>{
 assert.equal(model([node('A'),node('B',{role:'PASSIVE'}),node('C')],[link('A','B'),link('B','C')]).modelReachable,false);
 assert.equal(model([node('A'),node('B'),node('C')],[link('A','B',{kind:'PASSIVE_REFLECTION'}),link('B','C')]).modelReachable,false);
});
test('nonconsenting, unpowered and disabled-radio relay nodes are excluded',()=>{
 for(const field of [{consent:false},{powered:false},{radioEnabled:false}]) {
   assert.equal(model([node('A'),node('B',field),node('C')],[link('A','B'),link('B','C')]).modelReachable,false);
 }
});
test('unauthorized, disabled, over-duty-cycle and observation links are rejected',()=>{
 for(const field of [{authorized:false},{enabled:false},{dutyCycleAllowed:false},{kind:'OBSERVATION_ONLY'}]) {
   assert.equal(model([node('A'),node('B'),node('C')],[link('A','B',field),link('B','C')]).modelReachable,false);
 }
});
test('hop budget cannot be bypassed',()=>{
 assert.equal(model([node('A'),node('B'),node('C')],[link('A','B'),link('B','C')],{maxHops:1}).modelReachable,false);
});
test('duplicate and unknown endpoint fail closed',()=>{
 assert.throws(()=>model([node('A'),node('A'),node('C')],[]));
 assert.equal(model([node('A'),node('B')],[]).reason,'UNKNOWN_ENDPOINT');
});
test('stable shortest-path tie-break',()=>{
 const r=model([node('A'),node('B'),node('D'),node('C')],[link('A','D'),link('D','C'),link('A','B'),link('B','C')]);
 assert.deepEqual(r.path,['A','B','C']);
});
test('same source and destination is not mistaken for delivery',()=>{
 assert.equal(assessModelRoute({nodes:[node('A')],links:[],source:'A',destination:'A'}).modelReachable,false);
});
