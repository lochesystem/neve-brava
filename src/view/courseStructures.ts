import * as THREE from "three";
import { getActiveCourse, courseWorldPoint, courseHeight, courseTerrainHeight } from "../core/course.ts";

/** Low-poly, opaque ice shells: no transparency or extra render passes. */
export function createCourseStructures(): THREE.Group {
  const group = new THREE.Group();
  const ice = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  function finishIce(geometry: THREE.BufferGeometry) {
    const flat=geometry.toNonIndexed(), count=flat.getAttribute("position").count, colors:number[]=[];
    for(let i=0;i<count;i++) {
      const tint=new THREE.Color(0x91c9e2).multiplyScalar(.83 + .17*Math.sin(Math.floor(i/3)*2.399));
      colors.push(tint.r,tint.g,tint.b);
    }
    flat.setAttribute("color",new THREE.Float32BufferAttribute(colors,3)); flat.computeVertexNormals(); geometry.dispose();
    group.add(new THREE.Mesh(flat,ice));
  }
  function strip(start: number, end: number, ax: number, ay: number, bx: number, by: number, taper = false) {
    const vertices: number[] = [], indices: number[] = [];
    const steps = Math.ceil((end - start) / 8);
    for (let i = 0; i <= steps; i++) {
      const s = start + (end - start) * i / steps;
      for (const [x, y] of [[ax, ay], [bx, by]]) {
        const world = courseWorldPoint(s, x);
        const rise=taper ? Math.sin(Math.PI*i/steps)**.5 : 1;
        vertices.push(world.x, courseHeight(s) + y*rise, world.z);
      }
      if (i < steps) { const n = i * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    finishIce(geometry);
  }
  for (const t of getActiveCourse().tunnels ?? []) {
    strip(t.start,t.end,-t.halfWidth,-1,-t.halfWidth,3);
    strip(t.start,t.end,t.halfWidth,-1,t.halfWidth,3);
    for(let i=0;i<16;i++) {
      const a=i/16*Math.PI,b=(i+1)/16*Math.PI;
      const inner=(angle:number)=>[Math.cos(angle)*t.halfWidth,3+Math.sin(angle)*(t.height-3)];
      const outer=(angle:number)=>[Math.cos(angle)*(t.halfWidth+12),-1+Math.sin(angle)*(t.height+12)];
      const [ax,ay]=inner(a),[bx,by]=inner(b),[cx,cy]=outer(a),[dx,dy]=outer(b);
      strip(t.start,t.end,ax,ay,bx,by);
      strip(t.start,t.end,cx,cy,dx,dy);
      for(const s of [t.start,t.end]) {
        const verts:number[]=[];
        for(const [x,y] of [[ax,ay],[bx,by],[cx,cy],[dx,dy]]) {
          const p=courseWorldPoint(s,x); verts.push(p.x,courseHeight(s)+y,p.z);
        }
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
        geometry.setIndex([0,1,2,1,3,2]); finishIce(geometry);
      }
    }
  }
  for (const f of getActiveCourse().forks ?? []) {
    // Low rope edging makes the soft lateral limit visible without blocking the view.
    const edges=f.bridge ? [-getActiveCourse().halfWidth,f.left] : [-getActiveCourse().halfWidth,f.left,f.right,getActiveCourse().halfWidth];
    const posts:THREE.Vector3[]=[],vertices:number[]=[];
    const location=(s:number,x:number,y:number)=>{const p=courseWorldPoint(s,x);return new THREE.Vector3(p.x,courseTerrainHeight(s,x)+y,p.z);};
    for(const x of edges){
      for(let s=f.start;s<=f.end;s+=12)posts.push(location(s,x,.36));
      for(let s=f.start;s<f.end;s+=4){
        const end=Math.min(s+4,f.end);
        const a=location(s,x,.48),b=location(end,x,.48),c=a.clone().add(new THREE.Vector3(0,.055,0)),d=b.clone().add(new THREE.Vector3(0,.055,0));
        vertices.push(...a.toArray(),...b.toArray(),...c.toArray(),...c.toArray(),...b.toArray(),...d.toArray());
      }
    }
    const edging=new THREE.Group();edging.name="fork-soft-boundary";
    const postMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.085,.11,.72,5),new THREE.MeshLambertMaterial({color:0x527c78}),posts.length);
    const matrix=new THREE.Matrix4();posts.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);postMesh.setMatrixAt(i,matrix);});edging.add(postMesh);
    const ropeGeometry=new THREE.BufferGeometry();ropeGeometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));ropeGeometry.computeVertexNormals();
    edging.add(new THREE.Mesh(ropeGeometry,new THREE.MeshLambertMaterial({color:0xc9af7e,side:THREE.DoubleSide})));group.add(edging);
    if(f.bridge)continue;
    const middle=(f.left+f.right)/2;
    strip(f.start,f.end,f.left,0,middle,23,true);
    strip(f.start,f.end,middle,23,f.right,0,true);
  }
  return group;
}
