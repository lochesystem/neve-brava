import * as THREE from "three";
import { courseHeight, courseTerrainHeight, courseWorldPoint, getActiveCourse } from "../core/course.ts";

/** Independent lower terrain: the upper deck never determines this surface. */
export function bridgeGroundPoint(s:number,distance:number):THREE.Vector3 {
  const fork=getActiveCourse().forks?.find(f=>f.bridge&&s>=f.start&&s<=f.end);
  if(!fork)throw new Error("Bridge ground sampled outside its span");
  const edge=courseWorldPoint(s,fork.left);
  const t=Math.min(1,Math.max(0,distance/140));
  const smooth=t*t*(3-2*t);
  const ripple=(Math.sin(s*.023+distance*.043)+.5*Math.sin(s*.061-distance*.025))*1.1;
  return new THREE.Vector3(edge.x+distance,courseTerrainHeight(s,fork.left)-6*smooth+ripple*smooth,edge.z);
}

export function createDesertLodge():THREE.Group {
  const group=new THREE.Group();
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));m.position.set(x,y,z);group.add(m);};
  box(0,2.4,0,9,4.8,7,0xdba879);box(0,4.9,0,9.7,.45,7.7,0x965538);
  box(0,1.5,3.55,1.8,3,.12,0x60412f);
  for(const x of [-2.8,2.8])box(x,2.6,3.55,1.3,1.2,.13,0x397984);
  return group;
}

/** Shared static geometry and instances keep the canyon cheap on mobile. */
export function createDesertScenery(models: THREE.Group[] = []): THREE.Group {
  const group = new THREE.Group();
  const material = (color:number) => new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide});
  const wood=material(0x97613b),rope=material(0xd6bc84),sandstone=material(0xb9744c);
  const point=(s:number,x:number,rise=0)=>{
    const p=courseWorldPoint(s,x);return new THREE.Vector3(p.x,courseHeight(s,x)+rise,p.z);
  };
  const mesh=(vertices:number[],mat:THREE.Material)=>{
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.receiveShadow=true;group.add(m);
  };
  const quad=(out:number[],a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3)=>out.push(...a.toArray(),...b.toArray(),...c.toArray(),...c.toArray(),...b.toArray(),...d.toArray());
  for(const fork of getActiveCourse().forks ?? []) {
    if(!fork.bridge)continue;
    const deck:number[]=[],seams:number[]=[],cables:number[]=[];
    const posts:Array<THREE.Vector3>=[];
    // The platform follows the same world positions and heights as the riders.
    for(let s=fork.start;s<fork.end;s+=1.8) {
      const end=Math.min(fork.end,s+1.72);
      quad(deck,point(s,fork.right,.015),point(s,20,.015),point(end,fork.right,.015),point(end,20,.015));
      quad(seams,point(s,fork.right,.022),point(s,20,.022),point(s+.16,fork.right,.022),point(s+.16,20,.022));
      // Dark underside gives the crossing a visible thickness from below.
      quad(deck,point(s,fork.right,-.38),point(end,fork.right,-.38),point(s,20,-.38),point(end,20,-.38));
    }
    for(let s=fork.start;s<fork.end;s+=5)for(const x of [fork.right,20]) {
      const end=Math.min(s+5,fork.end);
      for(const height of [.8,2.2])quad(cables,point(s,x,height),point(s,x,height+.12),point(end,x,height),point(end,x,height+.12));
      if(Math.round((s-fork.start)/5)%2===0) posts.push(point(s,x,1.2));
    }
    mesh(deck,wood);mesh(seams,material(0x66452e));mesh(cables,rope);
    const inst=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.22,2.8,5),wood,posts.length);
    const matrix=new THREE.Matrix4();posts.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);inst.setMatrixAt(i,matrix);});group.add(inst);
    // One softly graded surface, not a flat bank glued to a differently colored floor.
    const groundPositions:number[]=[],groundColors:number[]=[],groundIndices:number[]=[];
    const supports:Array<{p:THREE.Vector3;h:number}>=[];
    const boulders:Array<{p:THREE.Vector3;size:number;rotation:number}>=[];
    const distances=[0,3,7,12,20,32,48,68,92,120,155,200,260,340,450];
    const count=Math.ceil((fork.end-fork.start)/7);
    const edgeColor=new THREE.Color(0xe9c38d).lerp(new THREE.Color(0xc39563),Math.abs(fork.left)/getActiveCourse().halfWidth*.34);
    const outsideColor=new THREE.Color(0xc39563);
    for(let row=0;row<=count;row++){
      const s=fork.start+(fork.end-fork.start)*row/count;
      distances.forEach((distance,column)=>{
        groundPositions.push(...bridgeGroundPoint(s,distance).toArray());
        const t=Math.min(1,distance/65),blend=t*t*(3-2*t);
        const color=edgeColor.clone().lerp(outsideColor,blend);
        color.multiplyScalar(1+Math.sin(s*.031+distance*.063)*.025*blend);
        groundColors.push(color.r,color.g,color.b);
        if(row<count&&column<distances.length-1){
          const a=row*distances.length+column,b=a+distances.length;
          groundIndices.push(a,b,a+1,a+1,b,b+1);
        }
      });
      if(row%9===0)for(const x of [fork.right+1,19]){
        const top=point(s,x,-.38);
        const distance=top.x-bridgeGroundPoint(s,0).x;
        if(distance<28)continue;
        const bottom=bridgeGroundPoint(s,distance),h=top.y-bottom.y;
        if(h>2)supports.push({p:new THREE.Vector3(top.x,bottom.y+h/2,top.z),h});
      }
    }
    const groundGeometry=new THREE.BufferGeometry();
    groundGeometry.setAttribute("position",new THREE.Float32BufferAttribute(groundPositions,3));
    groundGeometry.setAttribute("color",new THREE.Float32BufferAttribute(groundColors,3));
    groundGeometry.setIndex(groundIndices);groundGeometry.computeVertexNormals();
    const ground=new THREE.Mesh(groundGeometry,new THREE.MeshToonMaterial({color:0xfff8e7,vertexColors:true,side:THREE.DoubleSide}));
    ground.name="bridge-lower-ground";ground.receiveShadow=true;group.add(ground);
    let seed=getActiveCourse().scenerySeed>>>0;
    const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
    // Uneven clusters and clearings, from the shoulder outwards; no fixed offsets or rows.
    for(let center=fork.start+12;center<fork.end-12;center+=12+random()*27){
      const spread=10+random()*100;
      const members=1+Math.floor(random()*4);
      for(let i=0;i<members;i++){
        const s=Math.max(fork.start+2,Math.min(fork.end-2,center+(random()-.5)*19));
        const distance=Math.max(8,spread+(random()-.5)*24),size=.65+random()*1.9;
        boulders.push({p:bridgeGroundPoint(s,distance),size,rotation:random()*Math.PI*2});
      }
    }
    const pillars=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),wood,supports.length);
    supports.forEach((v,i)=>{matrix.compose(v.p,new THREE.Quaternion(),new THREE.Vector3(1.2,v.h,1.2));pillars.setMatrixAt(i,matrix);});
    group.add(pillars);
    const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),sandstone,boulders.length);
    boulders.forEach((v,i)=>{v.p.y+=v.size*.4;matrix.compose(v.p,new THREE.Quaternion().setFromEuler(new THREE.Euler(.12*Math.sin(i),v.rotation,.1*Math.cos(i))),new THREE.Vector3(v.size,v.size*.65,v.size*.8));stones.setMatrixAt(i,matrix);});
    stones.name="bridge-scattered-stones";
    group.add(stones);
  }
  group.add(createDesertFormations(models));
  return group;
}

/** Keep the GLB proportions, center horizontally and anchor the lowest vertex. */
export function normalizeDesertRock(model: THREE.Group): THREE.Group {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const normalized = new THREE.Group();
  normalized.add(model);
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  normalized.scale.setScalar(1 / Math.max(size.x, size.z, .001));
  normalized.updateMatrixWorld(true);
  return normalized;
}

export function createDesertFormations(models: THREE.Group[] = []): THREE.Group {
  const group = new THREE.Group();
  group.name = "desert-formations";
  const point=(s:number,x:number,rise=0)=>{
    const p=courseWorldPoint(s,x);return new THREE.Vector3(p.x,courseHeight(s,x)+rise,p.z);
  };
  const sandstone = new THREE.MeshLambertMaterial({color:0xb9744c});
  const formations:Array<{s:number;x:number;scale:THREE.Vector3}>=[];
  for(let s=30;s<getActiveCourse().length;s+=58)for(const side of [-1,1]){
    formations.push({s,x:side*(64+12*Math.sin(s*.037)),scale:new THREE.Vector3(22+8*Math.sin(s),28+15*(1+Math.sin(s*.024)),23)});
  }
  if (models.length) {
    sandstone.dispose();
    // Separate spatial batches retain frustum culling instead of one huge bound.
    for (let section=0;section<getActiveCourse().length;section+=350) {
      models.forEach((model, variant) => {
        const selected = formations.filter((f,i)=>i % 2 === 0 && Math.floor(i/2)%models.length===variant && f.s>=section && f.s<section+350);
        // Alternate sides independently of the density reduction.
        const placements = selected.map(f=>{
          const side = Math.floor(f.s/58)%2 ? -1 : 1;
          const bridge=getActiveCourse().forks?.find(b=>b.bridge&&f.s>=b.start&&f.s<=b.end);
          const width=42+14*(.5+.5*Math.sin(f.s*.077));
          const p=bridge ? point(f.s,-14,-12) : point(f.s,side*(78+18*Math.sin(f.s*.037)),-1.5);
          if(bridge) p.x+=side*(215+18*Math.sin(f.s*.024));
          return new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),f.s*.019),new THREE.Vector3(width,width,width));
        });
        if(!placements.length)return;
        model.updateMatrixWorld(true);
        model.traverse(object=>{
          if(!(object instanceof THREE.Mesh))return;
          const instances=new THREE.InstancedMesh(object.geometry,object.material,placements.length);
          instances.userData.persistentEnvironmentAsset=true;
          instances.receiveShadow=true;
          placements.forEach((matrix,i)=>instances.setMatrixAt(i,matrix.clone().multiply(object.matrixWorld)));
          instances.computeBoundingBox();instances.computeBoundingSphere();
          group.add(instances);
        });
      });
    }
    return group;
  }
  // Procedural fallback while the three GLBs load.
  const cliffs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.72,1,1,7,2),sandstone,formations.length);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion();
  formations.forEach((f,i)=>{
    const bridge=getActiveCourse().forks?.find(b=>b.bridge&&f.s>=b.start&&f.s<=b.end);
    const p=bridge ? point(f.s,-14,-12+f.scale.y*.45) : point(f.s,f.x,f.scale.y*.45);
    if(bridge){
      // Both canyon rims stand on the ravine floor, outside either playable route.
      p.x+=Math.sign(f.x)*(195+12*Math.sin(f.s*.024));
      f.scale.x*=2.8;f.scale.z*=2.5;
    }
    q.setFromAxisAngle(new THREE.Vector3(0,1,0),f.s*.01);matrix.compose(p,q,f.scale);cliffs.setMatrixAt(i,matrix);
  });
  cliffs.castShadow=true;group.add(cliffs);
  return group;
}
