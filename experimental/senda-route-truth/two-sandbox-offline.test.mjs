/**
 * Two independently spawned Node processes represent isolated handset app state.
 * No Internet network is used. Parent-controlled IPC is a LAB-ONLY synthetic radio.
 * This does NOT test Android Nearby, RF, hardware isolation or physical delivery.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessModelRoute } from './route-truth.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const worker=join(here,'two-sandbox-node.mjs');
function node(id,dir,handle){
  let seq=0;const waiting=new Map();
  const child=fork(worker,[id],{cwd:dir,execArgv:[],stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,SENDA_TEST_HANDSET:id}});
  const ready=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error(`Sandbox ${id} never started`)),5000);
    child.on('message',m=>{if(m.kind==='READY'){clearTimeout(timeout);resolve(m);}});
  });
  child.on('message',m=>{
    if(m.kind==='REPLY'){
      const item=waiting.get(m.reqId);if(!item)return;
      waiting.delete(m.reqId);
      if(m.error)item.reject(Error(m.error));else item.resolve(m.result);
    }else if(m.kind==='WIRE_TX'||m.kind==='WIRE_RETURN')handle(id,m);
  });
  child.on('exit',(code,signal)=>{for(const item of waiting.values())item.reject(Error(`Sandbox exit: ${code}/${signal}`));waiting.clear();});
  return {child,ready,command:(action,data)=>new Promise((resolve,reject)=>{
    const reqId=++seq;waiting.set(reqId,{resolve,reject});child.send({kind:'CMD',reqId,action,data});
    setTimeout(()=>{if(waiting.has(reqId)){waiting.delete(reqId);reject(Error(`Timeout ${id} ${action}`));}},4000).unref();
  })};
}
const envelope=(id,extra={})=>({id,category:'SOS_EXPLICIT',consented:true,destination:'LAB_CENTRE',ttlSeconds:60,payload:{fictional:true},...extra});

test('SENDA: two separate offline handset processes; honest synthetic receipt gate',async t=>{
  const base=mkdtempSync(join(tmpdir(),'senda-two-handsets-'));
  const A=join(base,'phone_A');const B=join(base,'phone_B');
  mkdirSync(A);mkdirSync(B);
  let a,b;const evidence=[];
  const routeNodes=[
    {id:'A',role:'SENDER',consent:true,powered:true,radioEnabled:true},
    {id:'B',role:'RECEIVER',consent:true,powered:true,radioEnabled:true}
  ];
  const routeLink={from:'A',to:'B',kind:'ACTIVE_RADIO',authorized:true,enabled:true,dutyCycleAllowed:true};
  const handle=(from,m)=>{
    if(from==='A'&&m.kind==='WIRE_TX')b.child.send({kind:'WIRE_IN',txId:m.txId,envelope:m.envelope});
    if(from==='B'&&m.kind==='WIRE_RETURN')a.child.send({kind:'WIRE_RESULT',txId:m.txId,result:m.result});
  };
  try {
    a=node('A',A,handle);b=node('B',B,handle);
    const [ar,br]=await Promise.all([a.ready,b.ready]);
    assert.notEqual(ar.pid,br.pid);
    assert.notEqual(ar.cwd,br.cwd);
    evidence.push({case:'two_processes',status:'PASS',senderPid:ar.pid,receiverPid:br.pid,distinctWorkingDirs:true,transport:'PARENT_CONTROLLED_IPC_ONLY'});
    await t.test('route truth stays model-only even when direct route exists',()=>{
      const r=assessModelRoute({nodes:routeNodes,links:[routeLink],source:'A',destination:'B'});
      assert.equal(r.modelReachable,true);
      assert.equal(r.physicalDeliveryVerified,false);
      assert.equal(r.recipientAcknowledged,false);
      evidence.push({case:'route_truth',status:'PASS',routeEvidence:r.evidenceLevel,physicalDelivery:false});
    });
    await t.test('both offline: no transport; sender queues; receiver sees nothing',async()=>{
      await a.command('setLink',false);
      await a.command('enqueue',envelope('LAB_OFFLINE_01'));
      const state=await a.command('dispatch','LAB_OFFLINE_01');
      assert.equal(state.status,'QUEUED');
      assert.equal((await b.command('ledger')).length,0);
      evidence.push({case:'both_offline',status:'PASS',senderState:state.status,received:0});
    });
    await t.test('local simulated link recovers: explicit synthetic receipt, no physical claim',async()=>{
      await a.command('setLink',true);
      await a.command('advance',1001);
      const outcomes=await a.command('retry');
      assert.equal(outcomes[0].status,'ACK_SYNTHETIC');
      assert.equal(outcomes[0].evidence,'SIMULATED_ONLY');
      assert.equal(outcomes[0].receiptKind,'SIMULATED_RECEIVER_RECEIPT');
      assert.equal(outcomes[0].hasPayload,false);
      assert.equal((await b.command('ledger')).length,1);
      evidence.push({case:'reconnect_and_ack',status:'PASS',senderState:outcomes[0].status,received:1,physicalDeliveryVerified:false});
    });
    await t.test('forged ACK is not accepted as receiver receipt',async()=>{
      await b.command('setReceiptMode','FORGED');
      await a.command('enqueue',envelope('LAB_FORGED_02'));
      const state=await a.command('dispatch','LAB_FORGED_02');
      assert.equal(state.status,'FORWARDED_UNCONFIRMED');
      assert.equal(state.receiptKind,null);
      evidence.push({case:'forged_ack',status:'PASS',senderState:state.status});
    });
    await t.test('accepted transport without receipt remains unconfirmed',async()=>{
      await b.command('setReceiptMode','NONE');
      await a.command('enqueue',envelope('LAB_NO_ACK_03'));
      const state=await a.command('dispatch','LAB_NO_ACK_03');
      assert.equal(state.status,'FORWARDED_UNCONFIRMED');
      assert.equal(state.receiptKind,null);
      evidence.push({case:'no_ack',status:'PASS',senderState:state.status});
    });
    await t.test('consent, revocation and expiry all fail closed',async()=>{
      await assert.rejects(a.command('enqueue',envelope('LAB_NO_CONSENT',{consented:false})),/consent/i);
      await a.command('setLink',false);
      await a.command('enqueue',envelope('LAB_REVOKED_04'));
      assert.equal(await a.command('revoke','LAB_REVOKED_04'),true);
      assert.equal((await a.command('dispatch','LAB_REVOKED_04')).status,'REVOKED');
      await a.command('enqueue',envelope('LAB_EXPIRED_05',{ttlSeconds:1}));
      await a.command('advance',1001);
      assert.equal((await a.command('dispatch','LAB_EXPIRED_05')).status,'EXPIRED');
      evidence.push({case:'consent_revocation_expiry',status:'PASS',neverDelivered:true});
    });
    await t.test('restart restores durable synthetic queue before simulated transport recovers',async()=>{
      await a.command('enqueue',envelope('LAB_RESTART_06'));
      assert.equal((await a.command('inspect','LAB_RESTART_06')).status,'QUEUED');
      a.child.kill('SIGKILL');
      await new Promise(resolve=>a.child.once('exit',resolve));
      a=node('A',A,handle);
      await a.ready;
      const after=await a.command('inspect','LAB_RESTART_06');
      assert.equal(after.status,'QUEUED','Lab queue must survive SIGKILL and process restart');
      await b.command('setReceiptMode','VALID');
      await a.command('setLink',true);
      const replay=await a.command('dispatch','LAB_RESTART_06');
      assert.equal(replay.status,'ACK_SYNTHETIC');
      assert.equal(replay.hasPayload,false);
      assert.equal((await b.command('ledger')).filter(x=>x.messageId==='LAB_RESTART_06').length,1);
      evidence.push({case:'restart_queue_recovery',status:'PASS',before:'QUEUED',after:'QUEUED',simulatedFinalAck:'ACK_SYNTHETIC',hardwareValidated:false});
    });
    const savePath=process.env.SENDA_EVIDENCE_FILE;
    if(savePath)writeFileSync(savePath,JSON.stringify({source:'real SENDA code; synthetic IPC transport',runAt:new Date().toISOString(),repoSHA:'b0337fbb541bd4ed98d0b78b1e65ee95d6f6a4e8',processModel:'two OS processes; distinct working dirs; no Android/RF; network namespace isolation not claimed',evidence},null,2));
  } finally {
    const waitExit = (h) => h?.child && h.child.exitCode === null ? new Promise((res) => { h.child.once('exit', res); h.child.kill(); setTimeout(res, 200); }) : Promise.resolve();
    await Promise.all([waitExit(a), waitExit(b)]);
    rmSync(base,{recursive:true,force:true,maxRetries:5,retryDelay:50});
  }
});
