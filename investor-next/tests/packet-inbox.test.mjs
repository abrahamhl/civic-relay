import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPacketInbox} from '../lib/packet-inbox.mjs';
import {generateRealEcdsaKeyPair,signAndPackRealOepPacket} from '../lib/live-protocol-node.mjs';
const key=await generateRealEcdsaKeyPair();
const packet=()=>signAndPackRealOepPacket({privateKey:key.keyPair.privateKey,publicKeySpkiHex:key.publicKeySpkiHex,
 fingerprint:key.fingerprint,messageId:crypto.randomUUID(),status:'SAFE',timestampMs:100000});
test('inbox validates UUID, TTL, status and bounded fields before cryptography',async()=>{
 const p=await packet();let calls=0;
 const inbox=createPacketInbox({now:()=>100000,verify:async()=>{calls++;return {valid:true};}});
 for(const patch of [{messageId:'REUSED_1'},{timestampMs:0},{timestampMs:110000},{status:'RESCUED'},
  {zoneId:'112|AUTHORITY'},{batteryPct:NaN},{sectorIndex:99},{signatureHex:'A'.repeat(9000)}]) {
   assert.equal((await inbox.receive({...p,...patch})).status,'INVALID_OR_EXPIRED_PACKET');
 }
 assert.equal(calls,0);
 assert.equal((await inbox.receive(p)).status,'SIGNATURE_VALID_UNTRUSTED');
 assert.equal((await inbox.receive(p)).status,'REPLAY_REJECTED');
});
test('clear during verification cannot restore content; expired late verification fails',async()=>{
 const p=await packet();let finish;let now=100000;
 const inbox=createPacketInbox({now:()=>now,verify:()=>new Promise(r=>finish=r)});
 const pending=inbox.receive(p);inbox.clear();finish({valid:true});
 assert.equal((await pending).status,'REVOKED');
 const late=inbox.receive(p);now=160000;finish({valid:true});
 assert.equal((await late).status,'EXPIRED');
});
test('inbox reserves concurrent IDs and bounds metadata and verification work',async()=>{
 const p=await packet();let finish;
 const inbox=createPacketInbox({now:()=>100000,maxEntries:1,maxPending:1,verify:()=>new Promise(r=>finish=r)});
 const first=inbox.receive(p);
 assert.equal((await inbox.receive(p)).status,'REPLAY_REJECTED');
 assert.equal((await inbox.receive(await packet())).status,'INBOX_FULL');
 finish({valid:true});assert.equal((await first).status,'SIGNATURE_VALID_UNTRUSTED');
});
test('inbox verifies real ECDSA and never converts self-signed data into trusted identity',async()=>{
 const inbox=createPacketInbox({now:()=>100000});const p=await packet();
 assert.equal((await inbox.receive(p)).status,'SIGNATURE_VALID_UNTRUSTED');
 assert.equal((await inbox.receive({...await packet(),signatureHex:'00'.repeat(64)})).status,'SIGNATURE_INVALID');
});
