import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runScenario} from '../lib/emergency-routing.mjs';
import {createBuildingMission} from '../lib/building-mission.mjs';
const config={devices:40,seed:20261020,participation:100,permissions:100,damaged:100,
 responses:0,helpRequests:0,battery:65,bluetooth:true,wifi:true,gateway:true,responsesByNode:{'NODE-001':'SOS_EXPLICIT'}};
const ready=async mission=>{for(let i=0;i<40&&!mission.snapshot().path.length;i++)await Promise.resolve();};
test('a visible hop is not an ACK: only completing the computed path receives a synthetic receipt',async()=>{
 const model=runScenario(config);const mission=createBuildingMission({model,sourceId:'NODE-001'});
 const pending=mission.start();await ready(mission);
 assert.deepEqual(mission.snapshot().path,model.routes[0].path);
 assert.ok(mission.snapshot().path.length>2);
 assert.equal(mission.snapshot().receipt,null);
 mission.advance();assert.equal(mission.snapshot().receipt,null);
 for(let i=0;i<20&&mission.snapshot().busy;i++){mission.advance();await Promise.resolve();}
 const result=await pending;assert.equal(result.state,'RECEIVED');
 assert.equal(result.record.status,'ACK_SYNTHETIC');assert.equal(result.record.hasPayload,false);mission.dispose();
});
test('silence never creates a message or enrolling a nonparticipant',async()=>{
 const model=runScenario({...config,responsesByNode:{'NODE-001':'UNKNOWN'}});
 const mission=createBuildingMission({model,sourceId:'NODE-001'});
 assert.equal((await mission.start()).messageId,null);assert.equal(model.summary.humanSOS,0);
 assert.throws(()=>runScenario({...config,participation:0}),/participating/);
 assert.throws(()=>runScenario({...config,responsesByNode:{'NODE-001':'RESCUED'}}),/explicit/);mission.dispose();
});
test('no gateway queues; restoring the route retries the SAME queued ID',async()=>{
 let clock=100000;const mission=createBuildingMission({model:runScenario({...config,gateway:false}),sourceId:'NODE-001',now:()=>clock});
 const queued=await mission.start();assert.equal(queued.state,'QUEUED');assert.equal(queued.receipt,null);
 mission.updateModel(runScenario(config));clock+=5;
 const pending=mission.start();await ready(mission);
 for(let i=0;i<20&&mission.snapshot().busy;i++){mission.advance();await Promise.resolve();}
 const result=await pending;assert.equal(result.state,'RECEIVED');assert.equal(result.messageId,queued.messageId);mission.dispose();
});
test('cutting the link mid-flight cannot acknowledge, and STOP invalidates all later animation steps',async()=>{
 const mission=createBuildingMission({model:runScenario(config),sourceId:'NODE-001'});
 const pending=mission.start();await ready(mission);mission.advance();
 mission.updateModel(runScenario({...config,gateway:false}));
 assert.equal((await pending).state,'QUEUED');assert.equal(mission.snapshot().receipt,null);
 mission.stop();for(let i=0;i<20;i++)mission.advance();
 assert.equal(mission.snapshot().messageId,null);assert.equal(mission.snapshot().receipt,null);mission.dispose();
});

test('a queued message expires by local clock and cannot receive after expiry',async()=>{
 let clock=100000;const mission=createBuildingMission({model:runScenario({...config,gateway:false}),sourceId:'NODE-001',now:()=>clock});
 await mission.start();clock+=60001;const expired=mission.refresh();
 assert.equal(expired.state,'EXPIRED');assert.equal(expired.record.hasPayload,false);
 mission.updateModel(runScenario(config));await mission.start();mission.advance();
 assert.equal(mission.snapshot().receipt,null);assert.equal(mission.snapshot().state,'EXPIRED');mission.dispose();
});
