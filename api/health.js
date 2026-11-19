export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({service:'3R manipulator planning API',version:1,
    hardware:'local Web Serial only; no remote cloud motor control',
    status:'planning-ready', endpoints:['POST /api/plan'],physicalFeedback:'none'});
}
