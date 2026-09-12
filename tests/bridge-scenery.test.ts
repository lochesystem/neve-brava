import {afterEach,describe,expect,it} from "vitest";
import * as THREE from "three";
import {setActiveCourse,courseTerrainHeight} from "../src/core/course.ts";
import {bridgeGroundPoint,createDesertScenery,createDesertFormations,normalizeDesertRock} from "../src/view/desertScenery.ts";
afterEach(()=>setActiveCourse("vale-bravo"));
describe("lower bridge scenery",()=>{
  it("anchors imported rocks without distortion and batches all variants outside the track",()=>{
    setActiveCourse("canion-ferrugem");
    const models=[1,2,3].map(height=>{
      const scene=new THREE.Group();
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,height,1),new THREE.MeshBasicMaterial());
      mesh.position.set(5,7,3);scene.add(mesh);
      const model=normalizeDesertRock(scene);
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y).toBeCloseTo(0);
      expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0);
      expect(size.y/size.x).toBeCloseTo(height/2);
      return model;
    });
    const root=createDesertFormations(models);
    const geometrySet=new Set<THREE.BufferGeometry>();
    root.traverse(object=>{
      if(!(object instanceof THREE.InstancedMesh))return;
      geometrySet.add(object.geometry);
      expect(object.count).toBeLessThanOrEqual(3);
      expect(object.userData.persistentEnvironmentAsset).toBe(true);
      const matrix=new THREE.Matrix4();
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        const scale=new THREE.Vector3().setFromMatrixScale(matrix);
        expect(scale.x).toBeCloseTo(scale.y,4);
        expect(scale.x).toBeCloseTo(scale.z,4);
      }
    });
    expect(geometrySet.size).toBe(3);
  });
  it("joins the route exactly and leaves a gently sloped shoulder",()=>{
    const c=setActiveCourse("canion-ferrugem"),f=c.forks![0];
    for(let s=f.start;s<=f.end;s+=10){
      const edge=bridgeGroundPoint(s,0);
      expect(edge.y).toBeCloseTo(courseTerrainHeight(s,f.left),7);
      expect(Math.abs(bridgeGroundPoint(s,7).y-edge.y)).toBeLessThan(.1);
      for(let d=0;d<450;d+=5)expect(Math.abs(bridgeGroundPoint(s,d+5).y-bridgeGroundPoint(s,d).y)).toBeLessThan(.65);
    }
  });
  it("builds smooth indexed terrain and reproducible non-row rock scatter",()=>{
    setActiveCourse("canion-ferrugem");
    const a=createDesertScenery(),b=createDesertScenery();
    const ground=a.getObjectByName("bridge-lower-ground") as THREE.Mesh;
    expect(ground.geometry.index).not.toBeNull();
    expect(ground.geometry.getAttribute("color").count).toBe(ground.geometry.getAttribute("position").count);
    const stones=a.getObjectByName("bridge-scattered-stones") as THREE.InstancedMesh;
    const again=b.getObjectByName("bridge-scattered-stones") as THREE.InstancedMesh;
    expect(stones.count).toBeGreaterThan(30);
    expect(stones.instanceMatrix.array).toEqual(again.instanceMatrix.array);
    const sizes=new Set<number>(),m=new THREE.Matrix4();
    for(let i=0;i<stones.count;i++){stones.getMatrixAt(i,m);expect(m.elements.every(Number.isFinite)).toBe(true);sizes.add(Math.round(new THREE.Vector3().setFromMatrixScale(m).x*100));}
    expect(sizes.size).toBeGreaterThan(25);
    for(const root of [a,b])root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});
  });
});
