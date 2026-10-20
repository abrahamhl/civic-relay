import type { MessageType, Priority } from '@civic-relay/schemas';
import { Check, Siren, HeartPulse, Flame, TriangleAlert, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const actions:{type:MessageType;priority:Priority;name:string;code:string;icon:LucideIcon}[]=[
 {type:'SAFE',priority:'LOW',name:'I AM SAFE',code:'SAFE',icon:Check},
 {type:'SOS',priority:'CRITICAL',name:'REQUEST HELP',code:'SOS',icon:Siren},
 {type:'MEDICAL',priority:'HIGH',name:'MEDICAL',code:'MED',icon:HeartPulse},
 {type:'FIRE',priority:'CRITICAL',name:'FIRE REPORT',code:'FIRE',icon:Flame},
 {type:'INFRASTRUCTURE',priority:'MEDIUM',name:'INFRASTRUCTURE',code:'INFRA',icon:TriangleAlert},
 {type:'GENERAL_REPORT',priority:'LOW',name:'GENERAL REPORT',code:'GEN',icon:FileText}
];

export default function EmergencyButtons({onAction}:{onAction:(type:MessageType,priority:Priority)=>void}){
 return <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Create a fictional local demo event">
  {actions.map(({type,priority,name,code,icon:Icon})=><button type="button" key={type} onClick={()=>onAction(type,priority)} className="group text-left border border-slate-700 bg-[#111e27] hover:border-[#ff7857] hover:bg-[#182934] transition-all p-4 min-h-[105px] flex flex-col justify-between">
   <div className="flex justify-between items-center"><Icon className="text-slate-300 group-hover:text-[#ff987c]" strokeWidth={1.5} size={20}/><span className="font-mono text-[9px] tracking-wide text-slate-500">{code} / DEMO</span></div>
   <strong className="text-[11px] sm:text-xs tracking-[.07em] text-slate-100">{name}</strong>
  </button>)}
 </div>;
}
