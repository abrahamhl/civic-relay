/**
 * SENDA research-only robust GOES front estimator (v0.21).
 * Fits a Theil–Sen trend to per-acquisition fire pixel-centre quantiles.
 * This is NOT a physical fire perimeter or a certified spread-rate predictor.
 * NEVER interpret hotspot centroids as an exact flame front.
 */
import { classifyGoesPixel } from './observation-quality.mjs';
const R=6371.0088, rad=(x)=>x*Math.PI/180;
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
function quantile(a,p) {
  const s=[...a].sort((x,y)=>x-y);
  if(!s.length)return null;
  const i=(s.length-1)*p, lo=Math.floor(i),hi=Math.ceil(i);
  return lo===hi ? s[lo] : s[lo]*(hi-i)+s[hi]*(i-lo);
}
function median(a){return quantile(a,0.5)}
function slopeTheilSen(rows){
  const slopes=[];
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const dt=(rows[j].timestamp-rows[i].timestamp)/3600000;
    if(dt>0)slopes.push((rows[j].km-rows[i].km)/dt);
  }
  if(!slopes.length)return null;
  return {kmh:median(slopes),slopes,medianAbsoluteDeviation:median(slopes.map(s=>Math.abs(s-median(slopes))))};
}
/**
 * @param {Array<{t:string,det:Array<[number,number,number,number]>}>} frames
 * @param {{origin:[number,number],spreadToDeg:number,pixelResolutionKm:number,
 *    minPixelsPerFrame?:number,minFrames?:number,frontQuantile?:number}} opts
 */
export function estimateRobustFront(frames,opts={}){
  const {origin,spreadToDeg,pixelResolutionKm,minPixelsPerFrame=3,minFrames=4,frontQuantile=0.8}=opts;
  if(!Array.isArray(frames)||!Array.isArray(origin)||origin.length!==2 ||
    !origin.every(finite)||!finite(spreadToDeg)||!finite(pixelResolutionKm)||pixelResolutionKm<=0||
    !Number.isInteger(minPixelsPerFrame)||minPixelsPerFrame<3||
    !Number.isInteger(minFrames)||minFrames<3||!(frontQuantile>=0.5&&frontQuantile<=0.95))
    return {status:'INVALID_PARAMETERS',speedKmh:null,validFrames:0};
  let last=-Infinity;
  const d=rad(spreadToDeg), east=Math.sin(d),north=Math.cos(d);
  const rows=[],rejected={mask:0,position:0,lowPixels:0,timestamp:0};
  for(const f of frames){
    const isUTC=typeof f?.t==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(f.t);
    const t=isUTC?Date.parse(f.t):NaN;
    if(!Number.isFinite(t)||t<=last){rejected.timestamp++;continue;}
    last=t;
    const pts=[];
    for(const p of f.det??[]){
      if(classifyGoesPixel(p)!=='STRICT'){rejected.mask++;continue;}
      const [lat,lon]=p;
      const x=rad(lon-origin[1])*Math.cos(rad(origin[0]))*R;
      const y=rad(lat-origin[0])*R;
      const proj=x*east+y*north;
      if(!Number.isFinite(proj)){rejected.position++;continue;}
      pts.push(proj);
    }
    if(pts.length<minPixelsPerFrame){rejected.lowPixels++;continue;}
    rows.push({timestamp:t,km:quantile(pts,frontQuantile),pixelCount:pts.length});
  }
  if(rows.length<minFrames)return {status:'INSUFFICIENT_INDEPENDENT_FRAMES',speedKmh:null,validFrames:rows.length,rejected};
  const fit=slopeTheilSen(rows),durationH=(rows.at(-1).timestamp-rows[0].timestamp)/3600000;
  const displacement=rows.at(-1).km-rows[0].km;
  const resolutionFloorKmh=pixelResolutionKm/Math.max(durationH,0.001);
  const scaleResolved=Math.abs(displacement)>=1.5*pixelResolutionKm;
  const status=scaleResolved?'RESEARCH_TREND_ONLY':'UNRESOLVED_AT_SENSOR_SCALE';
  return {status,speedKmh:scaleResolved?+fit.kmh.toFixed(3):null,
    uncertaintyFloorKmh:+resolutionFloorKmh.toFixed(3),
    medianSlopeDeviationKmh:+fit.medianAbsoluteDeviation.toFixed(3),
    displacementKm:+displacement.toFixed(3),durationH:+durationH.toFixed(3),
    validFrames:rows.length,rejected,
    frontQuantile,pixelResolutionKm,
    timeseries:rows.map(r=>({utc:new Date(r.timestamp).toISOString(),projectedKm:+r.km.toFixed(3),strictPixels:r.pixelCount})),
    limitations:'Pixel-centre quantile trend. Detection and obscuration biases; no spotting, terrain or subpixel front. Independent perimeter validation required.',
    forOperationalAlert:false};
}
