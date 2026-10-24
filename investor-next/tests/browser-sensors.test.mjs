import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSensors,validateRfSample} from '../lib/browser-sensors.mjs';

test('sensor APIs require explicit consent and never invoke a fallback on unsupported browsers',async()=>{
  let calls=0;
  const nav={mediaDevices:{getUserMedia:async()=>{calls++;}}};
  const sensors=createBrowserSensors({nav,secure:true});
  assert.equal((await sensors.request('camera')).state,'PERMISSION_REQUIRED');
  assert.equal(calls,0);
  assert.equal((await sensors.request('bluetooth',{consent:true})).state,'UNSUPPORTED');
  assert.equal(createBrowserSensors({nav,secure:false}).capabilities().camera,'UNSUPPORTED');
});
test('camera rejection cannot report DEVICE_CONNECTED or LIVE_MEASUREMENT',async()=>{
  const sensors=createBrowserSensors({nav:{mediaDevices:{getUserMedia:async()=>{throw {name:'NotAllowedError'};}}},secure:true});
  const state=await sensors.request('camera',{consent:true});
  assert.equal(state.state,'PERMISSION_DENIED');assert.equal(state.sample,null);
});
test('STOP invalidates pending media grants and stops the late tracks',async()=>{
  let finish,stopped=0;
  const sensors=createBrowserSensors({nav:{mediaDevices:{getUserMedia:()=>new Promise(r=>finish=r)}},secure:true});
  const pending=sensors.request('camera',{consent:true});sensors.stopAll();
  finish({getTracks:()=>[{stop:()=>stopped++}]});
  assert.equal((await pending).state,'NO_SENSOR');assert.equal(stopped,1);
});
test('late geolocation success after STOP does not expose coordinates',async()=>{
  let finish;const events=[];
  const sensors=createBrowserSensors({secure:true,nav:{geolocation:{getCurrentPosition:r=>finish=r}},onChange:v=>events.push(v)});
  const pending=sensors.request('geolocation',{consent:true});sensors.stopAll();
  finish({coords:{latitude:1,longitude:2,accuracy:3},timestamp:Date.now()});
  assert.equal((await pending).sample,null);assert.ok(events.every(v=>v.sample===null));
});
test('connectivity metadata does not invent Wi-Fi, RTT, downlink or RSSI',async()=>{
  const sensors=createBrowserSensors({secure:true,nav:{onLine:true}});
  const result=await sensors.request('connectivity',{consent:true});
  assert.equal(result.sample.effectiveType,'UNKNOWN');assert.equal(result.sample.rttMs,null);
  assert.equal(result.sample.downlinkMbps,null);assert.equal(result.sample.rssi,undefined);
});
test('BLE chooser is service-filtered; permission and stream presence are distinct from measurements',async()=>{
  let options;const sensors=createBrowserSensors({secure:true,nav:{bluetooth:{requestDevice:async opts=>{options=opts;return {};}}}});
  const result=await sensors.request('bluetooth',{consent:true});
  assert.deepEqual(options,{filters:[{services:['battery_service']}]});
  assert.equal(result.state,'PERMISSION_GRANTED');assert.equal(result.sample,null);
});
test('RF fixtures have provenance and cannot assert live capture or calibrated power',()=>{
  const fixture={protocol:'OEP-LAB-SPECTRUM-v1',source:'fixture:rtl-bridge',timestampMs:1000,
    unit:'dBFS',frequencyHz:[100e6,101e6],power:[-60,-70]};
  const sample=validateRfSample(fixture,{fixture:true});
  assert.equal(sample.state,'DEMO_ONLY');assert.equal(sample.evidence,'SIMULATED');
  fixture.power[0]=90;assert.equal(sample.power[0],-60);
  assert.throws(()=>validateRfSample({...fixture,unit:'dBm'}),/calibration/);
  assert.throws(()=>validateRfSample({...fixture,power:[NaN,1]}),/frequency or power/);
  assert.throws(()=>validateRfSample({...fixture,frequencyHz:[101e6,100e6]}),/frequency or power/);
  assert.equal(validateRfSample(fixture).state,'IMPLEMENTED_UNVERIFIED');
});
test('standard BLE battery read carries measured units and disconnects on STOP',async()=>{
 let disconnected=0;
 const resource={gatt:{disconnect:()=>disconnected++,connect:async()=>({getPrimaryService:async()=>({
   getCharacteristic:async()=>({readValue:async()=>({getUint8:()=>42})})})})}};
 const sensors=createBrowserSensors({secure:true,nav:{bluetooth:{requestDevice:async()=>resource}}});
 const result=await sensors.request('bluetooth',{consent:true});
 assert.equal(result.state,'LIVE_MEASUREMENT');assert.equal(result.unit,'%');
 assert.deepEqual(result.sample,{batteryPct:42});assert.equal(result.sample.rssi,undefined);
 sensors.stopAll();assert.equal(disconnected,1);
});
