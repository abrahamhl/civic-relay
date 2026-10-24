import {verifyRealOepPacket} from './live-protocol-node.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createPacketInbox({now=Date.now,verify=verifyRealOepPacket,maxEntries=256,maxPending=4}={}) {
  const seen=new Map();let epoch=0,pending=0;
  return {
    clear(){epoch++;seen.clear();},
    async receive(input) {
      const startedEpoch=epoch,at=now();
      for(const [key,expiry] of seen)if(expiry<=at)seen.delete(key);
      let packet;
      try {
        if(!input||typeof input!=='object'||JSON.stringify(input).length>8192)throw Error();
        packet=structuredClone(input);
        if(packet.protocol!=='OEP_REAL_EXECUTION_V1'||!uuid.test(packet.messageId)||
          !['SAFE','SOS_EXPLICIT'].includes(packet.status)||
          typeof packet.zoneId!=='string'||!/^[A-Z0-9_-]{1,40}$/.test(packet.zoneId)||
          !Number.isInteger(packet.sectorIndex)||packet.sectorIndex<0||packet.sectorIndex>8||
          !(packet.batteryPct===null||(Number.isFinite(packet.batteryPct)&&packet.batteryPct>=0&&packet.batteryPct<=100))||
          !Number.isSafeInteger(packet.timestampMs)||packet.timestampMs<0||packet.timestampMs>at+5000||at>=packet.timestampMs+60000||
          !/^[0-9a-f]{128}$/i.test(packet.signatureHex)||!/^[0-9a-f]{182}$/i.test(packet.publicKeySpkiHex)||
          typeof packet.canonicalString!=='string'||packet.canonicalString.length>512)throw Error();
      }catch{return {packet:null,status:'INVALID_OR_EXPIRED_PACKET'};}
      const key=`${packet.signerFingerprint}:${packet.messageId}`;
      if(seen.has(key))return {packet:null,status:'REPLAY_REJECTED'};
      if(seen.size>=maxEntries||pending>=maxPending)return {packet:null,status:'INBOX_FULL'};
      // Reserve before awaiting signature verification to prevent concurrent duplicate admission.
      seen.set(key,packet.timestampMs+60000);pending++;
      try {
        const result=await verify(packet);
        if(epoch!==startedEpoch)return {packet:null,status:'REVOKED'};
        if(now()>=packet.timestampMs+60000)return {packet:null,status:'EXPIRED'};
        if(result.valid!==true)return {packet:null,status:'SIGNATURE_INVALID'};
        return {packet,status:'SIGNATURE_VALID_UNTRUSTED',verification:result};
      }catch{return {packet:null,status:epoch===startedEpoch?'SIGNATURE_INVALID':'REVOKED'};}
      finally{pending--;}
    }
  };
}
