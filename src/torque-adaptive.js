// Feedforward torque-margin scheduler; engineering approximation, NOT
// measured torque-speed dynamics nor proof of hardware safety.
import {estimateTorque,motorReferenceTorqueNm} from './torque-estimate.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function torqueBudget({forceN=.06,torqueFraction=.70,maxAccelRadS2=.65}={}){
 if(!Number.isFinite(forceN)||forceN<0||forceN>.5)throw Error('Invalid pen drag estimate');
 if(!Number.isFinite(torqueFraction)||torqueFraction<.35||torqueFraction>.85)throw Error('Invalid torque margin');
 if(!Number.isFinite(maxAccelRadS2)||maxAccelRadS2<=0||maxAccelRadS2>2)throw Error('Invalid acceleration cap');
 const estimates=estimateTorque(forceN,0);
 const budget=estimates.map(v=>{
  const headroom=motorReferenceTorqueNm*torqueFraction-v.dragNm;
  if(headroom<=0)throw Error('Assumed pen drag exceeds '+Math.round(torqueFraction*100)+'% reference torque at joint '+v.joint+'. Reduce contact force before plotting.');
  return {joint:v.joint,limitRadS2:clamp(headroom/v.inertia,.04,maxAccelRadS2),dragNm:v.dragNm,inertia:v.inertia,headroomNm:headroom};
 });
 return{jointLimits:budget,referenceTorqueNm:motorReferenceTorqueNm,assumedForceN:forceN,torqueFraction};
}
// Conservative smoothstep acceleration: peak |qdd| = 6*|Δq|/T².
// Existing firmware cubic interpolation is run separately per short segment,
// so this is a lower-bound on each segment's duration (joint jerk is unbounded).
export function torqueTimeMs(fromSteps,toSteps,limits){
 const radPerStep=2*Math.PI/4096;
 let minimum=40;
 for(let j=0;j<3;j++){
  const d=Math.abs(toSteps[j]-fromSteps[j])*radPerStep;
  minimum=Math.max(minimum,1000*Math.sqrt(6*d/limits[j].limitRadS2));
 }
 return Math.ceil(minimum);
}
export function estimateSegmentTorque(fromSteps,toSteps,durationMs,{forceN=.06}={}){
 const limits=estimateTorque(forceN,0);
 const t=durationMs/1000;
 return limits.map((v,j)=>{
  const accel=6*Math.abs(toSteps[j]-fromSteps[j])*(2*Math.PI/4096)/(t*t);
  const torqueNm=v.dragNm+v.inertia*accel;
  return{joint:j+1,accelRadS2:accel,torqueNm,torqueFraction:torqueNm/motorReferenceTorqueNm};
 });
}
