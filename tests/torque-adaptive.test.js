import test from 'node:test';
import assert from 'node:assert/strict';
import {torqueBudget,torqueTimeMs,estimateSegmentTorque} from '../src/torque-adaptive.js';
import {bufferSegments} from '../src/buffered-motion.js';
import {exampleDrawing,runComparison} from '../src/trajectory-benchmark.js';
test('torque-aware scheduler stays within estimated conservative reference margin',()=>{
 const p=exampleDrawing('circle').points;
 const segments=bufferSegments(p,{adaptive:true,torqueAware:true,maxHalfStepsPerSecond:100});
 const margin=torqueBudget();
 let origin=[0,0,0];
 for(const s of segments){
  assert.ok(s.ms>=40&&s.ms<=11000);
  const torque=estimateSegmentTorque(origin,s.q,s.ms);
  torque.forEach(x=>assert.ok(x.torqueFraction<=.70+1e-8,'estimated demand exceeds allowed margin at joint '+x.joint));
  origin=s.q;
 }
 assert.ok(segments.length>10);
 assert.ok(margin.jointLimits.every(x=>x.limitRadS2>0&&x.limitRadS2<=.65));
});
test('higher assumed drag reduces acceleration budget and can reject impossible job',()=>{
 const small=torqueBudget({forceN:.03}).jointLimits;
 const large=torqueBudget({forceN:.10}).jointLimits;
 assert.ok(large.every((v,i)=>v.limitRadS2<=small[i].limitRadS2));
 assert.throws(()=>torqueBudget({forceN:.20}),/exceeds/);
});
test('torque-aware motion takes at least fixed buffered time for same drawing',()=>{
 for(const name of ['circle','square','spiral']){
  const r=runComparison(name);
  assert.ok(Number.isFinite(r.torque.rmsMm));
  assert.ok(r.torque.durationS>=r.adaptive.durationS-.1);
 }
});
