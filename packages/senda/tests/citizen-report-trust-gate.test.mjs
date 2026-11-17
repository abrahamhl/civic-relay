import test from 'node:test';
import assert from 'node:assert/strict';
import { createReporterKeys, encodeReport, decodeReports, incidentToCap } from '../src/hazard-reports.mjs';

const good = {
  kind: 'STREET_FLOODED', lat: 39.42691, lon: -0.41742,
  at: Date.UTC(2026, 10, 17, 1, 1),
  people: { trapped: 1, injured: 0 },
  measurement: {rise:{cmPerMin:2.50,stdErr:0.12}},
};
test('signed citizen report round trip stays 160 chars, never proof of official reporter identity', async () => {
  const k=await createReporterKeys();
  const line=await encodeReport(good,k);
  assert.equal(line.length,160);
  const data=await decodeReports(line);
  assert.equal(data.rejected.length,0);
  assert.equal(data.reports.length,1);
  assert.equal(data.reports[0].lat,good.lat);
  assert.equal(data.reports[0].people.trapped,1);
  assert.equal(data.reports[0].signed,true);
  assert.equal('institutionalIdentityVerified' in data.reports[0],false);
});
test('encoder refuses wrapped, implausible or truncated input before signed SND3 frame is emitted',async () => {
  const k=await createReporterKeys();
  const bad=[
    {lat:95},{lat:NaN},{lon:185},{lon:Infinity},
    {at:Date.UTC(2019,11,31)},{at:Date.UTC(2101,0,1)},{at:NaN},
    {people:{trapped:-1,injured:0}},{people:{trapped:256,injured:0}},
    {people:{trapped:1.5,injured:0}},
    {measurement:{rise:{cmPerMin:NaN,stdErr:0}}},
    {measurement:{rise:{cmPerMin:0,stdErr:-0.5}}},
  ];
  for(const mod of bad){
    await assert.rejects(encodeReport({...good,...mod},k),/inválid|fuera|recuento|representable/);
  }
});
test('decoder rejects a cryptographically valid but structurally impossible citizen report',async()=>{
  const k=await createReporterKeys();
  const line=await encodeReport(good,k);
  for(const mutate of [
    (bytes)=>{bytes[1]=255;},
    (bytes)=>{new DataView(bytes.buffer).setInt32(2,Math.round(95*1e5));},
    (bytes)=>{new DataView(bytes.buffer).setInt32(6,Math.round(190*1e5));},
  ]){
    const bytes=Uint8Array.from(Buffer.from(line.slice(5),'base64url'));
    mutate(bytes);
    const signature=await crypto.subtle.sign({name:'Ed25519'},k.privateKey,bytes.subarray(0,20));
    bytes.set(new Uint8Array(signature),52);
    const bad='SND3 '+Buffer.from(bytes).toString('base64url');
    const decoded=await decodeReports(bad);
    assert.equal(decoded.reports.length,0);
    assert.equal(decoded.rejected.length,1);
    assert.match(decoded.rejected[0],/contenido/);
  }
});
test('citizen incident CAP is permanently exercise-only until institutional trust adapter is implemented',()=>{
  const assessed={id:'INC-LAB',state:'OFFICIAL',lifeRisk:false,severity:.6,
    reporters:1,reports:1,pReal:.6,why:['hypothetical'],basis:'SIMULATED'};
  const cluster={family:'WATER',firstAt:good.at,center:{lat:good.lat,lon:good.lon},
    reports:[good]};
  const demo=incidentToCap(assessed,cluster,{now:good.at});
  assert.match(demo,/<status>Exercise<\/status>/);
  assert.match(demo,/<scope>Restricted<\/scope>/);
  assert.doesNotMatch(demo,/<scope>Public<\/scope>/);
  assert.throws(()=>incidentToCap(assessed,cluster,{now:good.at,exercise:false}),/institucional autenticado/);
  assert.throws(()=>incidentToCap(assessed,cluster,{now:good.at,exercise:'false'}),/institucional autenticado/);
});
