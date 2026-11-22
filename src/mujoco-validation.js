// Optional in-browser MuJoCo replay with a real torque-limited MJCF model.
// Uses modeled joint positions (qpos), NEVER fabricated measured hardware data.
// Each run starts from the same reset and repositions the pen above the paper.
import {bufferSegments} from './buffered-motion.js';
import {exampleDrawing} from './trajectory-benchmark.js';
import {forward} from './writing.js';
const STEP_RAD=2*Math.PI/4096;
const waitFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
async function experiment(physics,points,torqueAware){
 physics.reset();
 const q0=points[0].q;
 let obs=null,initialError=Infinity;
 for(let i=0;i<2400;i++){
  obs=physics.step(q0,.012,.01);
  initialError=distance(forward(obs.q),forward(q0));
  if(initialError<.0015&&obs.q[3]>.009)break;
  if(i%120===0)await waitFrame();
 }
 if(initialError>=.0015)return{ok:false,reason:'Motor model could not position at pen-up start; error '+(initialError*1000).toFixed(2)+' mm'};
 const segments=bufferSegments(points,{maxHalfStepsPerSecond:100,adaptive:torqueAware,torqueAware}).filter(x=>x.ink);
 let current=points[0].q.map(v=>Math.round(v/STEP_RAD)),sum=0,max=0,n=0,elapsed=0;
 let saturation=0;
 const trajectory=[],reference=[];
 for(const segment of segments){
  const start=[...current],target=segment.q;
  const ticks=Math.max(1,Math.ceil(segment.ms/20));
  for(let tick=1;tick<=ticks;tick++){
   const u=tick/ticks,e=u*u*(3-2*u);
   const desired=start.map((v,j)=>(v+(target[j]-v)*e)*STEP_RAD);
   obs=physics.step(desired,0,segment.ms/1000/ticks);
   const actualXY=forward(obs.q),desiredXY=forward(desired);
   const error=distance(actualXY,desiredXY);
   sum+=error*error;max=Math.max(max,error);n++;elapsed+=segment.ms/1000/ticks;
   if(error>.003)saturation++;
   if(tick%3===0||tick===ticks){trajectory.push(actualXY);reference.push(desiredXY)}
   if(n%150===0)await waitFrame();
  }
  current=target;
 }
 return{ok:true,rmsMm:1000*Math.sqrt(sum/Math.max(1,n)),maxMm:max*1000,
   percentAbove3mm:saturation/Math.max(1,n)*100,durationS:elapsed,
   trajectory,reference,warning:'MuJoCo estimated qpos only. Torque-speed curve, gear backlash and physical pen contact are not calibrated.'};
}
export async function validateCircleMuJoCo(){
 const {startPhysics}=await import('./mujoco-physics.js');
 const p=exampleDrawing('circle').points;
 const simulator=await startPhysics();
 try{
  const fixed=await experiment(simulator,p,false);
  const torque=await experiment(simulator,p,true);
  return{fixed,torque};
 }finally{simulator.dispose()}
}
export function drawMuJoCoValidation(canvas,report){
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
 ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);
 const all=[...(report.fixed.trajectory||[]),...(report.torque.trajectory||[]),...(report.fixed.reference||[])];
 if(!all.length)return;
 const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
 const xMin=Math.min(...xs),xMax=Math.max(...xs),yMin=Math.min(...ys),yMax=Math.max(...ys);
 const scale=Math.min((W-60)/Math.max(.001,xMax-xMin),(H-55)/Math.max(.001,yMax-yMin));
 const coord=([x,y])=>[(W-(xMax-xMin)*scale)/2+(x-xMin)*scale,H-25-(H-(yMax-yMin)*scale)/2-(y-yMin)*scale];
 const line=(points,color,width,dash=false)=>{
  if(points.length<2)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash?[4,5]:[]);
  ctx.beginPath();ctx.moveTo(...coord(points[0]));for(let i=1;i<points.length;i++)ctx.lineTo(...coord(points[i]));ctx.stroke();ctx.setLineDash([]);
 };
 line(report.fixed.reference||[],'#334155',1.5,true);
 line(report.fixed.trajectory||[],'#18866c',2);
 line(report.torque.trajectory||[],'#9847bb',2);
 ctx.font='12px system-ui';ctx.fillStyle='#334155';ctx.fillText('Dashed: target    Green: fixed MuJoCo    Purple: torque-aware MuJoCo',12,H-7);
}
