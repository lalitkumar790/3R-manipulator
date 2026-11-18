import loadMujoco from '@mujoco/mujoco';

// Physical MuJoCo model with the same rigid-body tree and joint transforms as scene.xml.
// Concave source STL geometry belongs to the visual layer. Simple collision proxies
// are used so MuJoCo can safely integrate contact, actuation, damping and inertia.
const MJCF = `<mujoco model="3R-manipulator-web-physics">
 <compiler angle="radian" autolimits="true"/>
 <option timestep="0.002" gravity="0 0 -9.81" integrator="implicitfast"/>
 <worldbody>
  <geom name="desk" type="plane" pos="0 0 0" size=".5 .5 .01" friction=".9 .005 .0001"/>
  <body name="fixed_base">
   <geom type="cylinder" size=".065 .020" pos="0 0 .020" contype="0" conaffinity="0"/>
   <body name="link1" pos="0 0 .055">
    <joint name="joint1" type="hinge" axis="0 0 1" range="-3.14159 3.14159" damping=".04" armature=".001"/>
    <inertial pos=".065 0 .004" mass=".20" diaginertia=".0007 .0007 .0002"/>
    <geom name="link1_collision" type="capsule" fromto="0 0 .004 .120 0 .004" size=".014" contype="1" conaffinity="1"/>
    <body name="link2" pos=".120 0 .014">
     <joint name="joint2" type="hinge" axis="0 0 1" range="-3.14159 3.14159" damping=".025" armature=".0006"/>
     <inertial pos=".055 0 .004" mass=".16" diaginertia=".0004 .0004 .00015"/>
     <geom name="link2_collision" type="capsule" fromto="0 0 .004 .100 0 .004" size=".012" contype="1" conaffinity="1"/>
     <body name="link3" pos=".100 0 .014">
      <joint name="joint3" type="hinge" axis="0 0 1" range="-3.14159 3.14159" damping=".015" armature=".0003"/>
      <inertial pos=".035 0 .011" mass=".10" diaginertia=".00016 .00016 .00007"/>
      <geom name="link3_collision" type="capsule" fromto="0 0 .011 .070 0 .011" size=".010" contype="1" conaffinity="1"/>
      <site name="pen_tip" pos=".028 0 -.078" size=".003"/>
     </body>
    </body>
   </body>
  </body>
 </worldbody>
 <actuator>
  <position name="stepper1" joint="joint1" kp="6" ctrlrange="-3.14159 3.14159" forcerange="-1.5 1.5"/>
  <position name="stepper2" joint="joint2" kp="4" ctrlrange="-3.14159 3.14159" forcerange="-1 1"/>
  <position name="stepper3" joint="joint3" kp="2" ctrlrange="-3.14159 3.14159" forcerange="-.5 .5"/>
 </actuator>
 <sensor><jointpos joint="joint1"/><jointpos joint="joint2"/><jointpos joint="joint3"/></sensor>
</mujoco>`;
export async function startPhysics(){
 const mujoco=await loadMujoco();
 const model=mujoco.MjModel.from_xml_string(MJCF);
 if(!model) throw new Error('MuJoCo model XML could not compile');
 const data=new mujoco.MjData(model);
 mujoco.mj_forward(model,data);
 return {
  step(target,n=5){for(let j=0;j<3;j++)data.ctrl[j]=Math.max(-Math.PI,Math.min(Math.PI,target[j]));for(let i=0;i<n;i++)mujoco.mj_step(model,data);return [data.qpos[0],data.qpos[1],data.qpos[2]]},
  dispose(){data.delete();model.delete()}
 };
}
