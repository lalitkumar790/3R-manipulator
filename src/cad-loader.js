import * as THREE from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
const names=['base_ring','base_lid','link1','link2','link3_penholder'];
const source=new STLLoader();
/**
 * The five real STL source shapes are transformed to lightweight CAD-derived
 * STL assets at build time by scripts/prepare-cad.mjs.
 * The browser never needs a CAD upload or a decompression extension.
 * Positions in source STL are in local part frames, already scaled to metres.
 */
export async function attachCad(parts,onProgress=()=>{}){
 let count=0,errors=[];
 await Promise.all(names.map(async name=>{
   try{
     const part=parts[name];if(!part)throw new Error('No parent group');
     const response=await fetch('/cad/'+name+'.stl',{cache:'force-cache'});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const geometry=source.parse(await response.arrayBuffer());
     geometry.computeBoundingBox();
     const size=new THREE.Vector3();geometry.boundingBox.getSize(size);
     if(!Number.isFinite(size.x)||size.x<.03||size.x>.25)
       throw new Error('Invalid CAD geometry bounds');
     const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
       color:part.color,metalness:.16,roughness:.68,side:THREE.DoubleSide
     }));
     mesh.castShadow=true;mesh.receiveShadow=true;
     if(part.offset)mesh.position.set(...part.offset);
     part.parent.add(mesh);
     for(const old of part.replace||[])old.visible=false;
     count++;onProgress(count,names.length,name);
   }catch(e){errors.push(name+': '+e.message);console.error('CAD missing',name,e);onProgress(count,names.length,name,e)}
 }));
 if(errors.length)console.error('CAD assets failed:',errors.join('; '));
 return {loaded:count,errors};
}
