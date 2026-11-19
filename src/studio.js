import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './studio.css';
import {planWriting,forward,inverse} from './writing.js';
import {attachCad} from './cad-loader.js';
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
const baseHousing=solid(base,new THREE.CylinderGeometry(.024,.024,.018,48),mat(0x435f7e),0,0,.048);baseHousing.rotation.x=Math.PI/2;
function bolt(parent,x,y,z){const b=solid(parent,new THREE.CylinderGeometry(.003,.003,.001,12),mat(0xbdd4e4),x,y,z);b.rotation.x=Math.PI/2}
for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2])bolt(base,.067*Math.cos(a),.058*Math.sin(a),.044);
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
const link1Visual=solid(j1,linkGeometry(1),blue);
const link2Visual=solid(j2,linkGeometry(2),amber);
const link3Visual=solid(j3,linkGeometry(3),mint);
const cadParts={
 base_ring:{parent:base,offset:[0,0,0],color:0x516b85,replace:[baseRingVisual]},
 base_lid:{parent:base,offset:[0,0,.036],color:0x8ba6b8,replace:[baseLidVisual]},
 link1:{parent:j1,color:0x54aafb,replace:[link1Visual]},
 link2:{parent:j2,color:0xe9b65c,replace:[link2Visual]},
 link3_penholder:{parent:j3,color:0x5bdfbc,replace:[link3Visual]}
};
attachCad(cadParts,(count,total,name)=>{
 const chip=document.getElementById('cad-status');
 if(chip)chip.textContent='CAD MESHES '+count+'/'+total;
}).then(count=>{
 const chip=document.getElementById('cad-status');
 if(chip)chip.textContent=count===5?'CAD MESHES READY':'CAD MESHES '+count+'/5';
});

function stepper(group,z){
 // Motoring envelope is illustrative; these bodies are not derived from original motor CAD.
 const housing=solid(group,new THREE.BoxGeometry(.032,.032,.020),mat(0x3b4b60,.45,.53),0,0,z-.017);
 solid(group,new THREE.CylinderGeometry(.008,.008,.006,30),steel,0,0,z-.005).rotation.x=Math.PI/2;
 return housing;
}
stepper(j1,0);stepper(j2,0);stepper(j3,0);
for(const g of [j1,j2,j3]){
 solid(g,new THREE.CylinderGeometry(.0065,.0065,.002,32),steel,0,0,.011).rotation.x=Math.PI/2;
}
const penCarrier=new THREE.Group();penCarrier.position.set(.060,0,0);j3.add(penCarrier);
const penBody=solid(penCarrier,new THREE.CylinderGeometry(.0032,.0032,.102,18),mat(0xe7f2fa,.18,.35),0,0,-.031);
penBody.rotation.x=Math.PI/2;
const nib=solid(penCarrier,new THREE.ConeGeometry(.0035,.007,20),mat(0xff6d96,.22,.45),0,0,-.079);
nib.rotation.x=Math.PI/2;
const tipObject=new THREE.Object3D();tipObject.position.z=-.082;penCarrier.add(tipObject);
const tipTmp=new THREE.Vector3();
function actualTip(){scene.updateMatrixWorld(true);return tipObject.getWorldPosition(tipTmp.clone());}
let targetQ=[-.85,1.4,-.55],displayQ=[...targetQ],targetLift=.012,actualLift=.012,physics=null,physicsTime=0,playing=false,paused=false,plan=null,planIndex=0,planClock=0,inkPoints=[],line=null,previous=null,slowAccumulator=0;
const inkMaterial=new THREE.LineBasicMaterial({color:0x174d9b,linewidth:2});
const sliders=[];
for(let i=0;i<3;i++){const d=document.createElement('div');d.className='ctrl';d.innerHTML='<label class="slider-head"><span>J'+(i+1)+' · '+['Base','Elbow','Pen holder'][i]+'</span><span class="val">0°</span></label>';const input=document.createElement('input');input.type='range';input.min=-180;input.max=180;input.step=.5;input.setAttribute('aria-label','Joint '+(i+1));input.addEventListener('input',()=>{playing=false;plan=null;targetQ[i]=Number(input.value)*Math.PI/180;targetLift=.012;setStatus('MANUAL CONTROL')});d.append(input);$('joint-controls').append(d);sliders.push({input,value:d.querySelector('.val')})}
function updateSlider(){sliders.forEach((s,i)=>{s.input.value=(targetQ[i]*180/Math.PI).toFixed(1);s.value.textContent=(targetQ[i]*180/Math.PI).toFixed(1)+'°'})}
function setStatus(text){$('status').textContent=text}
function message(text,isError=false){$('warning').textContent=text;$('warning').classList.toggle('error',isError)}
function setJointDisplay(q,lift){j1.rotation.z=q[0];j2.rotation.z=q[1];j3.rotation.z=q[2];penCarrier.position.z=lift;}
function putInk(p){if(!Number.isFinite(p.x)||p.z>.0035)return;const a=new THREE.Vector3(p.x,p.y,.0014);if(previous&&previous.distanceTo(a)>.008)previous=null;if(previous){inkPoints.push([previous.clone(),a]);const pts=inkPoints.flat();if(line){scene.remove(line);line.geometry.dispose()}line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),inkMaterial);scene.add(line)}previous=a}
function clearInk(){inkPoints=[];previous=null;if(line){scene.remove(line);line.geometry.dispose();line=null}}
function stop(){playing=false;paused=false;plan=null;targetLift=.012;$('pause').textContent='Pause';$('progress').textContent='IDLE';setStatus(physics?'MUJOCO READY':'KINEMATICS READY')}
function beginWriting(){
 stop();clearInk();
 try{plan=planWriting($('message').value,Number($('speed').value)/1000);planIndex=0;planClock=0;playing=true;paused=false;setStatus('WRITING');message(plan.strokes+' distinct pen-down strokes · planned '+plan.estimatedDuration.toFixed(1)+' s, '+plan.points.length+' trajectory samples. Virtual pen lift separates strokes.');$('progress').textContent='0%'}
 catch(e){plan=null;message(e.message,true);setStatus('PLANNING ERROR')}
}
$('write').onclick=beginWriting;$('pause').onclick=()=>{if(!playing)return;paused=!paused;$('pause').textContent=paused?'Resume':'Pause';setStatus(paused?'PAUSED':'WRITING')};
$('clear').onclick=clearInk;$('home').onclick=()=>{stop();targetQ=[-.85,1.4,-.55];targetLift=.012;updateSlider()};
$('reset').onclick=()=>{stop();clearInk();targetQ=[-.85,1.4,-.55];updateSlider();physics?.reset();physicsTime=0;message('Reset to the default joint configuration.')};
$('speed').oninput=e=>$('speed-label').textContent=e.target.value+' mm/s';
$('message').oninput=e=>$('count').textContent=e.target.value.length+'/24';
$('physics').onclick=async()=>{
 const button=$('physics');if(physics){physics.dispose();physics=null;button.textContent='Start MuJoCo physics';$('engine-badge').textContent='KINEMATIC';$('engine-info').textContent='Kinematic mode. Turn on physics to see motor following and dynamics.';return}
 button.disabled=true;button.textContent='Loading physics…';
 try{const {startPhysics}=await import('./mujoco-physics.js');physics=await startPhysics();physics.reset();$('engine-badge').textContent='MUJOCO WASM';button.textContent='Switch to kinematics';$('engine-info').textContent='MuJoCo position-actuator dynamics active; 3 hinge joints and 1 auxiliary pen-lift slide. Contact shapes remain simplified.';setStatus('MUJOCO READY')}
 catch(e){physics=null;button.textContent='Retry MuJoCo physics';$('engine-info').textContent='MuJoCo initialization failed: '+String(e.message);setStatus('KINEMATIC FALLBACK')}
 finally{button.disabled=false}
};
function animatePlan(dt){
 if(!playing||paused||!plan)return;
 let remaining=dt;
 while(remaining>0&&planIndex<plan.points.length){
 const s=plan.points[planIndex];const needed=s.dt-planClock;if(remaining<needed){planClock+=remaining;remaining=0;}else{remaining-=needed;planClock=0;planIndex++;}
 const cur=plan.points[Math.min(planIndex,plan.points.length-1)];
 const prev=plan.points[Math.max(0,planIndex-1)];
 const t=Math.min(1,planClock/Math.max(cur.dt,.00001));
 targetQ=cur.q.map((q,i)=>prev.q[i]+(q-prev.q[i])*t);
 targetLift=prev.lift+(cur.lift-prev.lift)*t;
 if(!cur.ink)previous=null;
 }
 if(planIndex>=plan.points.length){const total=plan.points.length;stop();$('progress').textContent='COMPLETE · '+total+' steps';message('Writing motion completed. The rendered ink represents the simulated pen-tip contact path.')}
 else $('progress').textContent=Math.round(100*planIndex/plan.points.length)+'%';
 updateSlider();
}
let last=performance.now();
function frame(t){requestAnimationFrame(frame);const dt=Math.min(.08,Math.max(0,(t-last)/1000));last=t;
 animatePlan(dt);
 if(physics){
 try{const sample=physics.step(targetQ,targetLift,Math.max(1,Math.round(dt/.002)));displayQ=sample.slice(0,3);actualLift=sample[3];physicsTime+=dt;}
 catch(e){$('engine-info').textContent='MuJoCo error, using kinematic fallback: '+String(e.message);physics?.dispose();physics=null;}
 }else{const a=Math.min(1,dt*24);displayQ=displayQ.map((q,i)=>q+(targetQ[i]-q)*a);actualLift+=(targetLift-actualLift)*a}
 setJointDisplay(displayQ,actualLift);
 const p=actualTip();$('tip').textContent='x '+(p.x*1000).toFixed(1)+' · y '+(p.y*1000).toFixed(1)+' · z '+(p.z*1000).toFixed(1)+' mm';
 $('feedback').textContent=displayQ.map((q,i)=>'J'+(i+1)+' '+(q*180/Math.PI).toFixed(1)+'°').join(' · ');
 $('lift').textContent=(actualLift*1000).toFixed(1)+' mm';
 if(playing&&!paused&&plan&&planIndex>0&&plan.points[Math.min(planIndex,plan.points.length-1)].ink&&actualLift<.0035)putInk(p);else previous=null;
 controls.update();renderer.render(scene,camera)
}
const resize=new ResizeObserver(()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height)});resize.observe(host);
updateSlider();requestAnimationFrame(frame);
