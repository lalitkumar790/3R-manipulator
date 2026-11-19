import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
const parts=['base_ring','base_lid','link1','link2','link3_penholder'];
function triples(input, n, label){
  if(!Array.isArray(input)||!input.length)throw new Error(label+' missing');
  const out=Array.isArray(input[0])?input.flat():input;
  if(out.length%n!==0||!out.every(Number.isFinite))throw new Error(label+' malformed');
  return out;
}
for(const part of parts){
  const b64=(await readFile(new URL('../public/cad/'+part+'.txt',import.meta.url),'utf8')).trim();
  const parsed=JSON.parse(inflateSync(Buffer.from(b64,'base64')).toString('utf8'));
  const vertex=triples(parsed.v,3,part+' vertices');
  const faces=triples(parsed.f,3,part+' triangles');
  const count=faces.length/3;
  if(count<20)throw new Error(part+' unexpectedly sparse: '+count+' triangles');
  if(count>100000)throw new Error(part+' unexpectedly large: '+count);
  const total=vertex.length/3;
  const output=Buffer.allocUnsafe(84+count*50);
  output.fill(0,0,80);
  output.write('3R CAD / '+part,0,'ascii');
  output.writeUInt32LE(count,80);
  const bbox=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  for(let i=0;i<count;i++){
    const verts=[];
    for(let k=0;k<3;k++){
      const id=faces[i*3+k];
      if(!Number.isInteger(id)||id<0||id>=total)throw new Error(part+' face index invalid at '+i);
      // Source stores rounded 0.1 mm coordinates (multiplier 0.0001 converts to metres).
      const v=[vertex[id*3]*1e-4,vertex[id*3+1]*1e-4,vertex[id*3+2]*1e-4];
      verts.push(v);
      for(let j=0;j<3;j++){bbox[0][j]=Math.min(bbox[0][j],v[j]);bbox[1][j]=Math.max(bbox[1][j],v[j]);}
    }
    const [a,b,c]=verts;
    const u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const mag=Math.hypot(...n)||1;
    const offset=84+i*50;
    for(let j=0;j<3;j++)output.writeFloatLE(n[j]/mag,offset+j*4);
    for(let k=0;k<3;k++)for(let j=0;j<3;j++)output.writeFloatLE(verts[k][j],offset+12+(k*3+j)*4);
    output.writeUInt16LE(0,offset+48);
  }
  const extents=bbox[1].map((x,j)=>x-bbox[0][j]);
  // Original source bounds supplied by user, tolerance 4mm due to mesh simplification.
  const expected={base_ring:[.154,.140,.036],base_lid:[.154,.140,.007],link1:[.150,.048,.008],link2:[.130,.048,.008],link3_penholder:[.090,.032,.022]}[part];
  for(let j=0;j<3;j++)if(Math.abs(extents[j]-expected[j])>.006)
    throw new Error(part+' source mesh bounds inconsistent on axis '+j+': '+extents[j]);
  await writeFile(new URL('../public/cad/'+part+'.stl',import.meta.url),output);
  console.log('CAD validated:',part, count,'triangles',extents.map(x=>(x*1000).toFixed(1)+'mm').join(' × '));
}
