import {afterEach,it,expect} from "vitest";
import * as THREE from "three";
import {setActiveCourse,courseFrame} from "../src/core/course.ts";
import {bridgeContactRotation,bridgeBoardClearance} from "../src/view/bridgeContact.ts";
afterEach(()=>setActiveCourse("vale-bravo"));
it("keeps all board corners at the same fixed contact height while steering",()=>{
  setActiveCourse("canion-ferrugem");
  for(let s=1125;s<1735;s+=10)for(const x of [0,10,18])for(const carve of [-1,0,1]){
    const alignment=bridgeContactRotation(s,x);
    const normal=new THREE.Vector3(0,1,0).applyQuaternion(alignment);
    expect(normal.y).toBeGreaterThan(.9);
    const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,courseFrame(s,x).heading+carve*.13,0)).premultiply(alignment);
    for(const bx of [-1.5,1.5])for(const bz of [-.55,.55]){
      const corner=new THREE.Vector3(bx,0,bz).applyQuaternion(orientation);
      corner.y+=bridgeBoardClearance();
      expect(corner.dot(normal)).toBeGreaterThan(.025);
      expect(corner.dot(normal)).toBeCloseTo(.10*normal.y,7);
    }
  }
});
