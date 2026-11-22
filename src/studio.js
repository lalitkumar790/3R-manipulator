import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './studio.css';
import {planWriting,forward,inverse} from './writing.js';
import {planStrokes} from './path-planner.js';
import {hindiTextToStrokes} from './hindi-outline.js';
import {installDrawPad} from './draw-pad.js';
import {interpretImage} from './image-interpret.js';
import {sampleTimedPlan} from './motion-smoothing.js';
import {exportDesignFiles} from './design-export.js';
import {attachCad} from './cad-loader.js';
import {estimateTorque,motorReferenceTorqueNm} from './torque-estimate.js';
const $=id=>document.getElementById(id);
const host=$('three'),scene=new THREE.Scene();scene.background=new THREE.Color(0x0a182a);
const camera=new THREE.PerspectiveCamera(43,1,.002,8);camera.up.set(0,0,1);camera.position.set(.37,-.33,.35);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.13,.025,.035);controls.minDistance=.14;controls.maxDistance=1.2;controls.enableDamping=true;controls.update();
scene.add(new THREE.HemisphereLight(0xc4daff,0x19314b,2.1));const sunlight=new THREE.DirectionalLight(0xe9f3ff,2.6);sunlight.position.set(.08,-.1,.42);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);scene.add(sunlight);
const mat=(color,metalness=.38,roughness=.48)=>new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide});
const steel=mat(0x7f96ad),baseMaterial=mat(0x364d6a),blue=mat(0x459df9),amber=mat(0xf3b95c),mint=mat(0x46d8b9),holeMat=mat(0x172941,.15);
function solid(group,g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;}
function ringMesh(parent,outer,inner,z,height,material){
 const s=new THREE.Shape();s.absellipse(0,0,outer[0],outer[1],0,Math.PI*2,false,0);
 const hole=new THREE.Path();hole.absellipse(0,0,inner[0],inner[1],0,Math.PI*2,true,0);s.holes.push(hole);
 return solid(parent,new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:72}),material,0,0,z);
}
const table=solid(scene,new THREE.PlaneGeometry(.9,.7),mat(0x0a1726,.02,.95),.13,.025,-.005);
const floor=new THREE.GridHelper(.68,34,0x2a5172,0x20364f);floor.rotation.x=Math.PI/2;floor.position.set(.1,.0,-.003);scene.add(floor);
const paper=solid(scene,new THREE.PlaneGeometry(.19,.12),mat(0xe2e9ef,.0,.95),.155,.035,.0003);
const edge=new THREE.EdgesGeometry(paper.geometry);const outline=new THREE.LineSegments(edge,new THREE.LineBasicMaterial({color:0x88a9c5}));paper.add(outline);
const base=new THREE.Group();scene.add(base);
const baseRingVisual=ringMesh(base,[.077,.070],[.050,.046],0,.036,baseMaterial);
const baseLidVisual=ringMesh(base,[.077,.070],[.014,.014],.036,.007,steel);
// Base motor housing is not included in the supplied STL files; do not invent one.
function bolt(parent,x,y,z){const b=solid(parent,new THREE.CylinderGeometry(.003,.003,.001,12),mat(0xbdd4e4),x,y,z);b.rotation.x=Math.PI/2}
// Original base CAD already includes real mounting features; no added fake bolts.
const j1=new THREE.Group();j1.position.set(0,0,.055);scene.add(j1);
const j2=new THREE.Group();j2.position.set(.120,0,.014);j1.add(j2);
const j3=new THREE.Group();j3.position.set(.100,0,.014);j2.add(j3);
function linkGeometry(type){
 const s=new THREE.Shape();
 const dims=type===1?{back:-.014,front:.136,wBack:.014,wFront:.024,holes:[[0,0,.0038],[.03,0,.011],[.060,0,.0125],[.082,0,.004],[.120,0,.0058]]}:type===2?{back:-.014,front:.116,wBack:.014,wFront:.024,holes:[[0,0,.0038],[.03,0,.011],[.055,0,.009],[.100,0,.0058]]}:{back:-.014,front:.076,wBack:.014,wFront:.016,holes:[[0,0,.0037],[.030,0,.0098],[.060,0,.0061]]};
 const {back,front,wBack,wFront,holes}=dims;
 s.moveTo(back,0);s.bezierCurveTo(back,-wBack,back+.008,-wBack,0,-wBack);
 s.lineTo(front-.019,-wFront);s.bezierCurveTo(front+.007,-wFront,front+.007,wFront,front-.019,wFront);
 s.lineTo(0,wBack);s.bezierCurveTo(back+.008,wBack,back,wBack,back,0);
 for(const [x,y,r] of holes){const p=new THREE.Path();p.absarc(x,y,r,0,Math.PI*2,true);s.holes.push(p)}
 const g=new THREE.ExtrudeGeometry(s,{depth:type===3?.022:.008,bevelEnabled:true,bevelThickness:.0005,bevelSize:.00035,bevelSegments:1,curveSegments:20,steps:1});g.computeVertexNormals();return g;
}
const link1Visual=solid(j1,linkGeometry(1),blue);link1Visual.rotation.x=Math.PI;link1Visual.position.z=.008;
const link2Visual=solid(j2,linkGeometry(2),amber);link2Visual.rotation.x=Math.PI;link2Visual.position.z=.008;
const link3Visual=solid(j3,linkGeometry(3),mint);link3Visual.rotation.x=Math.PI;link3Visual.position.z=.008;
const cadParts={
 base_ring:{parent:base,offset:[0,0,0],color:0x516b85,replace:[baseRingVisual]},
 base_lid:{parent:base,offset:[0,0,.036],color:0x8ba6b8,replace:[baseLidVisual]},
 link1:{parent:j1,offset:[0,0,.008],flipFace:true,color:0x54aafb,replace:[link1Visual]},
 link2:{parent:j2,offset:[0,0,.008],flipFace:true,color:0xe9b65c,replace:[link2Visual]},
 link3_penholder:{parent:j3,offset:[0,0,.008],flipFace:true,color:0x5bdfbc,replace:[link3Visual]}
};
attachCad(cadParts,(count,total,name,error)=>{
 const chip=document.getElementById('cad-status');
 if(chip)chip.textContent=error?'CAD LOAD ERROR':'CAD MESHES '+count+'/'+total;
}).then(({loaded,errors})=>{
 const chip=document.getElementById('cad-status');
 if(chip)chip.textContent=loaded===5?'ORIGINAL CAD SHAPES':'CAD LOAD FAILED';
 if(errors.length)document.getElementById('warning').textContent='Some CAD meshes could not load: '+errors.join(', ');
});

// CAD-registered 28BYJ-48 motor visualization. Hole centers were inspected in
// the ORIGINAL (full-resolution) STLs, not estimated from reduced viewer meshes.
// Base lid: shaft (0,0), screws (-8,+/-17.5) mm.
// Link 1 : shaft (120,0), screws (112,+/-17.5) mm.
// Link 2 : shaft (100,0), screws ( 92,+/-17.5) mm.
// The motors are conceptual 28BYJ-48 bodies (not uploaded motor CAD).
// Their placement is geometric registration, NOT proof of no collision or torque fit.
const motorSteel=mat(0xaebbc6,.58,.34), motorBlue=mat(0x386fa7,.17,.59);
const motorDark=mat(0x35485b,.48,.49),motorShaft=mat(0xd7e6f2,.76,.24);
const motorScrew=mat(0x8f9dab,.67,.30),motorCoupler=mat(0xcfaa65,.55,.31);
const motorColors=[mat(0xe05c51),mat(0xf0d36a),mat(0x5399d1),mat(0x343d49),mat(0xc1d2df)];
const MOTOR_CAN_R=.014, MOTOR_CAN_H=.019;
const MOTOR_SHAFT_OFFSET=-.008, MOTOR_SCREW_Y=.0175;
function motorCylinder(parent,radius,height,material,x,y,z){
 const mesh=solid(parent,new THREE.CylinderGeometry(radius,radius,height,48),material,x,y,z);
 mesh.rotation.x=Math.PI/2;return mesh;
}
function placeCadMotor(spec){
 const mounting=new THREE.Group();
 mounting.name=spec.name+' fixed-side 28BYJ-48 motor';
 mounting.position.set(...spec.shaftOrigin);
 spec.upstream.add(mounting);
 // The flange's top is flush to the UNDERSIDE of the original CAD plate,
 // not floating on the moving link. Mounting screws align to the CAD holes.
 const z=spec.mountFace;
 motorCylinder(mounting,MOTOR_CAN_R,MOTOR_CAN_H,motorSteel,MOTOR_SHAFT_OFFSET,0,z-MOTOR_CAN_H/2);
 motorCylinder(mounting,.0138,.0012,motorDark,MOTOR_SHAFT_OFFSET,0,z-.001);
 motorCylinder(mounting,.0088,.002,motorBlue,0,0,z-.001);
 for(const sign of [-1,1]){
   const y=sign*MOTOR_SCREW_Y;
   // Two mounting ears with 35mm centre spacing.
   const ear=solid(mounting,new THREE.BoxGeometry(.011,.0065,.0014),motorBlue,MOTOR_SHAFT_OFFSET,y,z-.0014);
   ear.name=spec.name+' mounting tab';
   // Motor hole Ø4.2; nominal fastener ~2.5mm to fit CAD Ø2.6 hole.
   const washer=motorCylinder(mounting,.0022,.0006,motorScrew,MOTOR_SHAFT_OFFSET,y,z+.00015);
   washer.name=spec.name+' screw washer at CAD hole';
   motorCylinder(mounting,.00115,.0035,motorScrew,MOTOR_SHAFT_OFFSET,y,z+.0015);
 }
 for(let i=0;i<5;i++){
   const wirePath=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.019,(i-2)*.0012,z-.013),
    new THREE.Vector3(-.026,(i-2)*.0017,z-.020),
    new THREE.Vector3(-.034,(i-2)*.0018,z-.024)
   ]);
   solid(mounting,new THREE.TubeGeometry(wirePath,10,.0004,5,false),motorColors[i]);
 }
 mounting.userData={cadPart:spec.cadPart,shaftMM:spec.shaftOrigin.slice(0,2).map(v=>v*1000),
   mountingHolesMM:[-8,17.5],axialFaceMM:z*1000};
 // Rotating D-shaft is a child of the DRIVEN link; stationary housing is not.
 const length=-z;
 const shaft=motorCylinder(spec.driven,.0025,length,motorShaft,0,0,z/2);
 shaft.scale.z=.64; // flatten cross-section across world Y, not along cylinder axis
 shaft.name=spec.name+' moving output shaft';
 // The 28BYJ nominal shaft projects ~10 mm; additional length is only
 // a conceptual shaft coupling and must be manufactured/validated.
 let coupling=null;
 if(length>.010){
   const extra=length-.010;
   coupling=motorCylinder(spec.driven,.0032,extra,motorCoupler,0,0,-extra/2);
   coupling.name=spec.name+' required extension coupler (unverified)';
 }
 return {mounting,shaft,coupling};
}
const motorMountSpecs=[
 {name:'J1',cadPart:'base_lid',upstream:base,driven:j1,shaftOrigin:[0,0,.055],mountFace:-.019},
 {name:'J2',cadPart:'link1',upstream:j1,driven:j2,shaftOrigin:[.120,0,.014],mountFace:-.014},
 {name:'J3',cadPart:'link2',upstream:j2,driven:j3,shaftOrigin:[.100,0,.014],mountFace:-.014}
];
const mountedMotors=motorMountSpecs.map(placeCadMotor);
function showMotorGeometry(on){
 for(const item of mountedMotors){
   item.mounting.visible=on;item.shaft.visible=on;
   if(item.coupling)item.coupling.visible=on;
 }
 $('motor-description').textContent=on
 ?'Fixed to original CAD holes: Base lid (−8, ±17.5 mm), Link 1 (112, ±17.5 mm), Link 2 (92, ±17.5 mm). Motor shafts at X = 0 / 120 / 100 mm. Gold sleeves represent unverified shaft extensions.'
 :'Motors hidden; original CAD parts remain unobstructed.';
}
$('show-steppers').addEventListener('change',e=>showMotorGeometry(e.target.checked));
showMotorGeometry(true);
const penCarrier=new THREE.Group();penCarrier.position.set(.060,0,0);j3.add(penCarrier);
// Vertical, calibrated-length ballpoint geometry: narrow metal grip + true down-pointing nib.
// The tip apex remains at local Z=-82 mm to preserve the existing kinematic tip frame.
const penBody=solid(penCarrier,new THREE.CylinderGeometry(.00315,.00315,.085,24),mat(0xe8f2fb,.18,.32),0,0,-.0225);
penBody.rotation.x=Math.PI/2;
const penGrip=solid(penCarrier,new THREE.CylinderGeometry(.00315,.00115,.014,24),mat(0xa7b7c9,.55,.31),0,0,-.072);
penGrip.rotation.x=Math.PI/2;
const nib=solid(penCarrier,new THREE.ConeGeometry(.0013,.006,24),mat(0x1c2638,.6,.2),0,0,-.079);
nib.rotation.x=-Math.PI/2; // apex faces paper at z=-.082
const tipObject=new THREE.Object3D();tipObject.position.z=-.082;penCarrier.add(tipObject);
const tipTmp=new THREE.Vector3();
function actualTip(){scene.updateMatrixWorld(true);return tipObject.getWorldPosition(tipTmp.clone());}
let targetQ=[-.85,1.4,-.55],displayQ=[...targetQ],targetLift=.012,actualLift=.012,physics=null,physicsTime=0,playing=false,paused=false,plan=null,planIndex=0,planClock=0,inkPoints=[],line=null,previous=null,slowAccumulator=0;
let playbackElapsed=0,playbackDuration=0,completionHold=0,trackingErrorM=0,trackingErrorRad=0;
const inkMaterial=new THREE.LineBasicMaterial({color:0x174d9b,linewidth:2});
const dragMaterial=new THREE.LineBasicMaterial({color:0xe58b42,linewidth:2});
const inkLayers=new Map();let previousInkColor=null;
let dragPoints=[], dragLine=null, lastTravelMode=null;
const penMode=()=>document.querySelector('input[name="pen-mode"]:checked')?.value||'lift';
const fixedPen=()=>penMode()==='fixed';
function renderWritingPreview(planned){
 const canvas=$('writing-preview');if(!canvas)return;
 const ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;
 ctx.fillStyle='#f1f4f8';ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#d1dce8';ctx.lineWidth=1;ctx.strokeRect(9,9,W-18,H-18);
 if(!planned?.points?.length){ctx.fillStyle='#66758a';ctx.font='20px sans-serif';ctx.fillText('Create a design and click Plan & simulate',30,80);return}
 const pts=planned.points,xx=pts.map(p=>p.x),yy=pts.map(p=>p.y);
 const xMin=Math.min(...xx),xMax=Math.max(...xx),yMin=Math.min(...yy),yMax=Math.max(...yy);
 const scale=Math.min((W-66)/Math.max(.012,xMax-xMin),(H-50)/Math.max(.018,yMax-yMin));
 const xOff=(W-(xMax-xMin)*scale)/2,yOff=(H-(yMax-yMin)*scale)/2;
 const X=p=>xOff+(p.x-xMin)*scale,Y=p=>H-(yOff+(p.y-yMin)*scale);
 ctx.lineWidth=2.1;ctx.lineJoin='round';ctx.lineCap='round';
 for(let i=1;i<pts.length;i++){
   const point=pts[i],prev=pts[i-1];
   const dragging=fixedPen()&&!point.ink;
   if(!point.ink&&!fixedPen())continue;
   ctx.beginPath();ctx.moveTo(X(prev),Y(prev));ctx.lineTo(X(point),Y(point));
   ctx.strokeStyle=dragging?'#db813a':(point.color||'#215eaf');ctx.stroke();
 }
 ctx.font='14px sans-serif';ctx.fillStyle='#4d5e71';
 ctx.fillText(fixedPen()?'Orange lines = marks made when moving between letters':'Only pen-down strokes are inked',18,H-11);
}


function renderTorqueAudit(){
 const force=Number($('pen-force').value)/1000,accel=Number($('torque-accel').value)/100;
 $('pen-force-label').textContent=force.toFixed(2)+' N';
 $('torque-accel-label').textContent=accel.toFixed(2)+' rad/s²';
 const data=estimateTorque(force,accel);
 $('torque-results').replaceChildren();
 for(const joint of data){
   const el=document.createElement('div');el.className='torque-row';
   const label=document.createElement('div');label.className='row between';
   const a=document.createElement('strong');a.textContent='J'+joint.joint;
   const b=document.createElement('span');b.textContent=(joint.torqueNm*1000).toFixed(1)+' mN·m · '+(joint.fraction*100).toFixed(0)+'% of test reference';
   label.append(a,b);el.append(label);
   const track=document.createElement('div');track.className='torque-track';
   const fill=document.createElement('div');fill.className='torque-fill';
   if(joint.fraction>1)fill.classList.add('over');
   else if(joint.fraction>.5)fill.classList.add('warning');
   fill.style.width=Math.min(100,joint.fraction*100).toFixed(1)+'%';
   track.append(fill);el.append(track);$('torque-results').append(el);
 }
 const j1=data[0].fraction;
 $('torque-status').textContent=j1>1?'MODEL OVERLOAD':j1>.5?'LOW MARGIN':'MODEL LOW LOAD';
 $('torque-summary').textContent='J1 estimated '+(data[0].torqueNm*1000).toFixed(1)+' mN·m vs '+(motorReferenceTorqueNm*1000).toFixed(1)+' mN·m nominal 120 Hz test figure. The estimate excludes mechanical losses and torque drop at higher speeds; green does NOT certify hardware safety.';
}
$('pen-force').addEventListener('input',renderTorqueAudit);
$('torque-accel').addEventListener('input',renderTorqueAudit);
renderTorqueAudit();

const sliders=[];
for(let i=0;i<3;i++){const d=document.createElement('div');d.className='ctrl';d.innerHTML='<label class="slider-head"><span>J'+(i+1)+' · '+['Base','Elbow','Pen holder'][i]+'</span><span class="val">0°</span></label>';const input=document.createElement('input');input.type='range';input.min=-180;input.max=180;input.step=.5;input.setAttribute('aria-label','Joint '+(i+1));input.addEventListener('input',()=>{playing=false;plan=null;targetQ[i]=Number(input.value)*Math.PI/180;targetLift=.012;setStatus('MANUAL CONTROL')});d.append(input);$('joint-controls').append(d);sliders.push({input,value:d.querySelector('.val')})}
function updateSlider(){sliders.forEach((s,i)=>{s.input.value=(targetQ[i]*180/Math.PI).toFixed(1);s.value.textContent=(targetQ[i]*180/Math.PI).toFixed(1)+'°'})}
function setStatus(text){$('status').textContent=text}
function message(text,isError=false){$('warning').textContent=text;$('warning').classList.toggle('error',isError)}
function setJointDisplay(q,lift){j1.rotation.z=q[0];j2.rotation.z=q[1];j3.rotation.z=q[2];penCarrier.position.z=lift;}
// BufferGeometry capacity grows geometrically. We update only new vertices;
// previously every line fragment rebuilt all prior strokes, causing major lag.
function putInk(p,isTravel=false,color='#1c2638'){
 if(!Number.isFinite(p.x)||p.z>.0035)return;
 const key=isTravel?'__travel__':color;
 const a=new THREE.Vector3(p.x,p.y,.0014);
 if(previous&&(previous.distanceTo(a)>.008||previousInkColor!==key))previous=null;
 if(previous){
   let layer=inkLayers.get(key);
   if(!layer){
     const capacity=512,geometry=new THREE.BufferGeometry();
     const attr=new THREE.BufferAttribute(new Float32Array(capacity*3),3);
     attr.setUsage(THREE.DynamicDrawUsage);
     geometry.setAttribute('position',attr);geometry.setDrawRange(0,0);
     const material=isTravel?dragMaterial:new THREE.LineBasicMaterial({color,linewidth:2});
     const mesh=new THREE.LineSegments(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
     layer={capacity,used:0,geometry,attr,line:mesh,material};
     inkLayers.set(key,layer);
   }
   if(layer.used+2>layer.capacity){
     const capacity=layer.capacity*2;
     const array=new Float32Array(capacity*3);
     array.set(layer.attr.array);
     layer.attr=new THREE.BufferAttribute(array,3);
     layer.attr.setUsage(THREE.DynamicDrawUsage);
     layer.geometry.setAttribute('position',layer.attr);
     layer.capacity=capacity;
   }
   let offset=layer.used*3;
   layer.attr.array.set([previous.x,previous.y,previous.z,a.x,a.y,a.z],offset);
   layer.used+=2;
   layer.geometry.setDrawRange(0,layer.used);
   layer.attr.needsUpdate=true;
 }
 previous=a;previousInkColor=key;
}
function clearInk(){
 inkPoints=[];dragPoints=[];previous=null;previousInkColor=null;
 for(const layer of inkLayers.values()){
   scene.remove(layer.line);layer.geometry.dispose();
   if(layer.material!==dragMaterial)layer.material.dispose();
 }
 inkLayers.clear();line=null;dragLine=null;
}
function stop(){playing=false;paused=false;plan=null;targetLift=fixedPen()?0:.012;$('pause').textContent='Pause';$('progress').textContent='IDLE';setStatus(physics?'MUJOCO READY':'KINEMATICS READY')}

// Input adapters: English vector font, browser-shaped Devanagari contours,
// and freehand canvas all end as identical 3R IK waypoints.
const drawPad=installDrawPad($('draw-pad'),(count)=>{
 $('draw-count').textContent=count+' stroke'+(count===1?'':'s');
});
let imageSource=null,convertedImage=null,lastExportPlan=null,lastDesignSource=null;
const writingInputMode=()=>document.querySelector('input[name="write-input-mode"]:checked')?.value||'latin';
const virtualPen=()=>$('pen-color').value;
function setExport(plan,source){
 lastExportPlan=plan;lastDesignSource=source;
 $('export-json').disabled=!plan;$('export-csv').disabled=!plan;
}
function syncInputMode(){
 const mode=writingInputMode();
 $('text-input-panel').hidden=mode==='draw'||mode==='image';
 $('draw-input-panel').hidden=mode!=='draw';
 $('image-input-panel').hidden=mode!=='image';
 $('writing-label').textContent=mode==='hindi'?'हिन्दी में लिखें':'Writing text';
 $('message').placeholder=mode==='hindi'?'नमस्ते':'HELLO';
 $('writing-help').textContent=mode==='hindi'?'Devanagari outlines: नमस्ते, भारत, राम':'Supports A–Z, 0–9 and basic punctuation';
 $('stroke-info').textContent=mode==='image'
  ?'Image contours are converted to batches of colored virtual-pen strokes. No automatic real-world pen swapping.'
  :mode==='draw'?'Trace your design freely. Aspect ratio is preserved inside the robot workspace.'
  :mode==='hindi'?'Devanagari font outlines, not handwritten centerlines.'
  :'Original vector handwriting font.';
 $('count').textContent=$('message').value.length+'/24';
 stop();clearInk();setExport(null,null);renderWritingPreview(null);
}
document.querySelectorAll('input[name="write-input-mode"]').forEach(r=>r.addEventListener('change',syncInputMode));
$('draw-undo').onclick=()=>{drawPad.undo();setExport(null,null);renderWritingPreview(null)};
$('draw-clear').onclick=()=>{drawPad.clear();setExport(null,null);renderWritingPreview(null)};
$('image-detail').oninput=()=>{
 $('image-detail-label').textContent=$('image-detail').value;
 convertedImage=null;setExport(null,null);renderWritingPreview(null);
};
$('image-style').onchange=()=>{convertedImage=null;setExport(null,null);renderWritingPreview(null)};
function invalidateImage(){
 convertedImage=null;setExport(null,null);renderWritingPreview(null);
}
async function loadImage(file){
 if(!file||!file.type?.startsWith('image/'))throw Error('Select or paste an image file.');
 if(file.size>8*1024*1024)throw Error('Image larger than 8 MB.');
 imageSource=file;invalidateImage();
 const bitmap=await createImageBitmap(file);
 try{
  const canvas=$('image-preview'),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.min(canvas.width/bitmap.width,canvas.height/bitmap.height);
  ctx.drawImage(bitmap,(canvas.width-bitmap.width*scale)/2,(canvas.height-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);
  $('image-status').textContent=(file.name||'Pasted image')+' · '+bitmap.width+'×'+bitmap.height+' px · '+(file.size/1024).toFixed(0)+' KB. Click Convert image to robot paths.';
 }finally{bitmap.close()}
}
$('image-file').onchange=async e=>{try{await loadImage(e.target.files?.[0])}catch(err){$('image-status').textContent=err.message}};
const dropzone=$('image-dropzone');
dropzone.onclick=()=>$('image-file').click();
dropzone.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('image-file').click()}};
dropzone.ondragover=e=>{e.preventDefault();dropzone.classList.add('dragging')};
dropzone.ondragleave=()=>dropzone.classList.remove('dragging');
dropzone.ondrop=async e=>{
 e.preventDefault();dropzone.classList.remove('dragging');
 const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));
 try{await loadImage(file)}catch(err){$('image-status').textContent=err.message}
};
window.addEventListener('paste',async e=>{
 if(writingInputMode()!=='image')return;
 const f=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();
 if(f){e.preventDefault();try{await loadImage(f)}catch(err){$('image-status').textContent=err.message}}
});
async function convertImage(){
 if(!imageSource)throw Error('Upload or paste an image first.');
 $('image-status').textContent='Tracing image contours…';
 convertedImage=await interpretImage(imageSource,{mode:$('image-style').value,detail:Number($('image-detail').value)});
 const strokes=convertedImage.strokes;
 $('image-status').textContent=strokes.length+' '+convertedImage.meta.style+' line-art strokes generated from '+convertedImage.meta.fileName+'. Preview and export ready.';
 const canvas=$('image-outline-preview'),ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const bounds=strokes.flatMap(v=>v.points),xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const scale=Math.min((canvas.width-24)/Math.max(.0001,maxX-minX),(canvas.height-24)/Math.max(.0001,maxY-minY));
 ctx.strokeStyle='#202a3b';ctx.lineWidth=1.3;ctx.lineJoin='round';ctx.lineCap='round';
 for(const stroke of strokes){
  if(stroke.points.length<2)continue;
  ctx.beginPath();
  const [x,y]=stroke.points[0];ctx.moveTo(12+(x-minX)*scale,12+(y-minY)*scale);
  for(const p of stroke.points.slice(1))ctx.lineTo(12+(p[0]-minX)*scale,12+(p[1]-minY)*scale);
  ctx.stroke();
 }
 const planned=await planCurrentInput();
 if(fixedPen())planned.points=planned.points.map(p=>({...p,lift:0}));
 renderWritingPreview(planned);
 setExport(planned,{inputType:'image',...convertedImage.meta});
 message(planned.points.length+' joint waypoints prepared. Color layers are virtual. Click Plan & simulate to animate.');
 return planned;
}
$('image-convert').onclick=async()=>{
 try{await convertImage()}catch(err){convertedImage=null;setExport(null,null);$('image-status').textContent='Conversion failed: '+err.message;message(err.message,true)}
};
$('export-json').onclick=()=>{try{exportDesignFiles(lastExportPlan,lastDesignSource).json()}catch(e){message(e.message,true)}};
$('export-csv').onclick=()=>{try{exportDesignFiles(lastExportPlan,lastDesignSource).csv()}catch(e){message(e.message,true)}};
syncInputMode();
async function planCurrentInput(){
 const speed=Number($('speed').value)/1000,mode=writingInputMode(),color=virtualPen();
 if(mode==='latin'){
  const p=planWriting($('message').value,speed);
  p.points=p.points.map(point=>({...point,color}));
  return p;
 }
 if(mode==='draw'){
  const strokes=drawPad.getStrokes();return planStrokes(strokes,speed,strokes.map(()=>color));
 }
 if(mode==='hindi'){
  const strokes=await hindiTextToStrokes($('message').value);
  const p=planStrokes(strokes,speed,strokes.map(()=>color));p.text=$('message').value;return p;
 }
 if(mode==='image'){
  if(!convertedImage)throw Error('Convert your uploaded image to robot paths first.');
  const strokes=convertedImage.strokes;
  const p=planStrokes(strokes.map(s=>s.points),speed,strokes.map(s=>s.color));p.text=convertedImage.meta.fileName;
  return p;
 }
 throw Error('Unknown design mode');
}
async function currentHardwarePayload(){
 const mode=writingInputMode(),speedMmPerSecond=Number($('speed').value);
 // No physical color-changer exists; image/multicolor execution is SIMULATION ONLY.
 if(mode==='image')throw Error('Image and colored-pen switching are simulation-only. Manual tool changes are not calibrated.');
 if(mode==='latin')return{mode,text:$('message').value,speedMmPerSecond};
 const strokes=mode==='draw'?drawPad.getStrokes():await hindiTextToStrokes($('message').value);
 return{mode,strokes,speedMmPerSecond,text:mode==='hindi' ? $('message').value : ''};
}

async function beginWriting(){
 stop();clearInk();setStatus('PLANNING');
 try{
   const planned=await planCurrentInput();
   plan=planned;
   if(fixedPen())plan.points=plan.points.map(point=>({...point,lift:0}));
   renderWritingPreview(plan);
   setExport(plan,writingInputMode()==='image'?{inputType:'image',...convertedImage.meta}:{inputType:writingInputMode(),text:$('message').value,virtualPen:virtualPen()});
   planIndex=0;planClock=0;playbackElapsed=0;completionHold=0;playbackDuration=plan.points.reduce((sum,p)=>sum+p.dt,0);playing=true;paused=false;previous=null;
   setStatus(fixedPen()?'WRITING · PEN FIXED':'WRITING · PEN LIFT');
   message(plan.strokes+' strokes · '+plan.estimatedDuration.toFixed(1)+' s · '+plan.points.length+' waypoints. '+(fixedPen()?'Without lift, every travel route marks the paper.':'Virtual lift separates all outlines and strokes.'));
   $('progress').textContent='0%';
   return plan;
 }catch(e){plan=null;message(e.message,true);setStatus('PLANNING ERROR');return null}
}
$('write').onclick=beginWriting;$('pause').onclick=()=>{if(!playing)return;paused=!paused;$('pause').textContent=paused?'Resume':'Pause';setStatus(paused?'PAUSED':'WRITING')};
$('clear').onclick=clearInk;$('home').onclick=()=>{stop();targetQ=[-.85,1.4,-.55];targetLift=.012;updateSlider()};
$('reset').onclick=()=>{stop();clearInk();targetQ=[-.85,1.4,-.55];updateSlider();physics?.reset();physicsTime=0;message('Reset to the default joint configuration.')};
$('speed').oninput=e=>$('speed-label').textContent=e.target.value+' mm/s';
$('message').oninput=e=>{$('count').textContent=e.target.value.length+'/24';setExport(null,null)};
$('pen-color').onchange=()=>{setExport(null,null);renderWritingPreview(null)};
document.querySelectorAll('input[name="pen-mode"]').forEach(radio=>radio.addEventListener('change',()=>{
 if(playing)stop();clearInk();
 $('pen-mode-hint').textContent=fixedPen()?'No-lift visualization: pen stays at the paper level throughout; travel paths leave visible orange marks. Simulation only.':'Virtual pen lift (12 mm) between strokes. No physical lift is installed.';
 // Re-preview only after pressing Plan & simulate (Hindi tracing is asynchronous).
 renderWritingPreview(null)
 message(fixedPen()?'Fixed pen selected. The next simulation will leave travel marks.':'Virtual pen-lift simulation selected.');
}));
renderWritingPreview(null);
$('physics').onclick=async()=>{
 const button=$('physics');if(physics){physics.dispose();physics=null;button.textContent='Start MuJoCo physics';$('engine-badge').textContent='KINEMATIC';$('engine-info').textContent='Kinematic mode. Turn on physics to see motor following and dynamics.';return}
 button.disabled=true;button.textContent='Loading physics…';
 try{const {startPhysics}=await import('./mujoco-physics.js');physics=await startPhysics();physics.reset();$('engine-badge').textContent='MUJOCO WASM';button.textContent='Switch to kinematics';$('engine-info').textContent='MuJoCo position-actuator dynamics active; 3 hinge joints and 1 auxiliary pen-lift slide. Contact shapes remain simplified.';setStatus('MUJOCO READY')}
 catch(e){physics=null;button.textContent='Retry MuJoCo physics';$('engine-info').textContent='MuJoCo initialization failed: '+String(e.message);setStatus('KINEMATIC FALLBACK')}
 finally{button.disabled=false}
};
function animatePlan(dt){
 if(!playing||paused||!plan)return;
 const rate=physics?Number($('physics-rate').value||.35):1;
 playbackElapsed=Math.min(playbackDuration,playbackElapsed+dt*rate);
 const state=sampleTimedPlan(plan.points,playbackElapsed);
 if(!state)return;
 planIndex=state.index;
 targetQ=state.q;targetLift=state.lift;
 // Keep reference at the final point until the torque-limited robot catches up,
 // but never fabricate the ink trail of a motor that cannot reach it.
 if(playbackElapsed>=playbackDuration){
   completionHold+=dt;
   const settled=!physics||trackingErrorM<.0015;
   if(settled||completionHold>4){
     const error=trackingErrorM;
     const total=plan.points.length;
     const incomplete=physics&&error>=.0015;
     stop();
     $('progress').textContent=(incomplete?'FINISHED WITH TRACKING LAG':'COMPLETE')+' · '+total+' steps';
     message(incomplete
      ?'MuJoCo could not reach the final target within 4 s. Final pen error ≈ '+(error*1000).toFixed(1)+' mm. Slow playback further or adjust the path.'
      :'Trajectory finished; simulated writing follows tracked pen pose.');
   }
 }else $('progress').textContent=Math.round(100*playbackElapsed/Math.max(.001,playbackDuration))+'%';
 updateSlider();
}
let last=performance.now();
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.08,Math.max(0,(t-last)/1000));last=t;
 animatePlan(dt);
 if(physics){
 try{
   const sample=physics.step(targetQ,targetLift,dt);
   displayQ=sample.q.slice(0,3);actualLift=sample.q[3];physicsTime+=dt;
   trackingErrorRad=sample.errorRad;
   const desired=forward(targetQ),observed=forward(displayQ);
   trackingErrorM=Math.hypot(desired[0]-observed[0],desired[1]-observed[1]);
   $('tracking-error').textContent='Pen tracking error '+(trackingErrorM*1000).toFixed(2)+' mm · max joint error '+(trackingErrorRad*180/Math.PI).toFixed(1)+'°. Ink follows actual simulated pen.';
   $('tracking-error').classList.toggle('error',trackingErrorM>.003);
 }
 catch(e){$('engine-info').textContent='MuJoCo error, using kinematic fallback: '+String(e.message);physics?.dispose();physics=null;}
 }else{const a=Math.min(1,dt*24);displayQ=displayQ.map((q,i)=>q+(targetQ[i]-q)*a);actualLift+=(targetLift-actualLift)*a;trackingErrorM=0;trackingErrorRad=0;}
 if(uno?.connected && hw('uno-follow')?.checked && uno.estimatedQ) {
   displayQ=[...uno.estimatedQ];
   // No Z/servo feedback available. Lift remains commanded, not physically verified.
   actualLift=targetLift;
   hw('runtime').textContent='UNO / OPEN-LOOP ESTIMATE';
 }else {
   hw('runtime').textContent=physics?'3R / MUJOCO':'3R / PLANAR XY';
 }
 if(uno?.connected && uno.estimatedQ){
   hw('hardware-pose').textContent='Uno estimated J1/J2/J3: '+uno.estimatedQ.map(v=>(v*180/Math.PI).toFixed(1)+'°').join(' / ')+' (steps only)';
 }
 setJointDisplay(displayQ,actualLift);
 const p=actualTip();$('tip').textContent='x '+(p.x*1000).toFixed(1)+' · y '+(p.y*1000).toFixed(1)+' · z '+(p.z*1000).toFixed(1)+' mm';
 $('feedback').textContent=displayQ.map((q,i)=>'J'+(i+1)+' '+(q*180/Math.PI).toFixed(1)+'°').join(' · ');
 $('lift').textContent=(actualLift*1000).toFixed(1)+' mm';
 const currentPoint=plan?.points[Math.min(planIndex,plan.points.length-1)];
 if(currentPoint?.color && nib.material?.color)nib.material.color.set(currentPoint.color);
 if(playing&&!paused&&currentPoint&&planIndex>0&&actualLift<.0035&&(currentPoint.ink||fixedPen())){
   putInk(p,!currentPoint.ink,currentPoint.color||'#1c2638');
 }else previous=null;
 controls.update();renderer.render(scene,camera)
}
const resize=new ResizeObserver(()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height)});resize.observe(host);
updateSlider();requestAnimationFrame(frame);


// Local hardware bridge: a remote HTTP API cannot operate a USB serial port.
let uno = null;
const hw = id => document.getElementById(id);
function hwStatus(message, error=false) {
  hw('uno-status').textContent = message;
  hw('uno-status').classList.toggle('error',error);
  hwUpdate();
}
function hwUpdate() {
  const connected = !!uno?.connected, armed = !!uno?.armed, calibrated = !!uno?.calibrated, busy=!!uno?.busy;
  hw('hardware-badge').textContent = connected ? armed ? 'ARMED' : 'USB CONNECTED' : 'DISCONNECTED';
  hw('uno-connect').textContent = connected ? 'Disconnect USB' : 'Connect USB';
  hw('uno-connect').disabled = busy;
  hw('uno-zero').disabled = !connected || armed || busy;
  hw('uno-arm').disabled = !connected || !calibrated || armed || busy;
  hw('uno-jog').disabled = !connected || !armed || busy;
  hw('uno-write').disabled = !connected || !armed || busy || writingInputMode()==='image';
  hw('uno-disarm').disabled = !connected || !armed || busy;
  hw('uno-stop').disabled = !connected;
}
hw('uno-connect').onclick = async () => {
  const button=hw('uno-connect'); button.disabled=true;
  try {
    if (uno?.connected) { await uno.disconnect(); uno=null; hwStatus('USB disconnected.'); }
    else {
      const {UnoBridge}=await import('./uno-bridge.js');
      uno = new UnoBridge(msg=>hwStatus(msg,msg.startsWith('ERR')||msg.startsWith('FAULT')));
      await uno.connect();
      hwStatus('Uno connected. Pen lift installed: '+(uno.penLiftInstalled?'YES':'NO')+'. Set mechanical zero before arming.');
    }
  } catch(e) {hwStatus('Connect failed: '+e.message,true)}
  finally {button.disabled=false;hwUpdate()}
};
hw('uno-zero').onclick = async () => {
  if(!confirm('With motor drivers DISABLED, have you physically aligned all 3 joints to the documented zero marks? This is NOT automatic homing.'))return;
  try {await uno.setZero();hwStatus('Logical joint zero set. This is not encoder feedback or homing.')}
  catch(e){hwStatus(e.message,true)}finally{hwUpdate()}
};
hw('uno-arm').onclick = async () => {
  if(!confirm('Physical emergency power cutoff fitted, workspace clear, motor drivers configured and zero alignment verified? Enable the external motor drivers?'))return;
  try{await uno.arm();hwStatus('Drivers armed. Perform only a small pen-up jog first.')}
  catch(e){hwStatus(e.message,true)}finally{hwUpdate()}
};
hw('uno-jog').onclick = async () => {
  try {
    await uno.jog(targetQ);
    hwStatus('Pen-up jog command accepted. No position encoder is connected.');
  } catch(e) {hwStatus(e.message,true)}
  finally {hwUpdate()}
};
hw('uno-disarm').onclick = async () => {
  try{await uno.disarm();hwStatus('Drivers disarmed.')}
  catch(e){hwStatus(e.message,true)}finally{hwUpdate()}
};
hw('uno-stop').onclick = async () => {
  stop();
  try{await uno.stop();hwStatus('STOP sent. Verify driver power physically. Set zero again before arming.')}
  catch(e){hwStatus('STOP transmit failed: '+e.message+'. USE PHYSICAL E-STOP.',true)}
  finally{hwUpdate()}
};
hw('uno-write').onclick = async () => {
  if(!uno?.armed || uno.busy)return;
  if(writingInputMode()==='image'){hwStatus('Multicolor image writing is simulation-only; no physical pen changer is installed.',true);return;}
  if(!uno.penLiftInstalled){hwStatus('Uno reports no pen lift. Firmware must be configured and tested before pen-down writing.',true);return;}
  if(!confirm('Send this writing plan to the REAL robot? Keep one hand near the physical emergency power cutoff. The arm is open-loop and axes are not calibrated.'))return;
  try {
    hw('uno-progress').textContent='Validating entire trajectory…';
    const requestPayload=await currentHardwarePayload();
    const response=await fetch('/api/plan',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(requestPayload)
    });
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.error||'Planning request failed');
    hwStatus('Validated '+payload.points.length+' target points. Sending to Uno...');
    const twinPlan=await beginWriting(); // Digital twin playback; NOT measured robot feedback.
    if(!twinPlan)throw Error('Local simulator could not validate this path.');
    hwUpdate();
    await uno.run(payload.points,(done,total)=>{
      hw('uno-progress').textContent='Target stream '+Math.round(done/total*100)+'% · '+done+'/'+total;
    });
    hwStatus('Target stream finished. Motion is NOT independently verified (open-loop steppers).');
  } catch(e) {
    stop(); hwStatus('Hardware execution stopped: '+e.message,true);
  } finally { hwUpdate(); }
};
document.querySelectorAll('input[name="write-input-mode"]').forEach(r=>r.addEventListener('change',hwUpdate));
const oldPause=hw('pause').onclick;
hw('pause').onclick=(e)=>{
  if(uno?.busy){ hw('uno-stop').click(); hwStatus('Physical execution cannot be paused safely; STOP requested.');return; }
  oldPause?.(e);
};
window.addEventListener('pagehide',()=>{if(uno?.connected)uno.send('STOP').catch(()=>{});});
hwUpdate();
