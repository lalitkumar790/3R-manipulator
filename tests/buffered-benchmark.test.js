import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferSegments,interpolateStepPosition,stepToMilliDeg} from '../src/buffered-motion.js';
import {benchmarkAll,exampleDrawing} from '../src/trajectory-benchmark.js';
import {adaptiveStepRates} from '../src/adaptive-speed.js';
test('buffered trajectory is bounded, pen-up first and rate-limited',()=>{
 const path=exampleDrawing('circle').points;
 const segments=bufferSegments(path);
 assert.ok(segments.length>3);
 assert.equal(segments[0].lift,12000);
 assert.equal(segments[0].ink,false);
 let before=[0,0,0];
 for(const seg of segments){
  assert.ok(seg.ms>=40&&seg.ms<=11000);
  const largest=Math.max(...seg.q.map((v,i)=>Math.abs(v-before[i])));
  assert.ok(largest*1800<=seg.ms*100+100,'motion exceeds nominal 100-step/s peak reserve');
  for(const v of seg.q)assert.ok(Math.abs(v)<4096*150/360);
  before=seg.q;
 }
});
test('interpolation distributes steps smoothly between a shared start and goal',()=>{
 const a=[0,0,0],b=[200,100,-50],mid=interpolateStepPosition(a,b,.5);
 assert.deepEqual(mid,[100,50,-25]);
 assert.deepEqual(interpolateStepPosition(a,b,1),b);
 assert.equal(stepToMilliDeg(4096),360000);
});
test('benchmark is deterministic, produces finite errors and completion times',()=>{
 const first=benchmarkAll(),second=benchmarkAll();
 assert.deepEqual(first.map(x=>x.legacy.rmsMm),second.map(x=>x.legacy.rmsMm));
 for(const item of first){
  for(const name of ['legacy','buffered']){
   assert.ok(Number.isFinite(item[name].rmsMm));
   assert.ok(Number.isFinite(item[name].maxMm));
   assert.ok(item[name].durationS>0);
  }
 }
 const summary=first.map(x=>({test:x.name,originalRmsMm:+x.legacy.rmsMm.toFixed(3),bufferedRmsMm:+x.buffered.rmsMm.toFixed(3),adaptiveRmsMm:+x.adaptive.rmsMm.toFixed(3),originalTimeS:+x.legacy.durationS.toFixed(2),bufferedTimeS:+x.buffered.durationS.toFixed(2),adaptiveTimeS:+x.adaptive.durationS.toFixed(2)}));
 console.log('BENCHMARK_JSON '+JSON.stringify(summary));
});

test('adaptive rate lowers around square corners and preserves step-rate bounds',()=>{
 const drawing=exampleDrawing('square');
 const profile=adaptiveStepRates(drawing.points,{maxRate:100,minRate:30});
 const actual=profile.filter((r,i)=>drawing.points[i].ink).map(x=>x.rate);
 assert.ok(Math.min(...actual)<80,'tight corners must slow down');
 assert.ok(Math.max(...actual)>=95,'straight segments should recover high speed');
 const segments=bufferSegments(drawing.points,{maxHalfStepsPerSecond:100,adaptive:true});
 let last=[0,0,0];
 for(const seg of segments){
  assert.ok(seg.ms>=40&&seg.ms<=11000);
  const stepDelta=Math.max(...seg.q.map((v,i)=>Math.abs(v-last[i])));
  assert.ok(stepDelta*1800<=seg.ms*100+120,'adaptive duration must respect rate ceiling');
  last=seg.q;
 }
});
test('adaptive benchmark gives finite three-way metrics',()=>{
 for(const r of benchmarkAll()){
  assert.ok(r.adaptive.durationS>0);
  assert.ok(Number.isFinite(r.adaptive.rmsMm));
  assert.ok(r.adaptive.minRate>=30&&r.adaptive.maxRate<=100);
  assert.ok(r.adaptive.durationS>=r.buffered.durationS-0.1,'adaptive never exceeds fixed maximum rate');
 }
});
