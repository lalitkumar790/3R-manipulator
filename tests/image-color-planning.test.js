import test from 'node:test';
import assert from 'node:assert/strict';
import {planStrokes} from '../src/path-planner.js';
import {forward} from '../src/writing.js';

test('image color layers preserve their stroke colors in IK waypoints',()=>{
 const strokes=[[[0,0],[1,0],[1,1]],[[0.2,0],[.8,.6]]];
 const p=planStrokes(strokes,.010,['#dc3545','#2563eb']);
 assert.equal(p.strokes,2);
 assert.ok(p.points.some(q=>q.color==='#dc3545'));
 assert.ok(p.points.some(q=>q.color==='#2563eb'));
 for(const point of p.points){
  const [x,y]=forward(point.q);
  assert.ok(Math.hypot(x-point.x,y-point.y)<.0001);
 }
});
test('invalid drawing coordinates rejected',()=>assert.throws(()=>planStrokes([[[0,0],[NaN,0]]],.010)));
test('empty drawing rejected',()=>assert.throws(()=>planStrokes([],.01)));
test('source bounds rejected',()=>assert.throws(()=>planStrokes([[[0,0],[11,1]]],.01)));
