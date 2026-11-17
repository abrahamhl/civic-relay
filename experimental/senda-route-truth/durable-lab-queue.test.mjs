import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import {createDurableLabQueue} from './durable-lab-queue.mjs';
const fixture=()=>{
 const directory=mkdtempSync(join(tmpdir(),'senda-durable-'));
 let now=100000;
 return {directory,time:()=>now,advance:(dt)=>{now+=dt},setTime:(t)=>{now=t},
  engine:(extra={})=>createDurableLabQueue({directory,now:()=>now,maxAttempts:4,...extra}),
  cleanup:()=>rmSync(directory,{recursive:true,force:true})};
};
const msg=(id,overrides={})=>({id,category:'SOS_EXPLICIT',consented:true,
 destination:'LAB_CENTRE',ttlSeconds:60,payload:{synthetic:true},...overrides});
const adapter=({available=true,receipt=true}={})=>({
 id:'IPC_LAB',kind:'SIMULATOR_ADAPTER',evidence:'SIMULATED',
 describe:async()=>({available,permitted:true,compatible:true,secure:true,reliability:1,latencyMs:1,energyCost:0,monetaryCost:0,capacity:1}),
 send:async envelope=>({accepted:true,...(receipt?{receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',messageId:envelope.id,transportId:'IPC_LAB'}}:{})})
});
test('durable single-writer queue survives process-recreation with original TTL and synthetic ACK',async()=>{
 const f=fixture();try {
  const e=f.engine();e.registerAdapter(adapter({available:false}));
  assert.equal(e.enqueue(msg('PERSIST_01')).status,'QUEUED');
  assert.equal((await e.dispatch('PERSIST_01')).status,'QUEUED');
  f.advance(1200);
  const recovered=f.engine();
  assert.equal(recovered.inspect('PERSIST_01').status,'QUEUED');
  recovered.registerAdapter(adapter());
  const done=await recovered.dispatch('PERSIST_01');
  assert.equal(done.status,'ACK_SYNTHETIC');
  assert.equal(done.hasPayload,false);
  assert.equal(f.engine().inspect('PERSIST_01').status,'ACK_SYNTHETIC');
  assert.throws(()=>f.engine().enqueue(msg('PERSIST_01')),/tombstone/i);
 }finally{f.cleanup()}
});
test('corrupted journal rejects restoration, rather than deleting or silently claiming delivery',()=>{
 const f=fixture();try {
  const e=f.engine();e.enqueue(msg('CORRUPTION'));
  const file=e.getJournalPath();
  writeFileSync(file,readFileSync(file,'utf8').replace('CORRUPTION','CORRUPTED'));
  assert.throws(()=>f.engine(),/Corrupt|tampered/i);
 }finally{f.cleanup()}
});
test('clock rollback after process restart quarantines queued message with no ACK',()=>{
 const f=fixture();try {
  f.engine().enqueue(msg('ROLLBACK_01'));
  f.advance(8000);f.engine().inspect('ROLLBACK_01');
  f.setTime(100001);
  const r=f.engine().inspect('ROLLBACK_01');
  assert.equal(r.status,'CLOCK_UNCERTAIN');
  assert.equal(r.hasPayload,false);
  assert.equal(f.engine().inspect('ROLLBACK_01').status,'CLOCK_UNCERTAIN');
 }finally{f.cleanup()}
});
test('expired queued payload is wiped from journal on startup without transport',()=>{
 const f=fixture();try {
  f.engine().enqueue(msg('EXPIRED_01',{ttlSeconds:1}));
  f.advance(1100);
  const restored=f.engine();
  assert.equal(restored.inspect('EXPIRED_01').status,'EXPIRED');
  assert.equal(readFileSync(restored.getJournalPath(),'utf8').includes('synthetic":true'),false);
 }finally{f.cleanup()}
});
test('revocation retains tombstone after reboot; cannot resurrect payload or consent',()=>{
 const f=fixture();try {
  const e=f.engine();e.enqueue(msg('REVOKE_01'));
  assert.equal(e.revoke('REVOKE_01'),true);
  const restored=f.engine();
  assert.equal(restored.inspect('REVOKE_01').status,'REVOKED');
  assert.equal(restored.inspect('REVOKE_01').hasPayload,false);
  assert.throws(()=>restored.enqueue(msg('REVOKE_01')),/tombstone/i);
 }finally{f.cleanup()}
});
test('repeated offline polling does not consume attempted send budget',async()=>{
 const f=fixture();try {
  const e=f.engine({maxAttempts:2});e.registerAdapter(adapter({available:false}));
  e.enqueue(msg('DELAYED_01'));
  for(let n=0;n<8;n++){await e.dispatch('DELAYED_01');f.advance(1500);}
  assert.equal(e.inspect('DELAYED_01').status,'QUEUED');
  const recovery=f.engine({maxAttempts:2});recovery.registerAdapter(adapter());
  assert.equal((await recovery.dispatch('DELAYED_01')).status,'ACK_SYNTHETIC');
 }finally{f.cleanup()}
});
test('attempt budget is journaled and enforced across restart without false receiver proof',async()=>{
 const f=fixture();try {
  const e=f.engine({maxAttempts:2});e.registerAdapter(adapter({receipt:false}));
  e.enqueue(msg('NO_ACK_01'));
  assert.equal((await e.dispatch('NO_ACK_01')).status,'FORWARDED_UNCONFIRMED');
  f.advance(1200);
  const r=f.engine({maxAttempts:2});r.registerAdapter(adapter({receipt:false}));
  assert.equal((await r.dispatch('NO_ACK_01')).status,'FORWARDED_UNCONFIRMED');
  const after=f.engine({maxAttempts:2});
  assert.equal((await after.dispatch('NO_ACK_01')).status,'EXHAUSTED');
  assert.equal(after.inspect('NO_ACK_01').hasPayload,false);
 }finally{f.cleanup()}
});
test('invalid consent, destination, duplicate ID and capacity restrictions stay fail closed',()=>{
 const f=fixture();try {
  const e=f.engine({maxEntries:1});
  assert.throws(()=>e.enqueue(msg('BAD_01',{consented:false})),/consent/i);
  assert.throws(()=>e.enqueue(msg('BAD_01',{destination:'112'})),/synthetic/i);
  e.enqueue(msg('GOOD_01'));
  assert.throws(()=>e.enqueue(msg('OTHER_02')),/full/i);
  assert.throws(()=>e.enqueue(msg('GOOD_01')),/already|tombstone/i);
 }finally{f.cleanup()}
});
