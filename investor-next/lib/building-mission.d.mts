import type {SimulationResult} from './emergency-routing.mjs';
import type {LabStatusRecord} from './store-forward.mjs';
export interface BuildingMissionState {state:string;reason:string;messageId:string|null;sourceId:string;
 path:string[];cursor:number;busy:boolean;receipt:string|null;evidence:'SIMULATED_ONLY';record:LabStatusRecord|null;
 events:Array<{step:number;event:string}>}
export interface BuildingMission {snapshot():BuildingMissionState;refresh():BuildingMissionState;start():Promise<BuildingMissionState>;
 advance():BuildingMissionState;updateModel(model:SimulationResult):void;stop():BuildingMissionState;dispose():void}
export function createBuildingMission(options:{model:SimulationResult;sourceId:string;onChange?:(state:BuildingMissionState)=>void;now?:()=>number}):BuildingMission;
