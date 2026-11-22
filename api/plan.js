// Public, stateless planning-only API. NO actuator control from a Vercel request.
// A local user must independently connect/arm Arduino through browser Web Serial.
import {planWriting,forward} from '../src/writing.js';
import {planStrokes} from '../src/path-planner.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'POST only'});}
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const mode=body.mode||'latin';
  const text=body.text||'';
  const speed=body.speedMmPerSecond??15;
  if(!['latin','hindi','draw','image'].includes(mode)||!Number.isFinite(speed)||speed<5||speed>45)
    return res.status(400).json({error:'mode must be latin, hindi, draw or image; speed must be 5–45 mm/s'});
  if(typeof text!=='string'||text.length>24)
    return res.status(400).json({error:'Text is too long.'});
  if(mode==='latin'&&body.strokes!==undefined)
    return res.status(400).json({error:'Latin input must be text.'});
  if(mode!=='latin'&&!Array.isArray(body.strokes))
    return res.status(400).json({error:'For Hindi and Draw, send the browser-generated stroke coordinates.'});
  try {
    const plan=mode==='latin'?planWriting(text,speed/1000)
      :mode==='image'?planStrokes(body.strokes.map(s=>s.points),speed/1000,body.strokes.map(s=>s.color))
      :planStrokes(body.strokes,speed/1000);
    if(mode==='hindi')plan.text=text;
    if(mode==='draw')plan.text='CUSTOM DRAWING';
    if(mode==='image')plan.text='IMPORTED IMAGE';
    if (plan.points.length > 7500) return res.status(422).json({error:'Too many trajectory samples'});
    for (const point of plan.points) {
      if (!point.q.every(q=>Number.isFinite(q)&&Math.abs(q)<=150*Math.PI/180))
        return res.status(422).json({error:'Trajectory exceeds ±150° hardware safety limits'});
      const [fx,fy] = forward(point.q);
      if (Math.hypot(fx-point.x,fy-point.y)>.0001)
        return res.status(422).json({error:'Kinematic inconsistency at trajectory waypoint'});
    }
    // Cap commanded incremental joint speed near the torque datasheet's 120 Hz test point.
    // This does not enforce acceleration, verify motor tracking or prove torque margin.
    const maxHalfstepsPerSecond=100, halfstepsPerRev=4096;
    let duration=plan.points[0]?.dt||0;
    for(let i=1;i<plan.points.length;i++){
      const prev=plan.points[i-1],cur=plan.points[i];
      const maxSteps=Math.max(...cur.q.map((q,j)=>Math.abs(q-prev.q[j])*halfstepsPerRev/(2*Math.PI)));
      cur.dt=Math.max(cur.dt,maxSteps/maxHalfstepsPerSecond);
      duration+=cur.dt;
    }
    return res.status(200).json({version:3,mode,units:{angles:'rad',coordinates:'m',time:'s'},text:plan.text,
      points:plan.points,strokes:plan.strokes,estimatedDuration:duration,
      safety:{requiresManualCalibration:true,requiresLocalArm:true,closedLoopFeedback:false,penLiftRequired:true,maxPlannedHalfStepsPerSecond:100,motorTorqueVerified:false,accelerationLimited:false,automaticColorChange:false}});
  } catch(err) {return res.status(422).json({error:String(err.message).slice(0,200)});}
}
