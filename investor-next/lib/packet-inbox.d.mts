import type {SignedOepRealPacket,VerifiedOepPacketResult} from './live-protocol-node.mjs';
export interface PacketInbox {clear():void;receive(input:unknown):Promise<{packet:SignedOepRealPacket|null;status:string;verification?:VerifiedOepPacketResult}>}
export function createPacketInbox(opts?:{now?:()=>number;verify?:(packet:SignedOepRealPacket)=>Promise<VerifiedOepPacketResult>;maxEntries?:number;maxPending?:number}):PacketInbox;
