import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStoreForwardEngine,createInMemoryAdapter} from '../lib/store-forward.mjs';

test('fake receiver metadata ledger stays bounded after many synthetic deliveries',async()=>{
 let now=100000;
 const engine=createStoreForwardEngine({now:()=>now,maxEntries:1100});
 const adapter=createInMemoryAdapter({maxReceiptEntries:3});
 engine.registerAdapter(adapter);
 for(let i=0;i<5;i++){
   const id=`BOUND_${i}`;
   engine.enqueue({id,category:'SAFE',consented:true,payload:{},createdAt:now,ttlSeconds:60});
   assert.equal((await engine.dispatch(id)).status,'ACK_SYNTHETIC');
 }
 assert.deepEqual(adapter.getReceived().map(r=>r.id),['BOUND_2','BOUND_3','BOUND_4']);
 assert.throws(()=>createInMemoryAdapter({maxReceiptEntries:0}),/capacity/);
});

const message=(id='EXERCISE_1',extra={})=>({
 id,category:'SOS_EXPLICIT',consented:true,destination:'LAB_CENTRE',
 payload:{anonymous:true},ttlSeconds:60,...extra
});
const lab=()=>{let t=100000;return {
 now:()=>t,advance:(ms)=>{t+=ms;},
 engine:(p={})=>createStoreForwardEngine({now:()=>t,retryMs:1000,...p})
};};

test('consent, synthetic destinations, bounded retention and payload validated',()=>{
 const clock=lab(),engine=clock.engine();
 assert.throws(()=>engine.enqueue(message('X',{consented:false})),/consent/i);
 assert.throws(()=>engine.enqueue(message('X',{destination:'112'})),/synthetic/i);
 assert.throws(()=>engine.enqueue(message('X',{category:'UNKNOWN'})),/explicit/i);
 assert.throws(()=>engine.enqueue(message('X',{ttlSeconds:90000})),/lifetime/i);
 assert.throws(()=>engine.enqueue(message('X',{payload:{blob:'x'.repeat(5000)}})),/oversized/i);
 assert.equal(engine.snapshot().length,0);
});
test('synthetic ACK is different from transport acceptance and field delivery',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter({receipts:false});
 engine.registerAdapter(adapter);engine.enqueue(message());
 const pending=await engine.dispatch('EXERCISE_1');
 assert.equal(pending.status,'FORWARDED_UNCONFIRMED');
 assert.equal(pending.evidence,'SIMULATED_ONLY');
 assert.equal(pending.hasPayload,true);
 assert.equal(adapter.getReceived().length,1);
});
test('fake receipt is explicitly synthetic and clears content after simulated acknowledgment',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 engine.registerAdapter(adapter);engine.enqueue(message());
 const done=await engine.dispatch('EXERCISE_1');
 assert.equal(done.status,'ACK_SYNTHETIC');
 assert.equal(done.receiptKind,'SIMULATED_RECEIVER_RECEIPT');
 assert.equal(done.hasPayload,false);
 assert.equal((await engine.dispatch('EXERCISE_1')).attempts,1);
 assert.equal(adapter.getReceived().length,1);
});
test('offline queue retries after adapter becomes available',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter({available:false});
 engine.registerAdapter(adapter);engine.enqueue(message());
 assert.equal((await engine.dispatch('EXERCISE_1')).status,'QUEUED');
 adapter.setAvailable(true);clock.advance(2000);
 assert.equal((await engine.retryDue())[0].status,'ACK_SYNTHETIC');
});
test('transport failures do not fabricate receipts; bounded retries clear payload',async()=>{
 const clock=lab(),engine=clock.engine({maxAttempts:2}),adapter=createInMemoryAdapter({failures:3});
 engine.registerAdapter(adapter);engine.enqueue(message());
 assert.equal((await engine.dispatch('EXERCISE_1')).status,'QUEUED');
 clock.advance(2000);
 assert.equal((await engine.retryDue())[0].status,'EXHAUSTED');
 assert.equal(engine.inspect('EXERCISE_1').hasPayload,false);
 assert.equal(adapter.getReceived().length,0);
});
test('TTL expires even without connectivity; timed-out SOS does not imply rescue',async()=>{
 const clock=lab(),engine=clock.engine();
 engine.enqueue(message('LATE',{ttlSeconds:1}));
 clock.advance(1000);
 assert.equal((await engine.dispatch('LATE')).status,'EXPIRED');
 assert.equal(engine.inspect('LATE').hasPayload,false);
});
test('same envelope deduplicates, conflicting ID throws, and audit purge erases trace',()=>{
 const clock=lab(),engine=clock.engine();
 assert.equal(engine.enqueue(message()).status,'QUEUED');
 assert.equal(engine.enqueue(message()).status,'QUEUED');
 assert.equal(engine.snapshot().length,1);
 assert.throws(()=>engine.enqueue(message('EXERCISE_1',{payload:{different:true}})),/Conflicting/);
 assert.equal(engine.revoke('EXERCISE_1'),true);
 assert.equal(engine.inspect('EXERCISE_1').status,'REVOKED');
 assert.equal(engine.inspect('EXERCISE_1').hasPayload,false);
 assert.equal(engine.purge('EXERCISE_1'),true);
 assert.equal(engine.inspect('EXERCISE_1'),null);
 assert.equal(engine.audit().length,0);
});
test('critical energy holds non-SOS status messages, but permits explicit SOS',async()=>{
 const clock=lab(),engine=clock.engine({energyProfile:'CRITICAL'}),adapter=createInMemoryAdapter();
 engine.registerAdapter(adapter);
 engine.enqueue(message('SAFE_1',{category:'SAFE'}));
 engine.enqueue(message('SOS_1'));
 assert.equal((await engine.dispatch('SAFE_1')).status,'QUEUED');
 assert.equal((await engine.dispatch('SOS_1')).status,'ACK_SYNTHETIC');
 assert.deepEqual(adapter.getReceived().map(x=>x.id),['SOS_1']);
});
test('unknown, no contact and institution spoofing are never accepted as exercise messages',()=>{
 const clock=lab(),engine=clock.engine();
 for(const category of ['UNKNOWN','NO_CONTACT','INJURED','RESCUED'])
   assert.throws(()=>engine.enqueue(message('X',{category})),/explicit/);
 assert.throws(()=>engine.enqueue(message('X',{destination:'OFFICIAL_RESCUE'})),/synthetic/);
});
test('reject adapters without explicit simulation evidence and capacity',async()=>{
 const clock=lab(),engine=clock.engine();
 assert.throws(()=>engine.registerAdapter({id:'RADIO',kind:'REAL',evidence:'PHYSICALLY_TESTED'}),/simulated/);
 const bad=createInMemoryAdapter({id:'BAD'});bad.describe=async()=>({available:true,permitted:true,
   compatible:true,secure:false,reliability:1,latencyMs:0,energyCost:0,monetaryCost:0,capacity:1});
 engine.registerAdapter(bad);engine.enqueue(message());
 assert.equal((await engine.dispatch('EXERCISE_1')).status,'QUEUED');
});
test('bounded queue fails closed instead of silently dropping SOS messages',()=>{
 const clock=lab(),engine=clock.engine({maxEntries:1});
 engine.enqueue(message());
 assert.throws(()=>engine.enqueue(message('EXERCISE_2')),/queue full/i);
});

test('revocation during asynchronous send cannot be resurrected by a late receipt',async()=>{
 const clock=lab(),engine=clock.engine();let finish;
 const adapter=createInMemoryAdapter();
 adapter.send=()=>new Promise(resolve=>{finish=resolve;});
 engine.registerAdapter(adapter);engine.enqueue(message());
 const pending=engine.dispatch('EXERCISE_1');
 // Wait until async transport description has completed and send() is pending.
 for(let i=0;i<10&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function');
 engine.revoke('EXERCISE_1');
 finish({accepted:true,receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'EXERCISE_1',transportId:'LAB_GATEWAY'}});
 const done=await pending;
 assert.equal(done.status,'REVOKED');
 assert.equal(done.hasPayload,false);
 assert.equal(engine.inspect('EXERCISE_1').status,'REVOKED');
});

test('forged or mismatched receiver receipt cannot become a successful ACK',async()=>{
 const clock=lab(),engine=clock.engine();
 const forged=createInMemoryAdapter({id:'LAB_FAKE'});
 forged.send=async()=>({accepted:true,receipt:{
  kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'SOME_OTHER_MESSAGE',transportId:'LAB_FAKE'}});
 engine.registerAdapter(forged);engine.enqueue(message());
 const state=await engine.dispatch('EXERCISE_1');
 assert.equal(state.status,'FORWARDED_UNCONFIRMED');
 assert.equal(state.receiptKind,null);
 assert.equal(state.hasPayload,true);
});
test('fallback next adapter after failure; no real measurement or delivery claims',async()=>{
 const clock=lab(),engine=clock.engine({maxAttempts:3});
 const first=createInMemoryAdapter({id:'LAB_FIRST',failures:3,reliability:1});
 const second=createInMemoryAdapter({id:'LAB_SECOND',reliability:.7});
 engine.registerAdapter(first);engine.registerAdapter(second);engine.enqueue(message());
 const initial=await engine.dispatch('EXERCISE_1');
 assert.equal(initial.status,'QUEUED');
 assert.equal(initial.selectedTransport,'LAB_FIRST');
 clock.advance(2000);
 const retry=(await engine.retryDue())[0];
 assert.equal(retry.status,'ACK_SYNTHETIC');
 assert.equal(retry.selectedTransport,'LAB_SECOND');
 assert.equal(second.getReceived().length,1);
});

test('terminal ACK and EXPIRED tombstones reject replay without retaining a duplicate payload',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 engine.registerAdapter(adapter);
 engine.enqueue(message('TERMINAL_ACK',{payload:{secret:'sensitive-synthetic-blob'}}));
 assert.equal((await engine.dispatch('TERMINAL_ACK')).status,'ACK_SYNTHETIC');
 assert.equal(engine.inspect('TERMINAL_ACK').hasPayload,false);
 assert.throws(()=>engine.enqueue(message('TERMINAL_ACK',{payload:{secret:'sensitive-synthetic-blob'}})),/Terminal message ID/);
 // This fixture never stores plaintext messages in the fake transport's receipt ledger.
 assert.equal(adapter.getReceived()[0].payload,undefined);
 engine.enqueue(message('TERMINAL_EXP',{ttlSeconds:1,payload:{secret:'expires'}}));
 clock.advance(1000);
 assert.equal(engine.inspect('TERMINAL_EXP').status,'EXPIRED');
 assert.equal(engine.inspect('TERMINAL_EXP').hasPayload,false);
 assert.throws(()=>engine.enqueue(message('TERMINAL_EXP',{ttlSeconds:1,payload:{secret:'expires'}})),/Terminal message ID/);
});
test('late success must be ignored if local TTL elapses during adapter send',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 let finish;
 adapter.send=()=>new Promise(resolve=>{finish=resolve;});
 engine.registerAdapter(adapter);
 engine.enqueue(message('TTL_IN_FLIGHT',{ttlSeconds:1}));
 const pending=engine.dispatch('TTL_IN_FLIGHT');
 for(let i=0;i<10&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function');
 clock.advance(1000);
 finish({accepted:true,receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',
  messageId:'TTL_IN_FLIGHT',transportId:'LAB_GATEWAY'}});
 const result=await pending;
 assert.equal(result.status,'EXPIRED');
 assert.equal(result.receiptKind,null);
 assert.equal(result.hasPayload,false);
});
test('purged message cannot be revived by a late fake receipt',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 let finish;
 adapter.send=()=>new Promise(resolve=>{finish=resolve;});
 engine.registerAdapter(adapter);
 engine.enqueue(message('PURGED'));
 const pending=engine.dispatch('PURGED');
 for(let i=0;i<10&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function');
 assert.equal(engine.purge('PURGED'),true);
 finish({accepted:true,receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',
  messageId:'PURGED',transportId:'LAB_GATEWAY'}});
 const completed=await pending;
 assert.equal(completed.status,'REVOKED');
 assert.equal(completed.hasPayload,false);
 assert.equal(engine.inspect('PURGED'),null);
 assert.equal(engine.audit().length,0);
});
test('synthetic adapter receipt ledger is metadata-only',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 engine.registerAdapter(adapter);
 engine.enqueue(message('ONLY_METADATA',{payload:{syntheticSensitive:'shouldNotPersist'}}));
 await engine.dispatch('ONLY_METADATA');
 assert.deepEqual(adapter.getReceived(),[{id:'ONLY_METADATA',provenance:'SYNTHETIC_EXERCISE_ONLY'}]);
});
test('non-object payloads (null, array, primitive) are rejected',()=>{
 const clock=lab(),engine=clock.engine();
 for(const badPayload of [null,[1,2,3],'raw-string',42,true]){
   assert.throws(()=>engine.enqueue(message('BAD_PAYLOAD',{payload:badPayload})),/Invalid or oversized payload/);
 }
});
test('concurrent dispatch calls while inFlight do not double-send or double-increment attempts',async()=>{
 const clock=lab(),engine=clock.engine(),adapter=createInMemoryAdapter();
 let finish;
 adapter.send=()=>new Promise(resolve=>{finish=resolve;});
 engine.registerAdapter(adapter);
 engine.enqueue(message('CONCURRENT_1'));
 const first=engine.dispatch('CONCURRENT_1');
 for(let i=0;i<10&&!finish;i++)await Promise.resolve();
 assert.equal(typeof finish,'function');
 const second=await engine.dispatch('CONCURRENT_1');
 assert.equal(second.attempts,1);
 finish({accepted:true,receipt:{kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'CONCURRENT_1',transportId:'LAB_GATEWAY'}});
 const done=await first;
 assert.equal(done.status,'ACK_SYNTHETIC');
 assert.equal(done.attempts,1);
});
test('cross-adapter receipt spoofing and unaccepted receipts cannot forge ACK_SYNTHETIC',async()=>{
 const clock=lab(),engine=clock.engine();
 const spoofed=createInMemoryAdapter({id:'LAB_PRIMARY'});
 spoofed.send=async()=>({accepted:true,receipt:{
  kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'SPOOF_1',transportId:'LAB_OTHER_ADAPTER'}});
 engine.registerAdapter(spoofed);
 engine.enqueue(message('SPOOF_1'));
 const r1=await engine.dispatch('SPOOF_1');
 assert.equal(r1.status,'FORWARDED_UNCONFIRMED');
 assert.equal(r1.receiptKind,null);

 const unaccepted=createInMemoryAdapter({id:'LAB_REJECT'});
 unaccepted.send=async()=>({accepted:false,receipt:{
  kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'SPOOF_2',transportId:'LAB_REJECT'}});
 const engine2=clock.engine();
 engine2.registerAdapter(unaccepted);
 engine2.enqueue(message('SPOOF_2'));
 const r2=await engine2.dispatch('SPOOF_2');
 assert.equal(r2.status,'QUEUED');
 assert.equal(r2.receiptKind,null);
});
test('REVOKED and EXHAUSTED tombstones reject message ID replay',async()=>{
 const clock=lab(),engine=clock.engine({maxAttempts:1}),adapter=createInMemoryAdapter({failures:2});
 engine.registerAdapter(adapter);
 engine.enqueue(message('REVOKED_ID'));
 engine.revoke('REVOKED_ID');
 assert.throws(()=>engine.enqueue(message('REVOKED_ID')),/Terminal message ID/);

 engine.enqueue(message('EXHAUSTED_ID'));
 assert.equal((await engine.dispatch('EXHAUSTED_ID')).status,'EXHAUSTED');
 assert.throws(()=>engine.enqueue(message('EXHAUSTED_ID')),/Terminal message ID/);
});
test('adapter describe() exception is isolated when a secondary healthy adapter is available',async()=>{
 const clock=lab(),engine=clock.engine();
 const broken=createInMemoryAdapter({id:'LAB_BROKEN'});
 broken.describe=async()=>{throw Error('Simulated adapter description fault');};
 const healthy=createInMemoryAdapter({id:'LAB_HEALTHY'});
 engine.registerAdapter(broken);
 engine.registerAdapter(healthy);
 engine.enqueue(message('ISOLATED_1'));
 const res=await engine.dispatch('ISOLATED_1');
 assert.equal(res.status,'ACK_SYNTHETIC');
 assert.equal(res.selectedTransport,'LAB_HEALTHY');
 assert.ok(engine.audit().some(e=>e.event==='ADAPTER_DESCRIPTION_FAILED'&&e.detail==='LAB_BROKEN'));
});
