// Deterministic software comparison. No real motor feedback.
import {runComparison} from './trajectory-benchmark.js';
export function installBenchmarkPanel(select,plot,bars,output){
 const fmt=x=>Number(x).toFixed(2);
 const colors={legacy:'#d97931',buffered:'#168569',adaptive:'#2563eb',torque:'#9146b8'};
 function drawTrace(ctx,points,map,color,width=2,dashed=false){
  if(!points?.length)return;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.setLineDash(dashed?[5,4]:[]);
  ctx.beginPath();ctx.moveTo(...map(points[0]));
  for(let i=1;i<points.length;i++)ctx.lineTo(...map(points[i]));
  ctx.stroke();ctx.restore();
 }
 function render(){
  const r=runComparison(select.value),ctx=plot.getContext('2d'),W=plot.width,H=plot.height;
  ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,W,H);
  const all=r.traces.reference.concat(r.traces.legacy,r.traces.buffered,r.traces.adaptive,r.traces.torque);
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const scale=Math.min((W-65)/Math.max(.001,xmax-xmin),(H-60)/Math.max(.001,ymax-ymin));
  const ox=(W-(xmax-xmin)*scale)/2,oy=(H-(ymax-ymin)*scale)/2+6;
  const map=p=>[ox+(p[0]-xmin)*scale,H-oy-(p[1]-ymin)*scale];
  ctx.strokeStyle='#e0e7ee';ctx.lineWidth=1;
  for(let x=25;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x,H-28);ctx.stroke()}
  for(let y=25;y<H;y+=40){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(W-12,y);ctx.stroke()}
  drawTrace(ctx,r.traces.buffered,map,colors.buffered,2.5);
  drawTrace(ctx,r.traces.legacy,map,colors.legacy,2.3);
  drawTrace(ctx,r.traces.adaptive,map,colors.adaptive,2.0);
  drawTrace(ctx,r.traces.torque,map,colors.torque,1.8);
  drawTrace(ctx,r.traces.reference,map,'#111827',1.4,true);
  ctx.font='12px system-ui';let x=12;
  for(const [label,color] of [['Target','#111827'],['Original',colors.legacy],['Fixed',colors.buffered],['Adaptive',colors.adaptive],['Torque-aware',colors.torque]]){
   ctx.fillStyle=color;ctx.fillRect(x,H-17,10,5);
   ctx.fillStyle='#1e293b';ctx.fillText(label,x+14,H-11);x+=label==='Torque-aware'?120:label==='Adaptive'?98:83;
  }
  const bar=bars.getContext('2d'),BW=bars.width,BH=bars.height;
  bar.fillStyle='#f8fafc';bar.fillRect(0,0,BW,BH);
  const metrics=[{title:'RMS deviation (mm)',values:[r.legacy.rmsMm,r.buffered.rmsMm,r.adaptive.rmsMm,r.torque.rmsMm]},
                 {title:'Duration (s)',values:[r.legacy.durationS,r.buffered.durationS,r.adaptive.durationS,r.torque.durationS]}];
  metrics.forEach((m,i)=>{
   const offset=i*315,max=Math.max(.001,...m.values)*1.08;
   bar.font='13px system-ui';bar.fillStyle='#27374d';bar.fillText(m.title,offset+5,20);
   m.values.forEach((v,j)=>{
    const x=offset+83,y=37+j*43;
    bar.fillStyle=[colors.legacy,colors.buffered,colors.adaptive,colors.torque][j];
    const width=v/max*155;bar.fillRect(x,y,width,23);
    bar.fillStyle='#334155';bar.font='12px system-ui';
    bar.fillText(['Original','Fixed','Adaptive','Torque'][j],offset+3,y+16);
    bar.fillText(fmt(v),x+width+5,y+16);
   });
  });
  output.textContent='Original '+fmt(r.legacy.rmsMm)+' mm / '+fmt(r.legacy.durationS)+' s · Fixed buffered '+fmt(r.buffered.rmsMm)+' mm / '+fmt(r.buffered.durationS)+' s · Adaptive buffered '+fmt(r.adaptive.rmsMm)+' mm / '+fmt(r.adaptive.durationS)+' s · Torque-aware '+fmt(r.torque.rmsMm)+' mm / '+fmt(r.torque.durationS)+' s. Adaptive planned rate '+fmt(r.adaptive.minRate)+'–'+fmt(r.adaptive.maxRate)+' half-steps/s. SOFTWARE ONLY, no physical motor measurements.';
 }
 select.addEventListener('change',render);render();
}
