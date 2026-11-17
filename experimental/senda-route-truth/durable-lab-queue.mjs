/**
 * SENDA experimental crash-recovery laboratory, NOT an Android, RF or emergency service.
 * Persists ONLY synthetic test envelopes. Does not implement BPv7, E2EE, authenticated ACKs,
 * multi-writer isolation, durable device keys or power-loss-certified storage.
 * Node.js-only adapter; a future Android implementation needs independently verified storage.
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createStoreForwardEngine } from '../../investor-next/lib/store-forward.mjs';

const TERMINAL = new Set(['ACK_SYNTHETIC','EXPIRED','REVOKED','EXHAUSTED','CLOCK_UNCERTAIN']);
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const MAX_BYTES = 1024 * 1024;

function writeAtomic(dir, filename, document) {
  const payload = JSON.stringify(document);
  const raw = JSON.stringify({ schema:1, sha256:sha(payload), document });
  if (Buffer.byteLength(raw) > MAX_BYTES) throw Error('Lab journal exceeds 1 MiB; fail closed');
  const tmp = join(dir, `.${filename}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  let fd;
  try {
    fd = openSync(tmp,'wx',0o600);
    writeFileSync(fd,raw,{encoding:'utf8'});
    fsyncSync(fd);
    closeSync(fd);fd=undefined;
    renameSync(tmp,join(dir,filename));
    if (process.platform !== 'win32') {
      const dfd = openSync(dir,'r');
      try { fsyncSync(dfd); } finally { closeSync(dfd); }
    }
  } catch (err) {
    if(fd !== undefined)closeSync(fd);
    try { unlinkSync(tmp); }catch{}
    throw err;
  }
}
function readJournal(file) {
  const raw = readFileSync(file,'utf8');
  if(Buffer.byteLength(raw)>MAX_BYTES)throw Error('Oversize lab journal; quarantine required');
  const parsed=JSON.parse(raw);
  if(parsed?.schema!==1||typeof parsed.sha256!=='string'||!parsed.document||
    sha(JSON.stringify(parsed.document))!==parsed.sha256)
    throw Error('Corrupt/tampered lab journal; quarantine required');
  const s=parsed.document;
  if(s.version!==1||!Number.isSafeInteger(s.lastSeenAt)||s.lastSeenAt<0||
    !Array.isArray(s.items)||s.items.length>1000)throw Error('Invalid journal schema; quarantine required');
  for(const item of s.items){
    if(!item||typeof item.id!=='string'||typeof item.status!=='string'||
      !(TERMINAL.has(item.status)||item.status==='PENDING'))throw Error('Invalid journal state');
    if(item.status==='PENDING' && (item.envelope?.id!==item.id||
      item.envelope?.provenance!=='SYNTHETIC_EXERCISE_ONLY'||
      item.envelope?.consented!==true||!Number.isSafeInteger(item.envelope?.createdAt)||
      !Number.isSafeInteger(item.envelope?.ttlSeconds)))throw Error('Unsafe journal pending record');
    if(item.status!=='PENDING' && item.envelope!==null)throw Error('Terminal payload retained; quarantine required');
  }
  if(new Set(s.items.map(i=>i.id)).size!==s.items.length)throw Error('Duplicate journal IDs');
  return s;
}

/**
 * The ONLY durability claim is synthetic queue recovery in a single-writer Node filesystem lab.
 * An observed application-level simulated receipt remains SYNTHETIC, never physical delivery.
 */
export function createDurableLabQueue({directory,now=()=>Date.now(),retryMs=1000,maxAttempts=4,maxEntries=100}={}) {
  if(typeof directory!=='string'||!directory||typeof now!=='function'||
    !Number.isSafeInteger(maxAttempts)||maxAttempts<1||
    !Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>1000)
    throw Error('Invalid lab journal configuration');
  mkdirSync(directory,{recursive:true,mode:0o700});
  const filename='senda-synthetic-queue.json';
  const file=join(directory,filename);
  const original=existsSync(file)?readJournal(file):{version:1,lastSeenAt:now(),items:[]};
  const state=clone(original);
  const engine=createStoreForwardEngine({now,retryMs,maxAttempts,maxEntries});
  const items=new Map(state.items.map(item=>[item.id,item]));
  const instant=()=>{const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Invalid test clock');return t;};
  const persist=()=>{
    state.lastSeenAt=Math.max(state.lastSeenAt,instant());
    state.items=[...items.values()];
    writeAtomic(directory,filename,state);
  };
  const finish=(item,status)=>{item.status=status;item.envelope=null;};
  // A clock rollback across process restart is uncertainty, not licence to extend TTL.
  const clockRollback=instant()<state.lastSeenAt;
  for(const item of items.values()) {
    if(item.status!=='PENDING')continue;
    if(clockRollback){finish(item,'CLOCK_UNCERTAIN');continue;}
    if(instant()>=item.envelope.createdAt+item.envelope.ttlSeconds*1000){finish(item,'EXPIRED');continue;}
    // Existing engine validates on re-enqueue: fail rather than treating corrupt data as received.
    engine.enqueue(item.envelope);
  }
  persist();
  const view=(item)=>{
    if(!item)return null;
    if(item.status==='PENDING')return engine.inspect(item.id);
    return {id:item.id,status:item.status,evidence:'SIMULATED_ONLY',hasPayload:false,receiptKind:item.receiptKind??null};
  };
  const sweep=()=>{
    if(instant()<state.lastSeenAt){
      for(const i of items.values())if(i.status==='PENDING'){engine.revoke(i.id);finish(i,'CLOCK_UNCERTAIN');}
      persist();return;
    }
    for(const i of items.values())if(i.status==='PENDING' && instant()>=i.envelope.createdAt+i.envelope.ttlSeconds*1000){
      engine.inspect(i.id);finish(i,'EXPIRED');
    }
    persist();
  };
  return {
    registerAdapter(adapter) {
      // Increment and flush BEFORE actual adapter.send(), not while completely offline.
      // A crash after this write may consume an attempt without sending: conservative by design.
      engine.registerAdapter({...adapter,send:async envelope=>{
        const item=items.get(envelope.id);
        if(!item||item.status!=='PENDING'||item.attempts>=maxAttempts)return {accepted:false};
        item.attempts++;
        persist();
        return adapter.send(envelope);
      }});
    },
    enqueue(input) {
      sweep();
      if(items.has(input?.id))throw Error('Durable lab tombstone or ID already present');
      if(items.size>=maxEntries)throw Error('Durable lab queue full');
      const envelope={...input,createdAt:input?.createdAt??instant()};
      const info=engine.enqueue(envelope);
      const item={id:info.id,status:'PENDING',envelope:{...envelope,provenance:'SYNTHETIC_EXERCISE_ONLY'},attempts:0};
      items.set(item.id,item);
      try{persist();}catch(err){items.delete(item.id);engine.purge(item.id);throw err;}
      return info;
    },
    async dispatch(id) {
      sweep(); const item=items.get(id);
      if(!item)throw Error('Unknown durable message ID');
      if(item.status!=='PENDING')return view(item);
      if(item.attempts>=maxAttempts){engine.revoke(id);finish(item,'EXHAUSTED');persist();return view(item);}
      const result=await engine.dispatch(id);
      if(TERMINAL.has(result.status)){item.receiptKind=result.receiptKind??null;finish(item,result.status);}
      persist();
      return view(item);
    },
    async retryDue() {
      sweep(); const outcomes=[];
      for(const item of items.values()) {
        if(item.status==='PENDING')outcomes.push(await this.dispatch(item.id));
      }
      return outcomes;
    },
    revoke(id) {
      const item=items.get(id);if(!item)return false;
      if(item.status==='PENDING')engine.revoke(id);
      finish(item,'REVOKED');persist();return true;
    },
    inspect(id){sweep();return view(items.get(id));},
    snapshot(){sweep();return [...items.values()].map(view);},
    getJournalPath:()=>file
  };
}
