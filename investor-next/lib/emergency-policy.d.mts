export type CapabilityState='AVAILABLE'|'DISABLED'|'PERMISSION_REQUIRED'|'UNSUPPORTED'|'RESTRICTED';
export type SafetyResponse='SAFE'|'SOS_EXPLICIT'|'OTHERS_AFFECTED'|'CANNOT_DETERMINE';
export interface SafetyRecord {response:SafetyResponse|'UNKNOWN';recordedAt:string;expiresAt:string;location:unknown|null;locationShared:boolean;revoked:boolean}
export declare const CAPABILITY_STATES: readonly CapabilityState[];
export declare const SAFETY_RESPONSES: readonly SafetyResponse[];
export declare function capabilityState(p?:{supported?:boolean;restricted?:boolean;enabled?:boolean;permission?:boolean}):CapabilityState;
export declare function recordSafetyResponse(p:{response:SafetyResponse;now?:number;retentionSeconds?:number;shareLocation?:boolean;location?:unknown;consented?:boolean}):SafetyRecord;
export declare function revokeSafetyRecord(r:SafetyRecord):SafetyRecord;
export declare function expireSafetyRecord(r:SafetyRecord,now?:number):SafetyRecord;
export declare function energyPolicy(battery:number,alertActive:boolean):{profile:'NORMAL'|'ALERT'|'CONSERVATION'|'CRITICAL';discoverySeconds:number;retrySeconds:number;relay:boolean;systemBatterySaverChanged:false;measurements:'NOT_MEASURED'};
export declare function acceptAuthorizedCapAlert(alert:unknown,verifyIssuer:(alert:unknown)=>Promise<{authenticated:boolean;trustAnchorId:string}|false>,options?:{now?:number}):Promise<unknown>;
