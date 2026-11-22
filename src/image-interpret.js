// Browser-only image interpretation for pen plotters.
// Multi-scale luminance gradient + nonmax suppression + hysteresis,
// followed by continuation-aware graph tracing. It extracts *visible*
// detail, not semantics (face/eyes/hair AI parsing).
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function blur(src,w,h,r){
 if(!r)return Float32Array.from(src);
 const temp=new Float32Array(src.length),out=new Float32Array(src.length);
 const window=2*r+1;
 for(let y=0;y<h;y++){
  let sum=0;
  for(let k=-r;k<=r;k++)sum+=src[y*w+clamp(k,0,w-1)];
  for(let x=0;x<w;x++){
   temp[y*w+x]=sum/window;
   sum+=src[y*w+clamp(x+r+1,0,w-1)]-src[y*w+clamp(x-r,0,w-1)];
  }
 }
 for(let x=0;x<w;x++){
  let sum=0;
  for(let k=-r;k<=r;k++)sum+=temp[clamp(k,0,h-1)*w+x];
  for(let y=0;y<h;y++){
   out[y*w+x]=sum/window;
   sum+=temp[clamp(y+r+1,0,h-1)*w+x]-temp[clamp(y-r,0,h-1)*w+x];
  }
 }
 return out;
}
// Recover gently shaded facial/illustration detail before gradient extraction.
// Local variance makes faint features visible without indiscriminately
// sharpening already noisy / high-contrast areas.
export function enhanceLocalContrast(luma,w,h,amount=.52){
 const baseline=blur(luma,w,h,11);
 const sq=new Float32Array(luma.length);
 for(let i=0;i<luma.length;i++){
  const d=luma[i]-baseline[i];sq[i]=d*d;
 }
 const variance=blur(sq,w,h,9),result=new Float32Array(luma.length);
 for(let i=0;i<luma.length;i++){
  const localSigma=Math.sqrt(variance[i]);
  const gain=clamp(42/(localSigma+11),.9,2.3);
  const enhanced=clamp(baseline[i]+(luma[i]-baseline[i])*gain,0,255);
  result[i]=luma[i]*(1-amount)+enhanced*amount;
 }
 return result;
}
function gradient(src,w,h){
 const magnitude=new Float32Array(w*h),directions=new Uint8Array(w*h);
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,a=src[i-w-1],b=src[i-w],c=src[i-w+1],d=src[i-1],e=src[i+1],f=src[i+w-1],g=src[i+w],k=src[i+w+1];
  const gx=-a+c-2*d+2*e-f+k,gy=-a-2*b-c+f+2*g+k;
  magnitude[i]=Math.hypot(gx,gy);
  const angle=(Math.atan2(gy,gx)*180/Math.PI+180)%180;
  directions[i]=angle<22.5||angle>=157.5?0:angle<67.5?1:angle<112.5?2:3;
 }
 return{magnitude,directions};
}
function thinEdges(g,w,h){
 const out=new Float32Array(w*h);
 const o=[[1,-1],[w+1,-w-1],[w,-w],[w-1,-w+1]];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x,mag=g.magnitude[i],[p,q]=o[g.directions[i]];
  if(mag>=g.magnitude[i+p]&&mag>=g.magnitude[i+q])out[i]=mag;
 }
 return out;
}
function connectStrongWeak(strength,w,h,high,low){
 const selected=new Uint8Array(w*h),stack=[];
 for(let i=0;i<strength.length;i++)if(strength[i]>=high){selected[i]=1;stack.push(i)}
 while(stack.length){
  const i=stack.pop(),x=i%w,y=Math.floor(i/w);
  for(let yy=Math.max(1,y-1);yy<=Math.min(h-2,y+1);yy++)
   for(let xx=Math.max(1,x-1);xx<=Math.min(w-2,x+1);xx++){
    const j=yy*w+xx;
    if(!selected[j]&&strength[j]>=low){selected[j]=1;stack.push(j)}
   }
 }
 return selected;
}
function connectStrongWeakAdaptive(strength,w,h,high,localHigh,grid,nx){
 const selected=new Uint8Array(w*h),stack=[];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  const i=y*w+x;
  const limit=localHigh[Math.floor(y/grid)*nx+Math.floor(x/grid)]||high;
  if(strength[i]>=limit){selected[i]=1;stack.push(i)}
 }
 while(stack.length){
  const i=stack.pop(),x=i%w,y=Math.floor(i/w);
  for(let yy=Math.max(1,y-1);yy<=Math.min(h-2,y+1);yy++)
   for(let xx=Math.max(1,x-1);xx<=Math.min(w-2,x+1);xx++){
    const j=yy*w+xx,lim=localHigh[Math.floor(yy/grid)*nx+Math.floor(xx/grid)]||high;
    if(!selected[j]&&strength[j]>=Math.max(5,lim*.36)){selected[j]=1;stack.push(j)}
   }
 }
 return selected;
}
function tracePixelGraph(mask,w,h,minLength){
 const adjacency=new Map(),nodes=[];
 // Prefer orthogonal contact when diagonal adjacency would shortcut a corner.
 const delta=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
 for(let i=0;i<mask.length;i++)if(mask[i]){
  const x=i%w,y=Math.floor(i/w),neighbours=[];
  for(const [dx,dy] of delta){
   const xx=x+dx,yy=y+dy;
   if(xx<=0||xx>=w-1||yy<=0||yy>=h-1)continue;
   if(Math.abs(dx)&&Math.abs(dy)&&mask[y*w+xx]&&mask[yy*w+x])continue;
   const j=yy*w+xx;if(mask[j])neighbours.push(j);
  }
  adjacency.set(i,neighbours);nodes.push(i);
 }
 const used=new Set();
 const edge=(a,b)=>a<b?a*w*h+b:b*w*h+a;
 const walk=(start,next)=>{
  const line=[start],first=start;let prev=start,current=next,safety=0;
  used.add(edge(prev,current));
  while(safety++<w*h){
   line.push(current);
   const choices=(adjacency.get(current)||[]).filter(n=>n!==prev&&!used.has(edge(current,n)));
   if(!choices.length)break;
   // Continue in the same direction through crossings rather than fragmenting
   // every line at the intersection.
   const cx=current%w,cy=Math.floor(current/w),px=prev%w,py=Math.floor(prev/w);
   const vx=cx-px,vy=cy-py;
   choices.sort((a,b)=>{
    const ax=a%w-cx,ay=Math.floor(a/w)-cy;
    const bx=b%w-cx,by=Math.floor(b/w)-cy;
    return(vx*bx+vy*by)/Math.hypot(bx,by)-(vx*ax+vy*ay)/Math.hypot(ax,ay);
   });
   const following=choices[0];
   used.add(edge(current,following));prev=current;current=following;
   if(current===first){line.push(current);break}
  }
  return line;
 };
 const output=[];
 const terminals=nodes.filter(i=>(adjacency.get(i)||[]).length<=1);
 for(const n of terminals.concat(nodes))for(const m of adjacency.get(n)||[]){
  if(used.has(edge(n,m)))continue;
  const route=walk(n,m);
  if(route.length>=minLength)output.push(route);
 }
 return output;
}
function simplify(points,tolerance){
 if(points.length<=2)return points;
 const keep=new Uint8Array(points.length);keep[0]=1;keep[points.length-1]=1;
 const stack=[[0,points.length-1]];
 while(stack.length){
  const [start,end]=stack.pop(),a=points[start],b=points[end];
  const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  let max=0,index=-1;
  for(let i=start+1;i<end;i++){
   const p=points[i],t=len?clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len,0,1):0;
   const d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
   if(d>max){max=d;index=i}
  }
  if(max>tolerance&&index>0){keep[index]=1;stack.push([start,index],[index,end])}
 }
 return points.filter((p,i)=>keep[i]);
}
export function traceLuma(luma,w,h,{mode='outline',detail=50}={}){
 if(!['outline','stencil','sketch'].includes(mode))throw Error('Unknown line-art style.');
 const intensity=clamp(Number(detail),10,90);
 const radius=mode==='stencil'?3:mode==='sketch'?1:2;
 const enhanced=enhanceLocalContrast(luma,w,h,mode==='stencil'?.30:mode==='sketch'?.75:.52);
 const fine=thinEdges(gradient(blur(enhanced,w,h,radius),w,h),w,h);
 const coarse=thinEdges(gradient(blur(luma,w,h,radius+2),w,h),w,h);
 const strength=new Float32Array(luma.length);
 // Preserve major structures and locally strong fine details. The old tracer
 // sorted by line length and discarded shorter facial contours outright.
 let max=0;
 for(let i=0;i<strength.length;i++){
  strength[i]=Math.max(fine[i]*(mode==='sketch'?1:.83),coarse[i]*(mode==='stencil'?1.15:1));
  max=Math.max(max,strength[i]);
 }
 if(max<=0)return[];
 const positive=Array.from(strength).filter(x=>x>1).sort((a,b)=>a-b);
 if(!positive.length)return[];
 const percentile=positive[Math.floor(positive.length*(mode==='sketch'?.58:mode==='stencil'?.78:.70))];
 const high=Math.max(15,Math.min(max*.68,percentile)*(1.38-intensity*.007));
 // A single global threshold discarded small, soft features when an image
 // also contained very dark lines. Allow regionally meaningful edges to seed
 // hysteresis, with a floor that suppresses blank-area sensor noise.
 const grid=36,nx=Math.ceil(w/grid),ny=Math.ceil(h/grid);
 const localHigh=new Float32Array(nx*ny).fill(high);
 for(let gy=0;gy<ny;gy++)for(let gx=0;gx<nx;gx++){
  const values=[];
  for(let y=gy*grid;y<Math.min(h,(gy+1)*grid);y++)
   for(let x=gx*grid;x<Math.min(w,(gx+1)*grid);x++){
    const v=strength[y*w+x];if(v>8)values.push(v);
   }
  if(values.length>=12){
   values.sort((a,b)=>a-b);
   const reference=values[Math.floor(values.length*(mode==='sketch'?.64:.77))];
   localHigh[gy*nx+gx]=Math.max(13,Math.min(high,reference*(mode==='stencil'?.85:.72)));
  }
 }
 const binary=connectStrongWeakAdaptive(strength,w,h,high,localHigh,grid,nx);
 const minLength=Math.round(mode==='stencil'?9:mode==='sketch'?4:6);
 const paths=tracePixelGraph(binary,w,h,minLength);
 const epsilon=mode==='stencil'?.85:mode==='sketch'?.33:.55;
 const candidate=paths.map(route=>{
  const p=route.map(i=>[i%w,Math.floor(i/w)]);
  return simplify(p,epsilon);
 }).filter(p=>p.length>=2);
 // Budget on geometric complexity rather than a fixed number of longest lines.
 // Prefer coherent contours while retaining fine internal structures.
 const length=x=>x.reduce((v,p,i)=>i?v+Math.hypot(p[0]-x[i-1][0],p[1]-x[i-1][1]):v,0);
 candidate.sort((a,b)=>length(b)-length(a));
 const maxStrokes=mode==='sketch'?130:mode==='stencil'?100:115;
 const maxPoints=mode==='sketch'?11000:9000;
 const selected=[],picked=new Set();
 let used=0;
 function accept(i){
  const p=candidate[i];
  if(picked.has(i)||selected.length>=maxStrokes||used+p.length>maxPoints)return false;
  picked.add(i);selected.push(p);used+=p.length;return true;
 }
 // Reserve a share of the stroke budget for shorter, recognizable detail
 // throughout the drawing. Avoid removing an eye because a hair contour is longer.
 const reserved=Math.floor(maxStrokes*.30),quota=new Uint8Array(25);
 const shortCandidates=candidate.map((p,i)=>({p,i,len:length(p)}))
  .filter(x=>x.len>=4&&x.len<100).sort((a,b)=>b.len-a.len);
 for(const {p,i} of shortCandidates){
  if(selected.length>=reserved)break;
  const center=p[Math.floor(p.length/2)],tx=clamp(Math.floor(center[0]/w*5),0,4),ty=clamp(Math.floor(center[1]/h*5),0,4),cell=ty*5+tx;
  if(quota[cell]>=Math.max(2,Math.ceil(reserved/9)))continue;
  if(accept(i))quota[cell]++;
 }
 for(let i=0;i<candidate.length;i++)accept(i);
 // Return in source/topological tracing order to avoid needless pen travel.
 selected.sort((a,b)=>a[0][1]-b[0][1]||a[0][0]-b[0][0]);
 return selected.map(p=>p.map(([x,y])=>[x/h,y/h]));
}
export async function interpretImage(file,{mode='outline',detail=50}={}){
 if(!(file instanceof Blob)||!file.type.startsWith('image/'))throw Error('Upload a supported image.');
 if(file.size>8*1024*1024)throw Error('Image must be under 8 MB.');
 const bmp=await createImageBitmap(file);
 try{
  const maxSide=mode==='sketch'?430:mode==='stencil'?340:380;
  const factor=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
  const w=Math.max(8,Math.round(bmp.width*factor)),h=Math.max(8,Math.round(bmp.height*factor));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data,luma=new Float32Array(w*h);
  for(let i=0;i<luma.length;i++){
   const alpha=rgba[i*4+3]/255;
   luma[i]=alpha*(.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2])+(1-alpha)*255;
  }
  const paths=traceLuma(luma,w,h,{mode,detail});
  if(!paths.length)throw Error('No meaningful contours detected. Try a brighter image or increase detail.');
  const strokes=paths.map(points=>({points,color:'#1c2638'}));
  return{strokes,meta:{fileName:file.name||'pasted-photo',mimeType:file.type,sizeBytes:file.size,
   originalWidth:bmp.width,originalHeight:bmp.height,tracedWidth:w,tracedHeight:h,
   style:mode,detail,strokeCount:strokes.length,sourcePoints:strokes.reduce((s,x)=>s+x.points.length,0),
   algorithm:'local-contrast-multiscale-adaptive-hysteresis-detail-v3',
   note:'Classical edge line art; not semantic portrait reconstruction.'}};
 }finally{bmp.close()}
}
