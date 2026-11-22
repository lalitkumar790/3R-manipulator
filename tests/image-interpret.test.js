import test from 'node:test';
import assert from 'node:assert/strict';
import {traceLuma} from '../src/image-interpret.js';
function synthetic(w=112,h=112){
 const luma=new Float32Array(w*h).fill(248);
 for(let y=17;y<h-17;y++)for(let x=23;x<w-23;x++){
  // A rectangular silhouette plus two internal facial-feature-like shapes.
  const outline=x<27||x>w-28||y<21||y>h-22;
  const eyeLeft=Math.abs(x-44)<8&&Math.abs(y-47)<3;
  const eyeRight=Math.abs(x-68)<8&&Math.abs(y-47)<3;
  const mouth=Math.abs(x-56)<18&&Math.abs(y-72)<3;
  if(outline||eyeLeft||eyeRight||mouth)luma[y*w+x]=20;
 }
 return luma;
}
test('line art extracts internal structure as well as outer silhouette',()=>{
 const paths=traceLuma(synthetic(),112,112,{mode:'sketch',detail:80});
 assert.ok(paths.length>=2,'distinct internal shapes should remain');
 assert.ok(paths.some(p=>p.some(([x,y])=>x>0.35&&x<.65&&y>.35&&y<.75)));
});
test('simple blank input produces no fake lines',()=>{
 assert.deepEqual(traceLuma(new Float32Array(96*96).fill(255),96,96,{mode:'stencil'}),[]);
});
test('all three styles return valid normalized strokes',()=>{
 for(const mode of ['outline','stencil','sketch']){
  const paths=traceLuma(synthetic(),112,112,{mode,detail:70});
  assert.ok(paths.length>0,mode);
  assert.ok(paths.every(p=>p.length>=2&&p.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y))));
 }
});
