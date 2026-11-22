// Graphic, repeatable counterfactual comparison. No physical stepper telemetry.
import {runComparison} from './trajectory-benchmark.js';
export function installBenchmarkPanel(select,plot,bars,output){
 const fmt=x=>Number(x).toFixed(2);
 function trace(ctx,points,map,color,dashed=false,width=1.5){
  if(!points?.length)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.setLineDash(dashed?[5,4]:[]);
  ctx.beginPath();ctx.moveTo(...map(points[0]));
  for(const p of points.slice(1))ctx.lineTo(...map(p));
  ctx.stroke();ctx.restore();
 }
 function render(){
  const r=runComparison(select.value);
  const ctx=plot.getContext('2d'),W=plot.width,H=plot.height;
  ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);
  const all=r.traces.reference.concat(r.traces.legacy,r.traces.buffered);
  const xs=all.map(v=>v[0]),ys=all.map(v=>v[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const scale=Math.min((W-60)/Math.max(.001,xmax-xmin),(H-63)/Math.max(.001,ymax-ymin));
  const ox=(W-(xmax-xmin)*scale)/2,oy=(H-(ymax-ymin)*scale)/2+5;
  const map=p=>[ox+(p[0]-xmin)*scale,H-(oy+(p[1]-ymin)*scale)];
  ctx.strokeStyle='#e0e7ee';ctx.lineWidth=1;
  for(let x=25;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,H-24);ctx.stroke()}
  for(let y=25;y<H;y+=40){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(W-12,y);ctx.stroke()}
  trace(ctx,r.traces.buffered,map,'#18866c',false,2.8);
  trace(ctx,r.traces.legacy,map,'#dc8034',false,2.3);
  trace(ctx,r.traces.reference,map,'#334155',true,1.5);
  ctx.font='13px system-ui';ctx.fillStyle='#334155';
  let x=17;
  for(const [text,color] of [['Target','#334155'],['Original','#dc8034'],['Buffered','#18866c']]){
    ctx.fillStyle=color;ctx.fillRect(x,H-17,11,5);ctx.fillStyle='#334155';ctx.fillText(text,x+16,H-10);x+=105;
  }
  const barCtx=bars.getContext('2d'),Bw=bars.width,Bh=bars.height;
  barCtx.fillStyle='#f8fafc';barCtx.fillRect(0,0,Bw,Bh);
  const groups=[
    {title:'RMS contour deviation (mm)',items:[r.legacy.rmsMm,r.buffered.rmsMm]},
    {title:'Completion duration (s)',items:[r.legacy.durationS,r.buffered.durationS]}
  ];
  groups.forEach((g,i)=>{
    const left=12+i*315;
    const max=Math.max(...g.items,.0001)*1.05;
    barCtx.fillStyle='#27374d';barCtx.font='13px system-ui';barCtx.fillText(g.title,left+5,20);
    g.items.forEach((val,j)=>{
      const y=45+j*51,w=val/max*175;
      barCtx.fillStyle=j===0?'#dc8034':'#18866c';
      barCtx.fillRect(left+73,y,w,25);
      barCtx.font='12px system-ui';barCtx.fillStyle='#334155';
      barCtx.fillText(j===0?'Original':'Buffered',left+3,y+17);
      barCtx.fillText(fmt(val),left+80+w,y+17);
    });
  });
  output.textContent='Original: '+fmt(r.legacy.rmsMm)+' mm RMS / '+fmt(r.legacy.maxMm)+' mm peak; '+fmt(r.legacy.durationS)+' s.  Buffered: '+fmt(r.buffered.rmsMm)+' mm RMS / '+fmt(r.buffered.maxMm)+' mm peak; '+fmt(r.buffered.durationS)+' s.';
 }
 select.addEventListener('change',render);render();
}
