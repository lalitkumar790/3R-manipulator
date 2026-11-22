// Time-parameterized smooth motion for both planning and simulation playback.
// Keeps every stroke boundary / pen-lift transition intact.
// A cubic Hermite spline blends velocity through adjacent points in a stroke,
// using a zero tangent whenever ink mode or stroke ID changes.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function smoothPose(points,index,elapsed){
 const b=points[index],a=points[Math.max(0,index-1)];
 if(!b||!a)throw Error('Missing trajectory waypoint');
 const h=Math.max(.0001,b.dt),u=clamp(elapsed/h,0,1);
 const prev=points[Math.max(0,index-2)],next=points[Math.min(points.length-1,index+1)];
 const same=(p,q)=>p&&q&&p.ink===q.ink&&p.strokeIndex===q.strokeIndex&&p.lift===q.lift;
 // Point q[0..2] in radians. C1 continuity within stroke interior.
 const q=b.q.map((v,j)=>{
  if(!same(a,b))return a.q[j]+(v-a.q[j])*(u*u*(3-2*u));
  const before=same(prev,a)?prev.q[j]:a.q[j];
  const after=same(b,next)?next.q[j]:v;
  const ma=(v-before)*.5,mb=(after-a.q[j])*.5;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u;
  const h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  return h00*a.q[j]+h10*ma+h01*v+h11*mb;
 });
 return {q,lift:a.lift+(b.lift-a.lift)*(u*u*(3-2*u))};
}
export function sampleTimedPlan(points,time){
 if(!points.length)return null;
 let acc=0;
 for(let i=0;i<points.length;i++){
  const duration=Math.max(.0001,points[i].dt);
  if(time<=acc+duration)return{index:i,elapsed:time-acc,...smoothPose(points,i,time-acc)};
  acc+=duration;
 }
 return{index:points.length-1,elapsed:0,q:[...points.at(-1).q],lift:points.at(-1).lift,done:true};
}
