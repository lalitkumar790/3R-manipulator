import test from 'node:test';
import assert from 'node:assert/strict';
import {planWriting,forward,inverse} from '../src/writing.js';
test('IK agrees with FK on writing coordinates',()=>{
 const p=planWriting('HELLO',.015);
 assert.ok(p.points.length>30);
 for(const x of p.points){const y=forward(x.q);assert.ok(Math.hypot(y[0]-x.x,y[1]-x.y)<1e-8);}
});
test('unreachable point is rejected',()=>assert.equal(inverse(10,10),null));
test('empty text rejected',()=>assert.throws(()=>planWriting('  ')));
