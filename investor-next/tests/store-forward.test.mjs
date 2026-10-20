import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStoreForwardEngine,createInMemoryAdapter} from '../lib/store-forward.mjs';

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
