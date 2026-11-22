import {torqueBudget,torqueTimeMs} from './torque-adaptive.js';
import {adaptiveStepRates} from './adaptive-speed.js';
// Shared pure motion preparation for the experimental Uno buffered protocol.
// Hardware step counts are *commands*, not encoder measurements.
export const NOMINAL_STEPS_PER_REV=4096;
const radToSteps=q=>Math.round(q*NOMINAL_STEPS_PER_REV/(2*Math.PI));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function bufferSegments(points,{maxHalfStepsPerSecond=100,maxSegmentMs=11000,adaptive=false,torqueAware=false,assumedPenForceN=.06}={}){
 if(!Array.isArray(points)||!points.length||points.length>7500)throw Error('Invalid trajectory.');
 if(!Number.isFinite(maxHalfStepsPerSecond)||maxHalfStepsPerSecond<20||maxHalfStepsPerSecond>120)throw Error('Unsafe step-rate request.');
 const segments=[],allowedSteps=NOMINAL_STEPS_PER_REV*150/360;
 const speedProfile=(adaptive||torqueAware)?adaptiveStepRates(points,{maxRate:maxHalfStepsPerSecond,minRate:30}):null;
 const limits=torqueAware?torqueBudget({forceN:assumedPenForceN}).jointLimits:null;
 let index=-1;
 let previous=null,previousLift=12000;
 function append(q,lift,ms,ink){
  if(segments.length>=2400)throw Error('Too many buffered segments; simplify the drawing.');
  const target=q.map(radToSteps);
  const origin=segments.length?segments[segments.length-1].q:[0,0,0];
  const halfSteps=Math.max(...target.map((value,i)=>Math.abs(value-origin[i])));
  // Check after target-step quantization. Rounding intermediate angles or
  // durations can otherwise violate the firmware's 1.8× speed margin.
  const safeMs=Math.max(40,Math.ceil(ms),Math.ceil(halfSteps*1800/maxHalfStepsPerSecond),limits?torqueTimeMs(origin,target,limits):0);
  if(safeMs>maxSegmentMs)throw Error('A buffered segment exceeds firmware duration; simplify the path.');
  segments.push({q:target,lift,ms:safeMs,ink:!!ink});
 }
 for(const p of points){
  index++;
  if(!Array.isArray(p.q)||p.q.length!==3||!p.q.every(Number.isFinite)||!Number.isFinite(p.lift)||!Number.isFinite(p.dt))throw Error('Invalid waypoint.');
  const q=p.q.map(radToSteps),lift=Math.round(p.lift*1e6);
  if(q.some(x=>Math.abs(x)>allowedSteps)||lift<0||lift>12000)throw Error('Trajectory exceeds conservative travel limits.');
  if(previous===null){
   // First waypoint is an absolute target. In hardware, caller must start
   // from its mechanically verified parked position, pen UP.
   // The existing hardware starts at a manually declared zero. The first
   // pen-up move must be executed slowly and may need multiple segments.
   if(lift<8000)throw Error('Buffered job must start pen-up.');
   const largest=Math.max(...q.map(Math.abs));
   const total=Math.max(100,largest*1800/maxHalfStepsPerSecond);
   const count=Math.max(1,Math.ceil(total/maxSegmentMs));
   for(let i=1;i<=count;i++){
     const intermediate=q.map(v=>Math.round(v*i/count));
     append(intermediate.map(v=>v*2*Math.PI/NOMINAL_STEPS_PER_REV),12000,total/count,false);
   }
   previous=q;previousLift=lift;
   continue;
  }
  const delta=Math.max(...q.map((v,i)=>Math.abs(v-previous[i])));
  // Smoothstep has peak speed 1.5× mean. Reserve another 20% for quantization.
  const allowedRate=(adaptive||torqueAware)?speedProfile[index].rate:maxHalfStepsPerSecond;
  const speedLimited=delta*1800/allowedRate;
  const requested=Math.max(40,p.dt*1000);
  const duration=Math.max(requested,speedLimited);
  // Split long moves for the firmware's limited duration field.
  const count=Math.max(1,Math.ceil(duration/maxSegmentMs));
  const start=[...previous],startLift=previousLift;
  for(let i=1;i<=count;i++){
   const u=i/count;
   const sub=q.map((v,j)=>Math.round(start[j]+(v-start[j])*u));
   const qRad=sub.map(v=>v*2*Math.PI/NOMINAL_STEPS_PER_REV);
   append(qRad,Math.round(startLift+(lift-startLift)*u),duration/count,p.ink);
  }
  previous=q;previousLift=lift;
 }
 // Remove repeated equal-step waypoints but keep pen transitions and timing.
 const compact=[];
 for(const s of segments){
  const p=compact.at(-1);
  if(p&&p.lift===s.lift&&p.ink===s.ink&&p.q.every((v,i)=>v===s.q[i])&&p.ms+s.ms<=maxSegmentMs){
   p.ms+=s.ms;continue;
  }
  compact.push(s);
 }
 // A short final hold provides a deterministic DONE signal.
 return compact;
}
export function stepToMilliDeg(step){return Math.round(step*360000/NOMINAL_STEPS_PER_REV)}
export function interpolateStepPosition(from,to,u){
 const h=clamp(u,0,1),e=h*h*(3-2*h);
 return to.map((v,i)=>Math.round(from[i]+(v-from[i])*e));
}
