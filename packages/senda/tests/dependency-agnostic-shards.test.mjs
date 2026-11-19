import test from 'node:test';
import assert from 'node:assert/strict';
import {arbitraryDependencyShardBounds as bound} from '../src/dependency-agnostic-shards.mjs';
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-10,String(x)+' != '+String(y));
test('two 95% packets may fail together: lower is 95%, not 99.75%',()=>{
  const x=bound([{p:.95,shards:1},{p:.95,shards:1}],1);
  near(x.lowerBound,.95);
  assert.ok(x.lowerBound<1-(1-.95)**2);
  assert.equal(x.conditionalIndependenceRequired,false);
});
test('two packets both needed: only >=90% can be assured with arbitrary dependence',()=>{
  const gs=[{p:.95,shards:1},{p:.95,shards:1}];
  near(bound(gs,2).lowerBound,.9);
  near(bound(gs,2).upperBound,1);
  near(bound(gs,2,{marginalsAreExact:true}).upperBound,.95);
});
test('one high-capacity winning packet gives a single-group lower bound',()=>{
  const x=bound([{p:.8,shards:4},{p:.01,shards:1}],3);
  assert.ok(x.lowerBound>=.8-1e-10);
});
test('three correlated packets with 2-of-3 requirement: lower bound .85 for p=.9',()=>{
  near(bound(Array.from({length:3},()=>({p:.9,shards:1})),2).lowerBound,.85);
});
test('all-succeed, none-succeed and zero-probability edgecases',()=>{
  near(bound([{p:1,shards:1},{p:1,shards:1}],1).lowerBound,1);
  near(bound([{p:0,shards:1},{p:0,shards:1}],1).lowerBound,0);
  near(bound([{p:1,shards:1},{p:0,shards:1}],2).lowerBound,0);
});
test('32 group bounded fallback remains conservative without exponential enumeration',()=>{
  const x=bound(Array.from({length:32},()=>({p:.8,shards:1})),16);
  assert.ok(x.lowerBound>=0&&x.lowerBound<=x.upperBound);
  assert.equal(x.exhaustiveWinningSubsets,false);
});
test('NaN, invalid counts and impossible GF(256) shard arrangements fail closed',()=>{
  for(const gs of [
    [{p:NaN,shards:1}],[{p:1.1,shards:1}],
    [{p:.5,shards:-1}],[{p:.5,shards:1.2}],
  ])assert.throws(()=>bound(gs,1));
  assert.throws(()=>bound([{p:.5,shards:1}],2));
  assert.throws(()=>bound([{p:.5,shards:255},{p:.4,shards:1}],1));
});
test('280 seeded independent-model cases stay inside dependence-agnostic bounds',()=>{
  let seed=6107;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let n=1;n<=7;n++)for(let t=0;t<40;t++){
    const gs=Array.from({length:n},()=>({p:rng(),shards:1+Math.floor(rng()*3)}));
    const k=1+Math.floor(rng()*gs.reduce((a,g)=>a+g.shards,0));
    const interval=bound(gs,k,{marginalsAreExact:true});
    let dist=[1];
    for(const {p,shards} of gs){
      const next=new Array(dist.length+shards).fill(0);
      for(let j=0;j<dist.length;j++){next[j]+=(1-p)*dist[j];next[j+shards]+=p*dist[j];}
      dist=next;
    }
    const reference=dist.reduce((a,v,j)=>a+(j>=k?v:0),0);
    assert.ok(interval.lowerBound<=reference+1e-9&&reference<=interval.upperBound+1e-9);
  }
});
