export type LabCategory='SAFE'|'SOS_EXPLICIT'|'OTHERS_AFFECTED'|'CANNOT_DETERMINE';
export type LabStatus='QUEUED'|'FORWARDED_UNCONFIRMED'|'ACK_SYNTHETIC'|'EXPIRED'|'REVOKED'|'EXHAUSTED';
export interface LabMessage {id:string;category:LabCategory;consented:true;destination?:string;
 createdAt?:number;ttlSeconds?:number;payload?:unknown}
export interface LabStatusRecord {id:string;category:LabCategory;status:LabStatus;attempts:number;
 nextAttemptAt:number|null;selectedTransport:string|null;evidence:'SIMULATED_ONLY';
 receiptKind:string|null;hasPayload:boolean}
export interface LabAdapter {id:string;kind:'SIMULATOR_ADAPTER';evidence:'SIMULATED';
 setAvailable(enabled:boolean):void;
 describe():Promise<{available:boolean;permitted:boolean;compatible:boolean;secure:boolean;
 reliability:number;latencyMs:number;energyCost:number;monetaryCost:number;capacity:number}>;
 send(envelope:LabMessage):Promise<{accepted:boolean;receipt?:{kind:string;messageId:string;transportId:string}}>;
 getReceived():Array<{id:string;provenance:'SYNTHETIC_EXERCISE_ONLY'}>}
export interface LabEngine {
 registerAdapter(adapter:LabAdapter):void;enqueue(message:LabMessage):LabStatusRecord;
 dispatch(id:string):Promise<LabStatusRecord>;retryDue():Promise<LabStatusRecord[]>;
 inspect(id:string):LabStatusRecord|null;snapshot():LabStatusRecord[];
 revoke(id:string):boolean;purge(id:string):boolean;
 audit():Array<{at:number;id:string;event:string;detail:string}>;
}
export declare function createStoreForwardEngine(opts?:{now?:()=>number;retryMs?:number;
 maxAttempts?:number;maxEntries?:number;energyProfile?:'NORMAL'|'ALERT'|'CONSERVATION'|'CRITICAL'}):LabEngine;
export declare function createInMemoryAdapter(opts?:{id?:string;available?:boolean;receipts?:boolean;
 failures?:number;reliability?:number;latencyMs?:number;energyCost?:number;monetaryCost?:number}):LabAdapter;
