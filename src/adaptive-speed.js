// Feedforward, curvature- and joint-demand-aware speed limits for a pen plotter.
// NO encoder/torque feedback. The output is a planned step-rate budget, not
// an observed physical motor speed.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const EPS=1e-8;
function norm(v){return Math.hypot(v[0],v[1]);}
export function adaptiveStepRates(points,{maxRate=100,minRate=30,cornerSeverity=.75,cartesianAccel=.055,stepAccel=1200}={}){
 if(!Array.isArray(points)||!points.length)throw Error('Missing writing path.');
 if(!(maxRate>=20&&maxRate<=120&&minRate>=10&&minRate<=maxRate))throw Error('Invalid step-rate limits.');
 const k=4096/(2*Math.PI);
 const rates=new Array(points.length).fill(maxRate);
 const signals=new Array(points.length).fill(null);
 for(let i=1;i<points.length;i++){
  const p=points[i],prev=points[i-1];
  if(!p?.q?.every(Number.isFinite)||!prev?.q?.every(Number.isFinite)||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Invalid path point');
  if(!p.ink||!prev.ink||p.strokeIndex!==prev.strokeIndex||p.lift!==prev.lift)continue;
  const dx=p.x-prev.x,dy=p.y-prev.y,len=Math.hypot(dx,dy);
  const maxSteps=Math.max(...p.q.map((v,j)=>Math.abs(v-prev.q[j])*k));
  let angle=0;
  const next=points[i+1];
  if(next?.ink&&next.strokeIndex===p.strokeIndex&&next.lift===p.lift){
   const v=[dx,dy],u=[next.x-p.x,next.y-p.y];
   const vLen=norm(v),uLen=norm(u);
   if(vLen>EPS&&uLen>EPS){
    const cos=clamp((v[0]*u[0]+v[1]*u[1])/(vLen*uLen),-1,1);
    angle=Math.acos(cos);
    const sinHalf=Math.max(.0001,Math.sin(angle/2));
    const radius=Math.min(vLen,uLen)/(2*sinHalf);
    const vCorner=Math.sqrt(cartesianAccel*radius);
    const jointSensitivity=maxSteps/Math.max(EPS,len);
    const curvatureRate=vCorner*jointSensitivity;
    rates[i]=clamp(Math.min(maxRate*(1-cornerSeverity*angle/Math.PI),curvatureRate),minRate,maxRate);
   }
  }
  signals[i]={turnRadians:angle,segmentLengthM:len,jointHalfSteps:maxSteps};
 }
 // Slow an approach into a corner as well as the departure, preventing a
 // single fast segment from running directly into a low-speed turn.
 for(let i=points.length-2;i>=1;i--){
  if(!signals[i]||!signals[i+1]||points[i].strokeIndex!==points[i+1].strokeIndex)continue;
  rates[i]=Math.min(rates[i],Math.sqrt(rates[i+1]**2+2*stepAccel*Math.max(1,signals[i].jointHalfSteps)));
 }
 // Bounded recovery after the corner: speed may increase only as the motor
 // progresses through enough angular distance to accelerate.
 for(let i=2;i<points.length;i++){
  if(!signals[i]||!signals[i-1]||points[i].strokeIndex!==points[i-1].strokeIndex)continue;
  rates[i]=Math.min(rates[i],Math.sqrt(rates[i-1]**2+2*stepAccel*Math.max(1,signals[i].jointHalfSteps)));
 }
 // Limit discrete rate jumps for very short, noisy strokes.
 for(let i=2;i<points.length;i++){
  if(!signals[i]||!signals[i-1]||points[i].strokeIndex!==points[i-1].strokeIndex)continue;
  rates[i]=Math.min(rates[i],rates[i-1]+18);
 }
 for(let i=points.length-2;i>=1;i--){
  if(!signals[i]||!signals[i+1]||points[i].strokeIndex!==points[i+1].strokeIndex)continue;
  rates[i]=Math.min(rates[i],rates[i+1]+18);
 }
 return rates.map((rate,i)=>({
  rate:Math.round(clamp(rate,minRate,maxRate)*10)/10,
  turnRadians:signals[i]?.turnRadians||0,
  jointHalfSteps:signals[i]?.jointHalfSteps||0
 }));
}
