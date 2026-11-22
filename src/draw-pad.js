// Pointer/pen/touch sketch pad: keeps exact user stroke ordering and paths.
// Coordinate output is unitless, scaled by canvas height to preserve aspect ratio.
export function installDrawPad(canvas,onChange=()=>{}){
 const ctx=canvas.getContext('2d');
 const strokes=[];
 let active=null,pointerId=null;
 function xy(event){
  const r=canvas.getBoundingClientRect();
  return [Math.max(0,Math.min(r.width,event.clientX-r.left))*canvas.height/r.height,
          Math.max(0,Math.min(r.height,event.clientY-r.top))*canvas.height/r.height];
 }
 function repaint(){
  const {width:w,height:h}=canvas;
  ctx.fillStyle='#f6f9fd';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#dce6ee';ctx.lineWidth=1;
  for(let x=0;x<w;x+=25){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.strokeStyle='#2766af';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of [...strokes,...(active?[active]:[])]){
   if(stroke.length<2)continue;
   ctx.beginPath();ctx.moveTo(stroke[0][0],stroke[0][1]);
   for(let i=1;i<stroke.length;i++)ctx.lineTo(stroke[i][0],stroke[i][1]);
   ctx.stroke();
  }
  if(!strokes.length&&!active){ctx.fillStyle='#67778e';ctx.font='17px sans-serif';ctx.fillText('Draw here with mouse, finger or stylus',20,35);}
  onChange(strokes.length,active?.length||0);
 }
 canvas.addEventListener('pointerdown',e=>{
  if(pointerId!==null)return;
  e.preventDefault();pointerId=e.pointerId;canvas.setPointerCapture(pointerId);
  active=[xy(e)];repaint();
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointerId||!active)return;
  e.preventDefault();const p=xy(e),prev=active[active.length-1];
  if(Math.hypot(p[0]-prev[0],p[1]-prev[1])>=.8){active.push(p);repaint();}
 });
 function finish(e){
  if(e.pointerId!==pointerId)return;
  if(active?.length===1){
   const [x,y]=active[0];active.push([x+1,y+1]); // allow simple dots
  }
  if(active?.length>=2)strokes.push(active);
  active=null;pointerId=null;repaint();
 }
 canvas.addEventListener('pointerup',finish);
 canvas.addEventListener('pointercancel',finish);
 repaint();
 return {
  getStrokes:()=>strokes.map(stroke=>stroke.map(([x,y])=>[x/canvas.height,y/canvas.height])),
  undo:()=>{strokes.pop();repaint()},
  clear:()=>{strokes.length=0;repaint()},
  count:()=>strokes.length
 };
}
