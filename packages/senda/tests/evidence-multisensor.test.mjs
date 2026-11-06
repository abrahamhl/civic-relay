import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evidenceCoincidence,landmarkVisibility,stoppingSightResearch}
  from '../src/evidence-multisensor.mjs';

const from=dirname(fileURLToPath(import.meta.url));
const records=resolve(from,'../../../investor-next/public/senda/data/referencias');
const go=JSON.parse(readFileSync(resolve(records,'goes_casos.json'),'utf8')).casos.camp.frames;
const fire=go.find(r=>r.det.length>0);
const cams=JSON.parse(readFileSync(resolve(records,'caltrans_corredores.json'),'utf8'));
const c=cams.camaras.find(x=>x.zona==='camp'&&x.video);

test('real 2018 fire and 2026 camera cannot be falsely paired as synchronous',()=>{
  assert.ok(fire&&c, 'authentic recorded case and camera found');
  const a={sourceId:'NOAA-GOES-FDCC',originType:'MEASURED',sourceQuality:'VALIDATED',
    rightsApproved:true,contentSha256:'sha-source-goes',modality:'SATELLITE_FHS',
    observedUTC:fire.t,timestampUncertaintyS:30,latLon:fire.det[0].slice(0,2)};
  const b={sourceId:'Caltrans-CCTV',originType:'MEASURED',sourceQuality:'VALIDATED',
    rightsApproved:true,contentSha256:'sha-source-cam',modality:'RGB',
    observedUTC:'2026-11-06T01:15:00Z',timestampUncertaintyS:30,latLon:[c.lat,c.lon]};
  const g=evidenceCoincidence(a,b,{maxDistanceKm:999,maxLagS:360});
  assert.equal(g.status,'UNUSABLE_FOR_FUSION');
  assert.ok(g.reasons.includes('DIFFERENT_OBSERVATION_EPOCHS'));
  assert.equal(g.canPublishOperationalPrediction,false);
});
test('2026 camera YOLOX box estimates cannot be promoted to calibrated physical data',()=>{
  const g=evidenceCoincidence({
    sourceId:'caltrans_cctv',contentSha256:'x',originType:'MEASURED',
    sourceQuality:'REAL_VIDEO_MODEL_DERIVED_UNVERIFIED',rightsApproved:false,
    observedUTC:'2026-11-06T01:15:00Z',timestampUncertaintyS:1800,
    latLon:[c.lat,c.lon],modality:'RGB'},
    {sourceId:'digitraffic_tms',contentSha256:'y',originType:'MEASURED',
    sourceQuality:'VALIDATED',rightsApproved:true,
    observedUTC:'2026-11-06T01:15:00Z',timestampUncertaintyS:30,
    latLon:null,modality:'TRAFFIC_DETECTOR'});
  assert.equal(g.status,'UNUSABLE_FOR_FUSION');
  for(const reason of ['SOURCE_MEASUREMENT_NOT_VALIDATED','DATA_REUSE_NOT_APPROVED',
    'TEMPORAL_UNCERTAINTY_TOO_LARGE','NO_GEOLOCATION']) assert.ok(g.reasons.includes(reason));
});
test('optical calibration is required; no pseudo-thermal values from uncalibrated RGB',()=>{
  assert.equal(landmarkVisibility({contrastNow:0.2,contrastClear:0.8,distanceM:200}).visibilityM,null);
  const v=landmarkVisibility({contrastNow:0.4,contrastClear:0.8,distanceM:200,
    relativeContrastUncertainty:0.1,calibrationId:'RESEARCH_TEST_ONLY',sceneStable:true,measuredFromRealFrames:true});
  assert.ok(v.visibilityM>1000);
  assert.ok(v.intervalM[0]<v.visibilityM&&v.intervalM[1]>v.visibilityM);
  assert.equal(v.canIssueOfficialAlert,false);
  assert.equal(stoppingSightResearch({visibility:v,detectorSpeedKmh:60,sourceTimeAligned:false,roadCalibrationApproved:true}).marginM,null);
  assert.equal(stoppingSightResearch({visibility:v,detectorSpeedKmh:60,sourceTimeAligned:true,roadCalibrationApproved:false}).marginM,null);
});
