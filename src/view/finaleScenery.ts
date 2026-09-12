import * as THREE from "three";
import {courseFrame,courseHeight,courseWorldPoint} from "../core/course.ts";

/** Static ceremonial landmarks; all supports remain outside the playable lane. */
export function createFinaleScenery():THREE.Group {
  const root=new THREE.Group();root.name="mountain-crown-finale";
  const ice=new THREE.MeshLambertMaterial({color:0xc2c3ed});
  const gold=new THREE.MeshLambertMaterial({color:0xffd584});
  const archGeometry=new THREE.TorusGeometry(22,.65,5,32,Math.PI);
  const pillarGeometry=new THREE.CylinderGeometry(.9,1.4,4,6);
  const crystalGeometry=new THREE.ConeGeometry(1.1,4.5,5);
  for(const s of [2890,3060,3500]){
    const portal=new THREE.Group(),world=courseWorldPoint(s,0);
    portal.position.set(world.x,courseHeight(s)+2,world.z);
    portal.rotation.y=courseFrame(s).heading;
    portal.add(new THREE.Mesh(archGeometry,ice));
    for(const side of [-1,1]){
      const post=new THREE.Mesh(pillarGeometry,ice);post.position.set(side*22,-1,0);portal.add(post);
    }
    for(const angle of [Math.PI*.36,Math.PI*.5,Math.PI*.64]){
      const tip=new THREE.Mesh(crystalGeometry,gold);tip.position.set(Math.cos(angle)*22,Math.sin(angle)*22+1.2,0);portal.add(tip);
    }
    root.add(portal);
  }
  return root;
}
