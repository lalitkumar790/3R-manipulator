// Deterministic, software-only side-by-side stepper timing benchmark.
// Neither model includes missed steps, gear backlash, motor load or measured
// torque. These are commanded-step traces, NOT physical-accuracy results.
import {inverse,forward} from './writing.js';
import {bufferSegments,NOMINAL_STEPS_PER_REV,interpolateStepPosition} from './buffered-motion.js';
import {adaptiveStepRates} from './adaptive-speed.js';
const TICK=.0025,STEPS_TO_RAD=2*Math.PI/NOMINAL_STEPS_PER_REV;
const stepQ=q=>q.map(v=>Math.round(v/STEPS_TO_RAD));
const tip=s=>forward(s.map(v=>v*STEPS_TO_RAD));
const pointSegmentDistance=(p,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],denom=dx*dx+dy*dy;
 const u=denom?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/denom)):0;
 return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dy);
};
function rmsDeviation(samples,reference){
 let n=0,sum=0,max=0;
 for(const p of samples){
  let e=Infinity;
  for(let i=1;i<reference.length;i++)e=Math.min(e,pointSegmentDistance(p,reference[i-1],reference[i]));
  if(!Number.isFinite(e))continue;
  sum+=e*e;max=Math.max(max,e);n++;
 }
 return{rmsMm:Math.sqrt(sum/Math.max(1,n))*1000,maxMm:max*1000};
}
export function exampleDrawing(name){
 let shape=[];
 const n=80,cx=.155,cy=.043;
 if(name==='circle')for(let i=0;i<=n;i++){
  const a=i*2*Math.PI/n;shape.push([cx+.020*Math.cos(a),cy+.020*Math.sin(a)]);
 }else if(name==='square'){
  const corners=[[cx-.019,cy-.019],[cx+.019,cy-.019],[cx+.019,cy+.019],[cx-.019,cy+.019],[cx-.019,cy-.019]];
  for(let k=0;k<4;k++)for(let i=0;i<20;i++){const t=i/20;shape.push([corners[k][0]*(1-t)+corners[k+1][0]*t,corners[k][1]*(1-t)+corners[k+1][1]*t])}
  shape.push(corners[0]);
 }else if(name==='spiral')for(let i=0;i<=n;i++){
  const a=i*4*Math.PI/n,r=.002+.020*i/n;shape.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);
 }else throw Error('Unknown test drawing');
 const points=[];
 for(let i=0;i<shape.length;i++){
  const [x,y]=shape[i],q=inverse(x,y,0,1);
  if(!q)throw Error('Example test outside 3R workspace');
  const d=i?Math.hypot(x-shape[i-1][0],y-shape[i-1][1]):0;
  points.push({x,y,q,dt:i?Math.max(.015,d/.040):.05,ink:i>0,lift:i>0?0:.012,strokeIndex:0});
 }
 return{points,shape};
}
function simulateLegacy(points){
 const targets=points.map(p=>stepQ(p.q));
 let index=0,elapsed=0,time=0,command=[...targets[0]],actual=[...targets[0]];
 const samples=[tip(actual)];
 // Browser streams at most 20Hz while each individual axis chases the latest
 // target at up to 400 half-steps/s, independent of the other joints.
 const finish=points.reduce((v,p)=>v+p.dt,0);
 for(let tick=0;time<=finish+2;tick++){
  time+=TICK;
  if(tick%20===0){
   while(index<points.length-1&&elapsed+points[index].dt<=time){
    elapsed+=points[index].dt;index++;
   }
   command=[...targets[index]];
  }
  for(let j=0;j<3;j++)actual[j]+=Math.sign(command[j]-actual[j]);
  if(tick%2===0)samples.push(tip(actual));
  if(time>finish&&actual.every((v,j)=>v===targets.at(-1)[j]))break;
 }
 return{samples,durationS:time};
}
function simulateBuffered(points,adaptive=false,torqueAware=false){
 // Start at the known first target to isolate interpolation from homing.
 // Physical firmware additionally needs a slow pen-up approach segment.
 const segments=bufferSegments(points,{maxHalfStepsPerSecond:100,adaptive,torqueAware}).filter(s=>s.ink);
 let current=stepQ(points[0].q),durationS=0;
 const samples=[tip(current)];
 for(let k=0;k<segments.length;k++){
  const seg=segments[k],from=[...current],ticks=Math.max(1,Math.ceil(seg.ms/(TICK*1000)));
  for(let i=1;i<=ticks;i++){
   current=interpolateStepPosition(from,seg.q,i/ticks);
   if(i%2===0||i===ticks)samples.push(tip(current));
  }
  durationS+=seg.ms/1000;
 }
 return{samples,durationS};
}
export function runComparison(name){
 const {points,shape}=exampleDrawing(name);
 const old=simulateLegacy(points),buffered=simulateBuffered(points),adaptive=simulateBuffered(points,true),torque=simulateBuffered(points,true,true);
 const rates=adaptiveStepRates(points,{maxRate:100,minRate:30}).filter((r,i)=>points[i].ink).map(r=>r.rate);
 return{name,legacy:{...rmsDeviation(old.samples,shape),durationS:old.durationS},
  buffered:{...rmsDeviation(buffered.samples,shape),durationS:buffered.durationS},
  adaptive:{...rmsDeviation(adaptive.samples,shape),durationS:adaptive.durationS,minRate:Math.min(...rates),maxRate:Math.max(...rates),meanRate:rates.reduce((a,b)=>a+b,0)/rates.length},
  torque:{...rmsDeviation(torque.samples,shape),durationS:torque.durationS},
  rates,
  traces:{reference:shape,legacy:old.samples,buffered:buffered.samples,adaptive:adaptive.samples,torque:torque.samples}};
}
export function benchmarkAll(){
 return ['circle','square','spiral'].map(runComparison);
}
