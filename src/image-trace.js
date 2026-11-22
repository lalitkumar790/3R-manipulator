// Browser-only raster-to-plotter contour tracer. Each dark color region produces
// OUTLINE paths (not photorealistic fills). Images never leave the user's browser.
// Returns strokes with {points:[[x,y],...], color} in drawing-pad coordinate units.
export const PEN_COLORS=[
 {name:'Black',hex:'#1c2638',rgb:[28,38,56]},
 {name:'Blue',hex:'#2563eb',rgb:[37,99,235]},
 {name:'Red',hex:'#dc3545',rgb:[220,53,69]},
 {name:'Green',hex:'#169b62',rgb:[22,155,98]},
 {name:'Orange',hex:'#e88c2b',rgb:[232,140,43]}
];
const inColor=(color,r,g,b)=>Math.hypot(r-color.rgb[0],g-color.rgb[1],b-color.rgb[2]);
const isWhite=(r,g,b)=>Math.min(r,g,b)>228;
function traceMask(mask,width,height,minLen=10){
 const adj=new Map();
 const key=(x,y)=>y*(width+1)+x;
 const line=(x1,y1,x2,y2)=>{
  const k=key(x1,y1);let a=adj.get(k);if(!a){a=[];adj.set(k,a)}a.push([x2,y2]);
 };
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(!mask[y*width+x])continue;
  if(!y||!mask[(y-1)*width+x])line(x,y,x+1,y);
  if(x===width-1||!mask[y*width+x+1])line(x+1,y,x+1,y+1);
  if(y===height-1||!mask[(y+1)*width+x])line(x+1,y+1,x,y+1);
  if(!x||!mask[y*width+x-1])line(x,y+1,x,y);
 }
 const loops=[];
 for(const [start,targets] of adj){
  while(targets.length){
   let xy=[start%(width+1),Math.floor(start/(width+1))];
   const first=xy,route=[xy];let budget=width*height*4;
   while(budget-->0){
    const nexts=adj.get(key(...xy));if(!nexts?.length)break;
    xy=nexts.pop();route.push(xy);
    if(xy[0]===first[0]&&xy[1]===first[1])break;
   }
   if(route.length<minLen)continue;
   // Sample and simplify jagged raster boundaries. Keep closed outlines closed.
   const skip=Math.max(1,Math.floor(route.length/180));
   const sampled=route.filter((_,i)=>i%skip===0);
   if(sampled.length<3)continue;
   sampled.push([...sampled[0]]);
   loops.push(sampled.map(([x,y])=>[x/height,y/height]));
  }
 }
 return loops;
}
export async function traceRaster(file,{mode='color',detail=50}={}){
 if(!(file instanceof Blob)||!file.type.startsWith('image/'))throw Error('Choose a PNG, JPEG, WEBP or other browser-supported image.');
 if(file.size>8*1024*1024)throw Error('Image exceeds 8 MB. Resize it before importing.');
 const bmp=await createImageBitmap(file);
 try{
  const maxSide=mode==='mono'?210:160;
  const scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
  const width=Math.max(1,Math.round(bmp.width*scale)),height=Math.max(1,Math.round(bmp.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(bmp,0,0,width,height);
  const data=ctx.getImageData(0,0,width,height).data;
  const masks=Array.from({length:mode==='mono'?1:PEN_COLORS.length},()=>new Uint8Array(width*height));
  const cutoff=215-Math.round(Number(detail)*.95);
  for(let i=0;i<width*height;i++){
   const r=data[i*4],g=data[i*4+1],b=data[i*4+2];
   if(isWhite(r,g,b))continue;
   if(mode==='mono'){
    const lum=.2126*r+.7152*g+.0722*b;
    if(lum<cutoff)masks[0][i]=1;
   }else{
    // Colored pen matches original pixel approximately; no shading/ink mixing.
    let best=0,d=Infinity;
    for(let k=0;k<PEN_COLORS.length;k++){
     const v=inColor(PEN_COLORS[k],r,g,b);
     if(v<d){d=v;best=k}
    }
    if(Math.min(r,g,b)<225)masks[best][i]=1;
   }
  }
  const strokes=[];
  const minLen=10+Math.round((100-Number(detail))/8);
  for(let i=0;i<masks.length;i++){
   const loops=traceMask(masks[i],width,height,minLen);
   const color=mode==='mono'?PEN_COLORS[0].hex:PEN_COLORS[i].hex;
   for(const points of loops)strokes.push({points,color});
  }
  strokes.sort((a,b)=>a.color.localeCompare(b.color)); // batch paths by virtual pen
  if(strokes.length>150)throw Error('Image has '+strokes.length+' tiny contours. Lower detail, crop it, or use simpler line art.');
  if(!strokes.length)throw Error('No contours detected. Increase detail or use an image with stronger contrast.');
  const sourcePoints=strokes.reduce((n,s)=>n+s.points.length,0);
  if(sourcePoints>18000)throw Error('Image is too detailed. Lower detail or simplify the source.');
  return {strokes,meta:{fileName:file.name||'pasted-image',mimeType:file.type,sizeBytes:file.size,
   originalWidth:bmp.width,originalHeight:bmp.height,tracedWidth:width,tracedHeight:height,
   colorMode:mode,detail,sourcePoints,strokeCount:strokes.length,
   palette:PEN_COLORS.map(({name,hex})=>({name,hex})),algorithm:'color-quantized-boundary-outlines-v1'}};
 }finally{bmp.close();}
}
