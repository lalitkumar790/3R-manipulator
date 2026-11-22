import test from 'node:test';
import assert from 'node:assert/strict';
import {planStrokes,prepareStrokes} from '../src/path-planner.js';
import {forward} from '../src/writing.js';
test('draw scribble maps to reachable IK waypoints',()=>{
 const path=planStrokes([[[0,0],[1,0],[1,1],[0.4,0.4]],[[-.1,.1],[.7,.8]]],.010);
 assert.ok(path.points.length>20);
 assert.equal(path.strokes,2);
 for(const p of path.points){
  assert.ok(p.dt>=.006);
  assert.ok(p.q.every(Number.isFinite));
  const [x,y]=forward(p.q);
  assert.ok(Math.hypot(x-p.x,y-p.y)<.0001);
 }
 assert.ok(path.points.some(p=>p.lift===.012));
 assert.ok(path.points.some(p=>p.ink));
});
test('no draw input is rejected',()=>assert.throws(()=>planStrokes([])));
test('nonfinite drawing coordinate rejected',()=>assert.throws(()=>prepareStrokes([[[0,0],[NaN,0]]] )));
test('shape stays proportionally fitted',()=>{
 const p=prepareStrokes([[[0,0],[2,0],[2,1]]])[0];
 assert.ok(Math.abs(Math.hypot(...[p[1][0]-p[0][0],p[1][1]-p[0][1]])/.092-1)<.01);
});
test('caps excessive canvas stroke count',()=>assert.throws(()=>planStrokes(Array.from({length:151},()=>[[0,0],[1,1]]))));
