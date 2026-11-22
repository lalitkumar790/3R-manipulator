// Browser-only image -> clean line drawing. This is classical image processing,
// NOT semantic AI understanding. Outputs XY strokes for the shared 3R planner.
// Outline: strong contours; Stencil: softened principal edges; Sketch: fine edges.
export async function interpretImage(file,{mode='outline',detail=50}={}){
 if(!(file instanceof Blob)||!file.type.startsWith('image/'))throw Error('Upload a supported image.');
 if(file.size>8*1024*1024)throw Error('Image must be under 8 MB.');
 if(!['outline','stencil','sketch'].includes(mode))throw Error('Unknown drawing style.');
 const bitmap=await createImageBitmap(file);
 try{
  const maxSide=mode==='sketch'?260:230;
  const factor=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(8,Math.round(bitmap.width*factor)),h=Math.max(8,Math.round(bitmap.height*factor));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data;
  const lum=new Float32Array(w*h);
  for(let i=0;i<lum.length;i++)lum[i]=.2126*rgba[i*4]+.7152*rgba[i*4+1]+.0722*rgba[i*4+2];
  const blur=new Float32Array(lum.length),radius=mode==='sketch'?1:mode==='stencil'?3:2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let sum=0,n=0;
    for(let yy=Math.max(0,y-radius);yy<=Math.min(h-1,y+radius);yy++)
      for(let xx=Math.max(0,x-radius);xx<=Math.min(w-1,x+radius);xx++){sum+=lum[yy*w+xx];n++;}
    blur[y*w+x]=sum/n;
  }
  const gradients=new Float32Array(lum.length),directions=new Uint8Array(lum.length);
  let maxGrad=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;
    const a=blur[i-w-1],b=blur[i-w],c=blur[i-w+1];
    const d=blur[i-1],f=blur[i+1];
    const g=blur[i+w-1],k=blur[i+w],j=blur[i+w+1];
    const gx=-a+c-2*d+2*f-g+j,gy=-a-2*b-c+g+2*k+j;
    const mag=Math.hypot(gx,gy);gradients[i]=mag;maxGrad=Math.max(maxGrad,mag);
    const angle=(Math.atan2(gy,gx)*180/Math.PI+180)%180;
    directions[i]=angle<22.5||angle>=157.5?0:angle<67.5?1:angle<112.5?2:3;
  }
  const thresholds={outline:110,stencil:85,sketch:58};
  const t=thresholds[mode]*(1.45-Number(detail)/100*.85);
  const binary=new Uint8Array(lum.length);
  const offsets=[[1,-1],[w+1,-w-1],[w,-w],[w-1,-w+1]];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x,mag=gradients[i];
    const [p,q]=offsets[directions[i]];
    if(mag>=t&&mag>=gradients[i+p]&&mag>=gradients[i+q])binary[i]=1;
  }
  // Connect to 8-neighbour edge pixels; walk distinct segments without
  // revisiting pixel-to-pixel edges. Split at endpoints/junctions.
  const neighbours=(i)=>{
    const x=i%w,y=Math.floor(i/w),out=[];
    for(let yy=Math.max(1,y-1);yy<=Math.min(h-2,y+1);yy++)
      for(let xx=Math.max(1,x-1);xx<=Math.min(w-2,x+1);xx++){
        const j=yy*w+xx;
        if(j!==i&&binary[j])out.push(j);
      }
    return out;
  };
  const nodes=[],adj=new Map();
  for(let i=0;i<binary.length;i++)if(binary[i]){nodes.push(i);adj.set(i,neighbours(i));}
  const used=new Set(),edgeKey=(i,j)=>i<j?i+':'+j:j+':'+i;
  function walk(from,to){
    const route=[from],start=from;let current=to,prev=from,iterations=0;
    used.add(edgeKey(from,to));
    while(iterations++<w*h){
      route.push(current);
      const choices=(adj.get(current)||[]).filter(j=>j!==prev&&!used.has(edgeKey(current,j)));
      if((adj.get(current)||[]).length!==2||!choices.length)break;
      const next=choices[0];used.add(edgeKey(current,next));
      prev=current;current=next;if(current===start){route.push(current);break;}
    }
    return route;
  }
  let paths=[];
  const terminals=nodes.filter(n=>(adj.get(n)?.length||0)!==2);
  for(const start of [...terminals,...nodes]){
   for(const next of adj.get(start)||[]){
     if(used.has(edgeKey(start,next)))continue;
     const route=walk(start,next);
     if(route.length>=Math.max(6,Math.round(15-Number(detail)*.09)))paths.push(route);
   }
  }
  paths.sort((a,b)=>b.length-a.length);
  // Small fragments are dropped; do not silently merge unrelated face features.
  const limit=mode==='outline'?65:mode==='stencil'?100:135;
  paths=paths.slice(0,limit);
  if(!paths.length)throw Error('No usable edges. Try another style or increase detail.');
  const strokes=paths.map(route=>{
   const skip=Math.max(1,Math.floor(route.length/90));
   const simplified=route.filter((_,j)=>j%skip===0);
   if(simplified.at(-1)!==route.at(-1))simplified.push(route.at(-1));
   return{color:'#1c2638',points:simplified.map(i=>[(i%w)/h,Math.floor(i/w)/h])};
  });
  return{strokes,meta:{
   fileName:file.name||'pasted-photo',mimeType:file.type,sizeBytes:file.size,
   originalWidth:bitmap.width,originalHeight:bitmap.height,tracedWidth:w,tracedHeight:h,
   style:mode,detail,strokeCount:strokes.length,algorithm:'blur-sobel-nms-graph-tracing-v1',
   note:'Line-art edge interpretation, not semantic portrait reconstruction.'
  }};
 }finally{bitmap.close();}
}
