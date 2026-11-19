// Public, stateless planning-only API. NO actuator control from a Vercel request.
// A local user must independently connect/arm Arduino through browser Web Serial.
import {planWriting,forward} from '../src/writing.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method !== 'POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'POST only'});}
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = body.text;
  const speed = body.speedMmPerSecond ?? 15;
  if (typeof text !== 'string' || text.length > 24 || !Number.isFinite(speed) || speed < 5 || speed > 45)
    return res.status(400).json({error:'text must be at most 24 characters; speed must be 5-45 mm/s'});
  try {
    const plan = planWriting(text,speed/1000);
    if (plan.points.length > 7500) return res.status(422).json({error:'Too many trajectory samples'});
    for (const point of plan.points) {
      if (!point.q.every(q=>Number.isFinite(q)&&Math.abs(q)<=150*Math.PI/180))
        return res.status(422).json({error:'Trajectory exceeds ±150° hardware safety limits'});
      const [fx,fy] = forward(point.q);
      if (Math.hypot(fx-point.x,fy-point.y)>.0001)
        return res.status(422).json({error:'Kinematic inconsistency at trajectory waypoint'});
    }
    return res.status(200).json({version:1,units:{angles:'rad',coordinates:'m',time:'s'},text:plan.text,
      points:plan.points,strokes:plan.strokes,estimatedDuration:plan.estimatedDuration,
      safety:{requiresManualCalibration:true,requiresLocalArm:true,closedLoopFeedback:false,penLiftRequired:true}});
  } catch(err) {return res.status(422).json({error:String(err.message).slice(0,200)});}
}
