export interface ScenarioParameters {
 devices?:number; participation?:number; permissions?:number; battery?:number; damaged?:number;
 responses?:number; helpRequests?:number; seed?:number; bluetooth?:boolean; wifi?:boolean; gateway?:boolean;
}
export type HumanStatus='SAFE'|'SOS_EXPLICIT'|'UNKNOWN';
export interface VirtualDevice {
 id:string;x:number;y:number;floor:number;participating:boolean;permission:boolean;online:boolean;
 energy:'NORMAL'|'ALERT'|'CONSERVATION'|'CRITICAL';bluetooth:string;wifi:string;satellite:'UNSUPPORTED';humanStatus:HumanStatus;
}
export interface VirtualRoute {
 id:string;source:string;priority:'CRITICAL'|'LOW';humanStatus:HumanStatus;
 delivery:'ACK_SYNTHETIC'|'QUEUED_LOCAL';path:string[];hops:number;
 transport:'SIMULATED_CELLULAR'|'SIMULATED_LOCAL_GATEWAY'|'NONE';evidence:'SIMULATED_ONLY';ttlSeconds:number;
}
export interface SimulationResult {
 kind:'RESEARCH_SIMULATION_NOT_OPERATIONAL';version:string;seed:number;
 zone:{id:string;type:string;provenance:string;institutionalAuthentication:false;intensity:string;certainty:string;polygon:number[][];permissionPolicy:string;activation:string;expiresAfterSeconds:number;cancellation:string};
 assumptions:{geometry:string;radioRange:number;bluetooth:boolean;wifi:boolean;gateway:boolean;realRadio:false;realSatellite:false;authorityVerification:false;encryption:false;live112:false;energyMeasured:false;latencyMeasured:false;ack:string};
 summary:{totalDevices:number;participating:number;permissioned:number;humanSafe:number;humanSOS:number;humanUnknown:number;noContact:number;modelledMessages:number;syntheticAcks:number;queued:number;cellularOnlyAcks:number;simulatedLocalGatewayAcks:number;energyProfile:string};
 devices:VirtualDevice[];routes:VirtualRoute[];audit:{event:string;detail:string}[];
}
export declare function runScenario(params?:ScenarioParameters):SimulationResult;