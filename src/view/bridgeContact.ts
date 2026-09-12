import * as THREE from "three";
import {courseHeight,courseWorldPoint} from "../core/course.ts";

const up=new THREE.Vector3(0,1,0);
/** Normal of the actual deck, including the lateral shear in its curved sections. */
export function bridgeContactRotation(s:number,x:number,out=new THREE.Quaternion()):THREE.Quaternion {
  const a=courseWorldPoint(s-.5,x),b=courseWorldPoint(s+.5,x);
  const c=courseWorldPoint(s,x-.5),d=courseWorldPoint(s,x+.5);
  const forward=new THREE.Vector3(b.x-a.x,courseHeight(s+.5,x)-courseHeight(s-.5,x),b.z-a.z);
  const across=new THREE.Vector3(d.x-c.x,courseHeight(s,x+.5)-courseHeight(s,x-.5),d.z-c.z);
  const normal=across.cross(forward).normalize();
  if(normal.y<0)normal.negate();
  return out.setFromUnitVectors(up,normal);
}
// Grounded boards turn in the deck plane; steering must not lift the entire rider.
export function bridgeBoardClearance():number {return .10;}
