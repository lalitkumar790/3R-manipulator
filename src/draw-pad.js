// Frame-throttled freehand pad, preserving stroke order and pointer ownership.
// The input is normalized by canvas *height* to preserve aspect ratio.
export function installDrawPad(canvas,onChange=()=>{}){
 const ctx=canvas.getContext('2d');
 const strokes=[];let active=null,pointerId=null,queued=false;
 function point(e){
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/Math.max(1,rect.width),y=(e.clientY-rect.top)/Math.max(1,rect.height);
  return[Math.max(0,Math.min(canvas.width,x*canvas.width)),Math.max(0,Math.min(canvas.height,y*canvas.height))];
 }
 function repaint(){
  queued=false;
  const {width:w,height:h}=canvas;
  ctx.fillStyle='#f6f9fd';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#e0e8f0';ctx.lineWidth=1;
  for(let x=0;x<w;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.strokeStyle='#2766af';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';
  for(const stroke of strokes.concat(active?[active]:[])){
   if(!stroke.length)continue;
   ctx.beginPath();ctx.moveTo(stroke[0][0],stroke[0][1]);
   for(let i=1;i<stroke.length;i++)ctx.lineTo(stroke[i][0],stroke[i][1]);
   if(stroke.length===1)ctx.lineTo(stroke[0][0]+.1,stroke[0][1]+.1);
   ctx.stroke();
  }
  if(!strokes.length&&!active){ctx.fillStyle='#67778e';ctx.font='17px sans-serif';ctx.fillText('Draw here with mouse, finger or stylus',20,35);}
  onChange(strokes.length,active?.length||0);
 }
 function redraw(){
  if(!queued){queued=true;requestAnimationFrame(repaint);}
 }
 function sample(e){
  if(!active||e.pointerId!==pointerId)return;
  const p=point(e),last=active[active.length-1];
  if(Math.hypot(p[0]-last[0],p[1]-last[1])>=1.4 && active.length<5000){active.push(p);redraw();}
 }
 canvas.addEventListener('pointerdown',e=>{
  if(pointerId!==null)return;
  e.preventDefault();pointerId=e.pointerId;active=[point(e)];
  canvas.setPointerCapture(e.pointerId);redraw();
 });
 canvas.addEventListener('pointermove',e=>{
  if(pointerId!==e.pointerId)return;
  e.preventDefault();
  const events=e.getCoalescedEvents?.()||[e];
  for(const event of events)sample(event);
 });
 canvas.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointerId)return;
  sample(e);
  if(active.length===1){
    const [x,y]=active[0];active.push([Math.min(canvas.width,x+1.5),Math.min(canvas.height,y+1.5)]);
  }
  if(active.length>=2)strokes.push(active);
  active=null;pointerId=null;redraw();
 });
 canvas.addEventListener('pointercancel',e=>{
  if(e.pointerId!==pointerId)return;
  active=null;pointerId=null;redraw();
 });
 repaint();
 return{
  getStrokes:()=>strokes.map(s=>s.map(([x,y])=>[x/canvas.height,y/canvas.height])),
  undo:()=>{strokes.pop();redraw()},
  clear:()=>{strokes.length=0;redraw()},
  count:()=>strokes.length
 };
}
