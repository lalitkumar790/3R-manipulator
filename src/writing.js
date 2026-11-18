// Stroke font and inverse-kinematics writing planner. Coordinates in meters.
// Font paths are local [x,y] points in a 5x7 glyph box. Pen lift is a separate
// prismatic degree of freedom; it does not change the three arm revolute joints.
export const A=.120,B=.100,TOOL=.060,BOARD_Z=0.001;
const FONT={
A:['0,0 2.5,7 5,0','1,3 4,3'],B:['0,0 0,7 3,7 5,6 5,4.5 3,3.5 0,3.5','3,3.5 5,2 5,.8 3,0 0,0'],
C:['5,7 1,7 0,6 0,1 1,0 5,0'],D:['0,0 0,7 3,7 5,5 5,2 3,0 0,0'],
E:['5,7 0,7 0,0 5,0','0,3.5 4,3.5'],F:['0,0 0,7 5,7','0,3.5 4,3.5'],
G:['5,6 4,7 1,7 0,6 0,1 1,0 5,0 5,3.5 3,3.5'],H:['0,0 0,7','5,0 5,7','0,3.5 5,3.5'],
I:['0,7 5,7','2.5,7 2.5,0','0,0 5,0'],J:['0,1 1,0 4,0 5,2 5,7'],K:['0,0 0,7','5,7 0,3.5 5,0'],
L:['0,7 0,0 5,0'],M:['0,0 0,7 2.5,4 5,7 5,0'],N:['0,0 0,7 5,0 5,7'],
O:['1,0 0,1 0,6 1,7 4,7 5,6 5,1 4,0 1,0'],P:['0,0 0,7 4,7 5,6 5,4 4,3 0,3'],
Q:['1,0 0,1 0,6 1,7 4,7 5,6 5,1 4,0 1,0','3,2 5.5,-.8'],
R:['0,0 0,7 4,7 5,6 5,4 4,3 0,3','3,3 5,0'],S:['5,6 4,7 1,7 0,6 0,4.5 5,2.5 5,1 4,0 1,0 0,1'],
T:['0,7 5,7','2.5,7 2.5,0'],U:['0,7 0,1 1,0 4,0 5,1 5,7'],V:['0,7 2.5,0 5,7'],
W:['0,7 1,0 2.5,4 4,0 5,7'],X:['0,7 5,0','0,0 5,7'],Y:['0,7 2.5,3.5 5,7','2.5,3.5 2.5,0'],
Z:['0,7 5,7 0,0 5,0'],0:['1,0 0,1 0,6 1,7 4,7 5,6 5,1 4,0 1,0'],
1:['1,5 3,7 3,0','1,0 5,0'],2:['0,6 1,7 4,7 5,6 5,4.5 0,0 5,0'],
3:['0,7 5,7 3,3.5 5,3.5 5,1 4,0 0,0'],4:['4,0 4,7 0,2 5,2'],
5:['5,7 0,7 0,4 4,4 5,3 5,1 4,0 0,0'],
6:['5,7 1,7 0,5 0,1 1,0 4,0 5,1 5,3 4,4 0,4'],
7:['0,7 5,7 2,0'],8:['1,0 0,1 0,2.7 2.5,3.5 5,4.5 5,6 4,7 1,7 0,6 0,4.5 2.5,3.5 5,2.7 5,1 4,0 1,0'],
9:['5,3 1,3 0,4 0,6 1,7 4,7 5,6 5,1 4,0 0,0'],
'.':['2,0 2.5,0'], '-':['0,3.5 5,3.5'], '!':['2.5,7 2.5,2','2.5,0 2.5,.4'],'?':['0,6 1,7 4,7 5,6 5,4 2.5,3 2.5,2','2.5,0 2.5,.4']
};
export function inverse(x,y,heading=0,branch=1){
 const wx=x-TOOL*Math.cos(heading),wy=y-TOOL*Math.sin(heading);
 const c=(wx*wx+wy*wy-A*A-B*B)/(2*A*B);
 if(Math.abs(c)>1+1e-8)return null;
 const q2=branch*Math.acos(Math.max(-1,Math.min(1,c)));
 const q1=Math.atan2(wy,wx)-Math.atan2(B*Math.sin(q2),A+B*Math.cos(q2));
 const q3=heading-q1-q2;
 if([q1,q2,q3].some(q=>Math.abs(q)>Math.PI))return null;
 return[q1,q2,q3];
}
export function forward(q){const a=q[0],b=a+q[1],c=b+q[2];return[A*Math.cos(a)+B*Math.cos(b)+TOOL*Math.cos(c),A*Math.sin(a)+B*Math.sin(b)+TOOL*Math.sin(c)];}
const parse=s=>s.split(' ').map(p=>p.split(',').map(Number));
export function planWriting(input,speed=.015){
 const cleaned=input.toUpperCase().replace(/[^A-Z0-9 .!?-]/g,'').trim();
 if(!cleaned)throw Error('Enter letters or numbers to write.');
 const rows=[];for(let i=0;i<cleaned.length;i+=11)rows.push(cleaned.slice(i,i+11));
 if(rows.length>3)throw Error('Please use at most 33 characters.');
 const glyphWidth=.0060,letterStep=.009, lineStep=.028;
 const maxWidth=Math.max(...rows.map(r=>r.length))*letterStep;
 const scale=Math.min(1,.098/Math.max(maxWidth,.001));
 const points=[], strokes=[];
 rows.forEach((line,row)=>{
   const width=line.length*letterStep*scale;const left=.154-width/2,midy=.043+(rows.length-1)*lineStep*scale/2-row*lineStep*scale;
   [...line].forEach((char,k)=>{
     const paths=FONT[char]||[];paths.forEach(path=>{
       const pts=parse(path).map(([px,py])=>[left+k*letterStep*scale+(px/5)*glyphWidth*scale,midy+((py-3.5)/7)*.022*scale]);
       if(pts.length)strokes.push(pts);
     });
   });
 });
 if(!strokes.length)throw Error('No drawable characters found.');
 let last=null,total=0;
 const add=(x,y,lift,ink,dt)=>{const q=inverse(x,y,0,1);if(!q)throw Error('The requested writing trajectory exits the arm workspace.');points.push({x,y,lift,ink,q,dt});total+=dt};
 const movement=(to,lift,ink)=>{if(!last){last=to;add(to[0],to[1],lift,false,.02);return}const d=Math.hypot(last[0]-to[0],last[1]-to[1]);const dur=Math.max(.025,d/(ink?speed:Math.max(speed*2.5,.04)));const n=Math.max(1,Math.ceil(d/.0015));for(let i=1;i<=n;i++){const t=i/n;add(last[0]+(to[0]-last[0])*t,last[1]+(to[1]-last[1])*t,lift,ink,dur/n)}last=to};
 for(const stroke of strokes){
   movement(stroke[0],.012,false);
   add(stroke[0][0],stroke[0][1],0,false,.25);
   for(let i=1;i<stroke.length;i++)movement(stroke[i],0,true);
   add(last[0],last[1],.012,false,.22);
 }
 return{points,text:cleaned,estimatedDuration:total,strokes:strokes.length};
}
