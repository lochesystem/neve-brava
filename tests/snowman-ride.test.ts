import { expect, it } from "vitest";
import * as THREE from "three";
import { bindSnowmanGrabPose, bindSnowmanRidePose } from "../src/view/snowmanGrabRig.ts";

function fixture() {
  const mesh = new THREE.Group();
  for (const name of ["body", "board-and-boots", "left-arm", "right-arm"]) {
    const bone = new THREE.Bone(); bone.name = name; mesh.add(bone);
  }
  return { mesh, base: bindSnowmanGrabPose(mesh), ride: bindSnowmanRidePose(mesh) };
}
it("balances smoothly without moving the board or accumulating rotations", () => {
  const {mesh,base,ride} = fixture();
  base(0); ride(1/60,1,40,true);
  const first = mesh.getObjectByName("body")!.rotation.x;
  for(let i=0;i<300;i++) { base(0); ride(1/60,1,40,true); }
  expect(mesh.getObjectByName("body")!.rotation.x).toBeGreaterThan(first);
  expect(mesh.getObjectByName("body")!.rotation.x).toBeCloseTo(.055);
  expect(mesh.getObjectByName("board-and-boots")!.rotation.x).toBeCloseTo(0);
  expect(mesh.getObjectByName("board-and-boots")!.position.y).toBe(.09);
  for(let i=0;i<300;i++) { base(0); ride(1/60,0,40,true); }
  expect(Math.abs(mesh.getObjectByName("left-arm")!.rotation.x)).toBeLessThan(.106);
});
it("preserves grab, suppresses inactive motion, and isolates instances", () => {
  const a=fixture(), b=fixture();
  for(let i=0;i<120;i++) { a.base(0); a.ride(1/60,-1,40,true); }
  a.base(1); const expected=a.mesh.getObjectByName("left-arm")!.quaternion.clone();
  a.ride(1/60,1,40,true,1);
  expect(a.mesh.getObjectByName("left-arm")!.quaternion.equals(expected)).toBe(true);
  a.base(0); a.ride(1/60,1,40,false);
  expect(a.mesh.getObjectByName("body")!.rotation.x).toBe(0);
  b.base(0); b.ride(1/60,0,40,true);
  const c=fixture(); c.base(0); c.ride(1/60,0,40,true);
  expect(b.mesh.getObjectByName("body")!.rotation.x).toBe(c.mesh.getObjectByName("body")!.rotation.x);
});

it("breathes at rest with bounded rigid motion and an unchanged board", () => {
  const {mesh,base,ride}=fixture();
  const heights: number[]=[];
  for(let i=0;i<456;i++) {
    base(0); ride(1/60,0,0,true);
    heights.push(mesh.getObjectByName("body")!.position.y);
    expect(mesh.getObjectByName("board-and-boots")!.position.toArray()).toEqual([0,.09,0]);
    expect(mesh.getObjectByName("body")!.scale.toArray()).toEqual([1,1,1]);
  }
  expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(.023);
  expect(Math.max(...heights)).toBeLessThanOrEqual(.412001);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(.387999);
  base(0); ride(1/60,0,40,false);
  expect(mesh.getObjectByName("body")!.position.y).toBe(.4);
});
