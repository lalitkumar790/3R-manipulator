import test from 'node:test';
import assert from 'node:assert/strict';
import {bufferSegments,interpolateStepPosition,stepToMilliDeg} from '../src/buffered-motion.js';
import {benchmarkAll,exampleDrawing} from '../src/trajectory-benchmark.js';
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
 const summary=first.map(x=>({test:x.name,originalRmsMm:+x.legacy.rmsMm.toFixed(3),bufferedRmsMm:+x.buffered.rmsMm.toFixed(3),originalTimeS:+x.legacy.durationS.toFixed(2),bufferedTimeS:+x.buffered.durationS.toFixed(2)}));
 console.log('BENCHMARK_JSON '+JSON.stringify(summary));
});
