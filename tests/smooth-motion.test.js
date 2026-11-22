import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTimedPlan,smoothPose} from '../src/motion-smoothing.js';
import {prepareStrokes,planStrokes} from '../src/path-planner.js';
const p=(q,dt,ink=true,strokeIndex=0)=>({q:[q,0,-q],dt,ink,strokeIndex,lift:ink?0:.012});
test('sampler starts at reference and ends at final waypoint',()=>{
 const points=[p(0,.03,false),p(.2,.10),p(.4,.10),p(.6,.10),p(.6,.05,false)];
 assert.equal(sampleTimedPlan(points,0).q[0],0);
 assert.equal(sampleTimedPlan(points,1.2).q[0],.6);
 assert.equal(sampleTimedPlan(points,1.2).done,true);
});
test('cubic interpolation preserves endpoints and pen height',()=>{
 const points=[p(0,.02,false),p(.1,.1),p(.2,.1),p(.3,.1),p(.3,.02,false)];
 assert.ok(Math.abs(smoothPose(points,2,0).q[0]-.1)<1e-10);
 assert.ok(Math.abs(smoothPose(points,2,.1).q[0]-.2)<1e-10);
 assert.equal(smoothPose(points,2,.05).lift,0);
});
test('dense freehand is simplified and fitted to valid kinematics',()=>{
 const spiral=Array.from({length:1300},(_,i)=>{
  const a=i*.018,rad=.08+.7*i/1300;
  return[rad*Math.cos(a)+1,rad*Math.sin(a)+1];
 });
 const fitted=prepareStrokes([spiral]);
 assert.ok(fitted[0].length<spiral.length/2);
 const plan=planStrokes([spiral],.01);
 assert.ok(plan.points.length<7500);
 assert.ok(plan.points.some(p=>p.ink));
});
