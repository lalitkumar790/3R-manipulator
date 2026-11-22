// Download per-file design metadata and actual planned trajectories.
export function exportDesignFiles(plan,source){
 if(!plan?.points?.length)throw Error('Plan a design before exporting data.');
 const safe=(source?.fileName||plan.text||'3r-design').replace(/\.[a-z0-9]+$/i,'').replace(/[^a-z0-9-_]/gi,'_').slice(0,50)||'3r-design';
 const points=plan.points.map((p,i)=>({index:i,timeS:p.dt,xM:p.x,yM:p.y,
  j1Rad:p.q[0],j2Rad:p.q[1],j3Rad:p.q[2],liftM:p.lift,
  ink:Boolean(p.ink),strokeIndex:p.strokeIndex??null,color:p.color||'#1c2638'}));
 const info={schema:'3r-design-data-v1',createdAt:new Date().toISOString(),
  source:source||{inputType:'text'},designName:safe,
  machine:{linkLengthsM:[.120,.100,.060],hardware:'Arduino Uno / 28BYJ-48 / ULN2003',
    motorTorqueValidated:false,encoderFeedback:false,physicalPenChangerInstalled:false},
  units:{xyz:'m',angles:'rad',time:'s'},summary:{strokes:plan.strokes,waypoints:points.length,
   durationS:plan.estimatedDuration,colors:[...new Set(points.map(p=>p.color))]},
  points};
 const headers=['index','timeS','xM','yM','j1Rad','j2Rad','j3Rad','liftM','ink','strokeIndex','color'];
 const csv=[headers.join(','),...points.map(p=>headers.map(k=>p[k]??'').join(','))].join('\n');
 const download=(name,text,type)=>{
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 return{
  json:()=>download(safe+'.3r.json',JSON.stringify(info,null,2),'application/json'),
  csv:()=>download(safe+'.trajectory.csv',csv,'text/csv')
 };
}
