import * as THREE from 'three';
const names=['base_ring','base_lid','link1','link2','link3_penholder'];
async function decode(name){
 const response=await fetch('/cad/'+name+'.txt');
 if(!response.ok)throw new Error(name+' mesh is not yet published');
 const base64=(await response.text()).trim();
 const raw=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 const ds=new DecompressionStream('deflate');
 const decoded=await new Response(new Blob([raw]).stream().pipeThrough(ds)).text();
 const {v,f}=JSON.parse(decoded);
 const pos=Float32Array.from(v,x=>x*.0001);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setIndex(f);geo.computeVertexNormals();
 return geo;
}
/** Source CAD derived from original supplied STL, quadric-reduced and position-quantized for web transfer.
 * Returned geometry is for visualization, not a convex collision body or mechanical fit verification. */
export async function attachCad(parts,onProgress=()=>{}){
 let count=0;
 await Promise.all(names.map(async name=>{
  try{
   const part=parts[name];if(!part)return;
   const geometry=await decode(name);
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:part.color,roughness:.42,metalness:.28,side:THREE.DoubleSide}));
   mesh.castShadow=true;mesh.receiveShadow=true;
   if(part.offset)mesh.position.set(...part.offset);
   part.parent.add(mesh);
   for(const old of part.replace||[])old.visible=false;
   count++;onProgress(count,5,name);
  }catch(err){console.warn('CAD asset:',name,err.message)}
 }));
 return count;
}
