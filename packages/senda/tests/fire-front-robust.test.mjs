import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateRobustFront} from '../src/fire-front-robust.mjs';
const origin=[40,-105], res=2, k=111.2*Math.cos(40*Math.PI/180);
const at=(minute,anomaly=false)=>({
 t:new Date(Date.parse('2024-01-01T12:00:00Z')+minute*60000).toISOString(),
 det:[-0.4,-0.2,0,0.2,0.4].map(offset=>[40,-105+(minute/10+offset)/k,10,10]).concat(anomaly?[[40,-105+200/k,8,10]]:[])
});
test('Theil-Sen quantile front resists isolated positive outlier (synthetic sanity only)',()=>{
 const p=estimateRobustFront([at(0),at(10),at(20,true),at(30),at(40),at(50)],{origin,spreadToDeg:90,pixelResolutionKm:res});
 assert.equal(p.status,'RESEARCH_TREND_ONLY');
 assert.ok(Math.abs(p.speedKmh-6)<1.5,JSON.stringify(p));
 assert.equal(p.forOperationalAlert,false);
 assert.equal(p.validFrames,6);
});
test('research front refuses subpixel movement or fewer than four frames',()=>{
 const first=estimateRobustFront([at(0),at(10),at(20)],{origin,spreadToDeg:90,pixelResolutionKm:2});
 assert.equal(first.status,'INSUFFICIENT_INDEPENDENT_FRAMES');assert.equal(first.speedKmh,null);
 const p=estimateRobustFront([at(0),at(10),at(20),at(30)],{origin,spreadToDeg:90,pixelResolutionKm:20});
 assert.equal(p.status,'UNRESOLVED_AT_SENSOR_SCALE'); assert.equal(p.speedKmh,null);
});
test('strict GOES quality exclusion works also when outlier mask is exploratory',()=>{
 const p=estimateRobustFront([at(0),at(10),{...at(20),det:[...at(20).det,[40,-105+200/k,8,14]]},at(30),at(40)],{origin,spreadToDeg:90,pixelResolutionKm:2});
 assert.equal(p.rejected.mask,1);assert.equal(p.validFrames,5);
});
test('invalid configuration is safe and disallows speed estimates',()=>{
 const p=estimateRobustFront([at(0)],{origin,spreadToDeg:90,pixelResolutionKm:0});
 assert.equal(p.status,'INVALID_PARAMETERS');assert.equal(p.speedKmh,null);
});
