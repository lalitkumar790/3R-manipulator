// Unified drawing planner for user scribbles and font outlines.
// Input strokes contain local 2D drawing coordinates [x,y] with Y downward.
// The planner preserves aspect ratio, fits the existing paper, and uses the
// same 3R inverse kinematics and virtual pen-lift model as Latin writing.
import {inverse,forward} from './writing.js';
const WIDTH=.092,HEIGHT=.060,CENTER_X=.155,CENTER_Y=.043;
const MAX_STROKES=150,MAX_SOURCE_POINTS=18000,MAX_OUTPUT_POINTS=7500;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function rdp(points,epsilon) {
 if(points.length<=2)return points;
 let best=0,idx=0;
 const a=points[0],b=points[points.length-1],dx=b[0]-a[0],dy=b[1]-a[1],mag=dx*dx+dy*dy;
 for(let i=1;i<points.length-1;i++){
  const t=mag===0?0:Math.max(0,Math.min(1,((points[i][0]-a[0])*dx+(points[i][1]-a[1])*dy)/mag));
  const d=Math.hypot(points[i][0]-a[0]-t*dx,points[i][1]-a[1]-t*dy);
  if(d>best){best=d;idx=i;}
 }
 if(best<=epsilon)return[a,b];
 const left=rdp(points.slice(0,idx+1),epsilon);
 return left.slice(0,-1).concat(rdp(points.slice(idx),epsilon));
}
export function prepareStrokes(strokes){
 if(!Array.isArray(strokes)||!strokes.length||strokes.length>MAX_STROKES)
  throw Error('Draw 1–150 strokes.');
 let count=0;
 const clean=[];
 for(const stroke of strokes){
  if(!Array.isArray(stroke)||stroke.length<2)continue;
  const points=[];
  for(const p of stroke){
   if(!Array.isArray(p)||p.length!==2||!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10))
    throw Error('Invalid drawing coordinate.');
   count++;if(count>MAX_SOURCE_POINTS)throw Error('Drawing is too detailed; simplify or erase some strokes.');
   if(!points.length||dist(points[points.length-1],p)>0.00012)points.push([p[0],p[1]]);
  }
  if(points.length>=2){
   const simplified=rdp(points,.0012);
   if(simplified.length>=2)clean.push(simplified);
  }
 }
 if(!clean.length)throw Error('Draw at least one continuous stroke.');
 const all=clean.flat();
 const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0]));
 const minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
 const dx=Math.max(maxX-minX,.001),dy=Math.max(maxY-minY,.001);
 const scale=Math.min(WIDTH/dx,HEIGHT/dy);
 const centerSourceX=(minX+maxX)/2,centerSourceY=(minY+maxY)/2;
 // Y is inverted to go from canvas pixels (down) to robot coordinates (up).
 return clean.map(stroke=>stroke.map(([x,y])=>
  [CENTER_X+(x-centerSourceX)*scale,CENTER_Y-(y-centerSourceY)*scale]));
}
export function planStrokes(strokes,speed=.012,colors=[]){
 if(!Number.isFinite(speed)||speed<.003||speed>.045)throw Error('Writing speed out of range.');
 const prepared=prepareStrokes(strokes);
 const points=[];
 let last=null,total=0,currentColor='#1c2638',currentStroke=0;
 function append(x,y,lift,ink,dt){
  const q=inverse(x,y,0,1);
  if(!q||q.some(a=>!Number.isFinite(a)))throw Error('A point is outside the 3R workspace.');
  const [fx,fy]=forward(q);
  if(Math.hypot(fx-x,fy-y)>.0001)throw Error('IK check failed.');
  if(points.length>=MAX_OUTPUT_POINTS)throw Error('Drawing exceeds 7500 robot waypoints. Draw fewer or larger strokes.');
  const step={x,y,lift,ink,q,dt:Math.max(.006,dt),color:currentColor,strokeIndex:currentStroke};
  points.push(step);total+=step.dt;
 }
 function travel(to,lift,ink){
  if(!last){last=to;append(to[0],to[1],lift,false,.02);return;}
  const from=last,di=dist(from,to);
  const duration=Math.max(.02,di/(ink?speed:Math.max(speed*2.5,.035)));
  const n=Math.max(1,Math.ceil(di/.0015));
  for(let i=1;i<=n;i++){
   const u=i/n;
   append(from[0]+u*(to[0]-from[0]),from[1]+u*(to[1]-from[1]),lift,ink,duration/n);
  }
  last=to;
 }
 for(const stroke of prepared){
  travel(stroke[0],.012,false);
  append(stroke[0][0],stroke[0][1],0,false,.22);
  for(let i=1;i<stroke.length;i++)travel(stroke[i],0,true);
  append(last[0],last[1],.012,false,.20);
 }
 return {points,estimatedDuration:total,strokes:prepared.length,text:'CUSTOM PATH'};
}
