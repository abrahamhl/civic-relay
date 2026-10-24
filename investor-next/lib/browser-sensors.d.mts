export type SensorKind='camera'|'microphone'|'geolocation'|'bluetooth'|'serial'|'usb'|'connectivity';
export interface SensorState {kind:SensorKind;state:string;source:string;timestamp:string;confidence:string;
 unit:string|null;sample:Record<string,unknown>|null;reason?:string;resource?:MediaStream}
export interface BrowserSensors {capabilities():Record<SensorKind,string>;stop(kind:SensorKind):SensorState;
 stopAll():void;request(kind:SensorKind,opts:{consent:boolean}):Promise<SensorState>}
export function createBrowserSensors(opts?:{nav?:unknown;secure?:boolean;onChange?:(value:SensorState)=>void}):BrowserSensors;
export function validateRfSample(input:unknown,opts?:{fixture?:boolean}):Record<string,unknown>;
