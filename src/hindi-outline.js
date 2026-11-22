// Browser-side Devanagari glyph OUTLINE tracing. This is not a handwriting
// skeletonizer: characters are drawn as contours (including inner counters).
// Canvas text shaping handles matras / conjuncts using the user's installed font
// or Noto Sans Devanagari loaded from the linked stylesheet.
export async function hindiTextToStrokes(text){
 const value=String(text||'').trim();
 if(!value)throw Error('Type Hindi text, for example नमस्ते.');
 if(value.length>22)throw Error('Use a short Hindi phrase (22 code units maximum).');
 if(!/[\u0900-\u097f]/.test(value))throw Error('Use Devanagari text for Hindi mode.');
 await document.fonts.load('110px "Noto Sans Devanagari"',value).catch(()=>{});
 const canvas=document.createElement('canvas');
 const context=canvas.getContext('2d',{willReadFrequently:true});
 canvas.width=960;canvas.height=190;
 const families='"Noto Sans Devanagari","Mangal","Nirmala UI",sans-serif';
 let fontSize=112;
 do{
  context.font=fontSize+'px '+families;
  if(context.measureText(value).width<canvas.width-36)break;
  fontSize-=5;
 }while(fontSize>26);
 context.clearRect(0,0,canvas.width,canvas.height);
 context.fillStyle='#000';context.font=fontSize+'px '+families;
 context.textBaseline='middle';
 context.fillText(value,18,96);
 const w=canvas.width,h=canvas.height,alpha=context.getImageData(0,0,w,h).data;
 const mask=new Uint8Array(w*h);
 let black=0;
 for(let i=0;i<mask.length;i++){
   mask[i]=alpha[4*i+3]>=100?1:0;if(mask[i])black++;
 }
 if(black<30)throw Error('The browser could not render Devanagari. Install Noto Sans Devanagari or use Chrome/Edge.');
 // Boundary edges of each dark pixel. Edges point clockwise, and are joined
 // into polylines using integer grid vertices.
 const outgoing=new Map();
 const key=(x,y)=>x+','+y;
 let edges=0;
 function edge(x1,y1,x2,y2){
  const a=key(x1,y1);
  let dest=outgoing.get(a);
  if(!dest){dest=[];outgoing.set(a,dest);}
  dest.push([x2,y2]);edges++;
 }
 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   if(!mask[y*w+x])continue;
   if(y===0||!mask[(y-1)*w+x])edge(x,y,x+1,y);
   if(x===w-1||!mask[y*w+x+1])edge(x+1,y,x+1,y+1);
   if(y===h-1||!mask[(y+1)*w+x])edge(x+1,y+1,x,y+1);
   if(x===0||!mask[y*w+x-1])edge(x,y+1,x,y);
  }
 }
 if(edges>30000)throw Error('Hindi text is too detailed; use a shorter phrase.');
 const loops=[];
 for(const [start,targets] of outgoing){
  while(targets.length){
   const [sx,sy]=start.split(',').map(Number);
   let path=[[sx,sy]],x=sx,y=sy;
   let budget=edges+1;
   while(budget-->0){
    const destinations=outgoing.get(key(x,y));
    if(!destinations?.length)break;
    const next=destinations.pop();
    x=next[0];y=next[1];
    path.push([x,y]);
    if(x===sx&&y===sy)break;
   }
   if(path.length>=9){
    // Pixel coordinates converted to height-relative units, matching draw pad.
    // Retain closing point; the generic planner handles fitting and simplification.
    const step=Math.max(1,Math.floor(path.length/550));
    const sample=path.filter((_,i)=>i%step===0);
    sample.push(path[path.length-1]);
    if(sample.length>=3)loops.push(sample.map(p=>[p[0]/h,p[1]/h]));
   }
  }
 }
 if(loops.length>150)throw Error('Hindi glyph produced too many outlines; use fewer characters.');
 if(!loops.length)throw Error('No drawable Hindi outline was produced.');
 return loops;
}
