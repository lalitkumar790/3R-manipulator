import loadMujoco from '@mujoco/mujoco';
import mjcfUrl from './writing-scene.xml?raw';
// Fixed 2 ms simulation step, bounded joint-reference slew.
// WARNING: this is still a torque-limited physics approximation, not a 28BYJ
// coil-level electromagnetic model or a validated motor speed/torque curve.
export async function startPhysics(){
 const mujoco=await loadMujoco();
 const model=mujoco.MjModel.from_xml_string(mjcfUrl);
 if(!model)throw Error('MuJoCo did not compile the MJCF scene.');
 const data=new mujoco.MjData(model);
 const initial=[-.85,1.4,-.55,.012];
 const stepSize=.002, maxReferenceRadS=.30;
 let accumulator=0,command=[...initial];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function reset(){
   mujoco.mj_resetData(model,data);
   for(let i=0;i<4;i++){data.qpos[i]=initial[i];data.ctrl[i]=initial[i]}
   command=[...initial];accumulator=0;
   mujoco.mj_forward(model,data);
 }
 reset();
 function step(target,lift,frameDt){
   const dt=clamp(Number(frameDt)||0,0,.08);
   accumulator=Math.min(.08,accumulator+dt);
   const goal=[...target.map(q=>clamp(q,-Math.PI,Math.PI)),clamp(lift,0,.012)];
   let steps=0;
   while(accumulator>=stepSize&&steps<40){
     for(let j=0;j<3;j++){
       const difference=goal[j]-command[j];
       command[j]+=clamp(difference,-maxReferenceRadS*stepSize,maxReferenceRadS*stepSize);
       data.ctrl[j]=command[j];
     }
     const liftDelta=goal[3]-command[3];
     command[3]+=clamp(liftDelta,-.12*stepSize,.12*stepSize);
     data.ctrl[3]=command[3];
     mujoco.mj_step(model,data);
     accumulator-=stepSize;steps++;
   }
   const actual=Array.from(data.qpos.slice(0,4));
   return{q:actual,errorRad:Math.max(...target.map((q,j)=>Math.abs(q-actual[j]))),
     referenceErrorRad:Math.max(...target.map((q,j)=>Math.abs(q-command[j]))),
     simulatedSteps:steps};
 }
 return{reset,step,dispose(){data.delete();model.delete()}};
}
