import loadMujoco from '@mujoco/mujoco';
import mjcfUrl from './writing-scene.xml?raw';
/** Browser WebAssembly execution of the same MJCF bundled for local ROS/MuJoCo. */
export async function startPhysics(){
 const mujoco=await loadMujoco();
 const model=mujoco.MjModel.from_xml_string(mjcfUrl);
 if(!model)throw new Error('MuJoCo failed to compile the MJCF scene');
 const data=new mujoco.MjData(model);
 const zero=[-.85,1.4,-.55,.012];
 const reset=()=>{mujoco.mj_resetData(model,data);for(let i=0;i<4;i++){data.qpos[i]=zero[i];data.ctrl[i]=zero[i]}mujoco.mj_forward(model,data)};
 reset();
 return{reset,step(target,lift,n=5){for(let j=0;j<3;j++)data.ctrl[j]=Math.max(-Math.PI,Math.min(Math.PI,target[j]));data.ctrl[3]=Math.max(0,Math.min(.012,lift));for(let i=0;i<Math.min(n,40);i++)mujoco.mj_step(model,data);return Array.from(data.qpos.slice(0,4));},dispose(){data.delete();model.delete()}};
}
