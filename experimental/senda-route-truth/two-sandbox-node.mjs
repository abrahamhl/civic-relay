/** A test-only two-process handset substitute. No Bluetooth/Wi-Fi/Android/IPC production transport. */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createStoreForwardEngine } from '../../investor-next/lib/store-forward.mjs';

const role = process.argv[2];
if (!['A', 'B'].includes(role) || !process.send) throw Error('Test-only IPC worker');
const ledgerFile = join(process.cwd(), 'receiver-ledger.json');
let clock = 100000;
let connected = false;
let receiptMode = 'VALID';
let txSeq = 0;
const pendingTx = new Map();
const engine = role === 'A' ? createStoreForwardEngine({now:()=>clock,retryMs:1000}) : null;
if (engine) {
  engine.registerAdapter({
    id: 'IPC_LAB', kind: 'SIMULATOR_ADAPTER', evidence: 'SIMULATED',
    describe: async () => ({available: connected, permitted:true, compatible:true, secure:true,
      reliability:1, latencyMs:1, energyCost:0.01, monetaryCost:0, capacity:1}),
    send: envelope => new Promise(resolve => {
      const txId = ++txSeq;
      pendingTx.set(txId, resolve);
      process.send({kind:'WIRE_TX',txId,envelope});
    })
  });
}
function ledger() { return existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile,'utf8')) : []; }
async function command(action, data) {
  if (role === 'A') {
    if (action === 'setLink') {connected = data; return {connected};}
    if (action === 'enqueue') return engine.enqueue(data);
    if (action === 'dispatch') return engine.dispatch(data);
    if (action === 'retry') return engine.retryDue();
    if (action === 'inspect') return engine.inspect(data);
    if (action === 'revoke') return engine.revoke(data);
    if (action === 'advance') {clock += data; return {clock};}
    if (action === 'audit') return engine.audit();
  } else {
    if (action === 'setReceiptMode') {receiptMode=data;return {receiptMode};}
    if (action === 'ledger') return ledger();
  }
  throw Error(`Unknown command on ${role}: ${action}`);
}
process.on('message',async m=>{
  if (m.kind === 'WIRE_RESULT' && role === 'A') {
    const settle=pendingTx.get(m.txId);
    if(settle){pendingTx.delete(m.txId);settle(m.result);}
    return;
  }
  if (m.kind === 'WIRE_IN' && role === 'B') {
    const list=ledger();
    list.push({messageId:m.envelope.id, provenance:m.envelope.provenance, receiver:'SANDBOX_B'});
    writeFileSync(ledgerFile,JSON.stringify(list,null,2));
    const accepted={accepted:true};
    if(receiptMode==='VALID')accepted.receipt={kind:'SIMULATED_RECEIVER_RECEIPT',messageId:m.envelope.id,transportId:'IPC_LAB'};
    if(receiptMode==='FORGED')accepted.receipt={kind:'SIMULATED_RECEIVER_RECEIPT',messageId:'FORGED_ID',transportId:'IPC_LAB'};
    process.send({kind:'WIRE_RETURN',txId:m.txId,result:accepted});
    return;
  }
  if (m.kind === 'CMD') {
    try {const result=await command(m.action,m.data);process.send({kind:'REPLY',reqId:m.reqId,result});}
    catch(e){process.send({kind:'REPLY',reqId:m.reqId,error:String(e.message||e)});}
  }
});
process.send({kind:'READY',role,pid:process.pid,cwd:process.cwd()});
