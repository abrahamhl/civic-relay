import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {classifyGoesPixel,filterGoesFrames,assessCameraMeasurement,GOES_STRICT_MASKS} from '../src/observation-quality.mjs';

const dp=(mask,t='2025-01-08T02:00:00Z')=>({t,det:[[34.18,-118.11,12,mask]]});
test('GOES: only NOAA lowest-false-alarm mask classes are strict; cloudy/high/medium remain exploratory',()=>{
  assert.deepEqual(GOES_STRICT_MASKS,[10,11,30,31]);
  for (const n of [10,11,30,31]) assert.equal(classifyGoesPixel([34,-118,9,n]),'STRICT');
  for (const n of [12,13,14,15,32,33,34,35]) assert.equal(classifyGoesPixel([34,-118,9,n]),'EXPLORATORY');
  assert.equal(classifyGoesPixel([34,-118,9]),'MISSING_MASK');
  assert.equal(classifyGoesPixel([400,-118,9,10]),'INVALID');
});
test('GOES: cloud detections never enter strict calibration, retain counts and time',()=>{
  const q=filterGoesFrames([dp(10),dp(14,'2025-01-08T02:05:00Z'),dp(31,'2025-01-08T02:10:00Z')]);
  assert.equal(q.status,'FILTERED_CANDIDATE'); assert.equal(q.usableForCalibration,true);
  assert.equal(q.counts.EXPLORATORY,1); assert.deepEqual(q.frames.map(f=>f.det.length),[1,0,1]);
  assert.ok(q.removedFraction>0.3);
});
test('GOES: legacy compact data without mask is NEVER silently reclassified as strict',()=>{
  const legacy=[{t:'2025-01-08T02:00:00Z',det:[[34,-118,3]]},{t:'2025-01-08T02:05:00Z',det:[[34.1,-118,4]]}];
  const q=filterGoesFrames(legacy); assert.equal(q.status,'LEGACY_NO_MASK'); assert.equal(q.usableForCalibration,false);
  assert.equal(q.counts.MISSING_MASK,2); assert.equal(q.frames[0].det.length,0);
});
test('GOES: out-of-order timestamps and one-frame detections block calibration',()=>{
  assert.equal(filterGoesFrames([dp(10,'2025-01-08T02:10:00Z'),dp(10)]).status,'INVALID_TIMESTAMPS');
  assert.equal(filterGoesFrames([dp(10)]).usableForCalibration,false);
});
const nowMs=Date.parse('2026-11-06T01:00:00Z');
const base={sourceId:'authority-x',sourceUrl:'https://example.org/frames',capturedAtUTC:'2026-11-06T00:59:30Z',licenseForThisData:true,accessAuthorized:true,privacyReviewPassed:true,modality:'RGB',metric:'countVehicles',value:8};
test('camera: source, consent, currentness, and rights are all separate requirements',()=>{
  assert.equal(assessCameraMeasurement(base,{nowMs}).canEnterLivePredictor,true);
  const fail=assessCameraMeasurement({...base,licenseForThisData:false,accessAuthorized:false,capturedAtUTC:'2026-11-05T01:00:00Z'},{nowMs});
  assert.ok(fail.issues.includes('RIGHTS_NOT_VERIFIED')); assert.ok(fail.issues.includes('ACCESS_NOT_AUTHORIZED'));
  assert.ok(fail.issues.includes('STALE_OR_FUTURE'));
  assert.equal(fail.canIssueOfficialAlert,false);
});
test('camera: RGB is never a thermal radiometric measurement',()=>{
  const f=assessCameraMeasurement({...base,metric:'temperatureC',value:250,modality:'RGB'},{nowMs});
  assert.ok(f.issues.includes('NOT_A_RADIOMETRIC_MEASUREMENT'));
  const good=assessCameraMeasurement({...base,metric:'temperatureC',modality:'THERMAL_RADIOMETRIC',value:250,
    calibration:{calibrationId:'lab-001',emissivity:0.95,distanceM:250,reflectedTempC:25,uncertaintyC:8}},{nowMs});
  assert.equal(good.canEnterLivePredictor,true); assert.equal(good.canIssueOfficialAlert,false);
});
test('camera: speed cannot become a measured speed from assumed vehicle width',()=>{
  const bad=assessCameraMeasurement({...base,metric:'speedKmh',value:45},{nowMs});
  assert.ok(bad.issues.includes('SPEED_NOT_GEOMETRICALLY_CALIBRATED'));
  const good=assessCameraMeasurement({...base,metric:'speedKmh',value:45,
    calibration:{calibrationId:'H-ROI-01',method:'ROAD_PLANE_HOMOGRAPHY',uncertaintyKmh:3}},{nowMs});
  assert.equal(good.canEnterLivePredictor,true);
});
test('catalogue: official sources are traceable but NOT automatically video-cleared',()=>{
  const here=dirname(fileURLToPath(import.meta.url));
  const registry=JSON.parse(readFileSync(resolve(here,'../data/source-registry.v021.json'),'utf8'));
  assert.ok(registry.sources.length>=10); assert.equal(new Set(registry.sources.map(s=>s.id)).size,registry.sources.length);
  assert.ok(registry.sources.some(s=>s.id==='caltrans_cctv' && s.productionVideoPermission===false));
  assert.ok(registry.sources.some(s=>s.id==='dgt_datex' && s.productionVideoPermission===false));
  for(const s of registry.sources){ assert.ok(s.homepage.startsWith('https://'));assert.ok(s.rights && s.gap); assert.equal(s.status,'OFFICIAL_DOCUMENTATION_CHECKED'); }
});
