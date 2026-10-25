export type Localized = Record<'es'|'en'|'nl',string>;
export const VISION: {id:string;version:number;baselineSha:string;document:string};
export const SURFACES: Array<{id:string;title:Localized;boundary:Localized}>;
export const SCENARIOS: Array<{id:string;title:Localized}>;
export const GATES: Array<{id:string;title:Localized;status:string}>;
export const MODULES: Array<{id:string;title:Localized;state:string[];gate:string;scenarios:string[];surfaces:string[];core:string;acceptance:Localized;existing:string[];operational:false;contract:string;test:string;evidence:string}>;
