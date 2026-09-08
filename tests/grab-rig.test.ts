import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import * as THREE from "three";
import { createSnowmanGrabRig, bindSnowmanGrabPose } from "../src/view/snowmanGrabRig.ts";
import { clone } from "three/addons/utils/SkeletonUtils.js";

it("preserves the real snowman at rest and creates normalized finite skinning weights", () => {
  const bytes = readFileSync(new URL("../public/models/snow-main.glb", import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const primitive = gltf.meshes[0].primitives[0];
  function attribute(id: number, width: number) {
    const a = gltf.accessors[id], view = gltf.bufferViews[a.bufferView];
    const start = 28 + jsonLength + (view.byteOffset || 0) + (a.byteOffset || 0);
    const TypedArray = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : Uint16Array;
    return new THREE.BufferAttribute(new TypedArray(bytes.buffer.slice(bytes.byteOffset + start, bytes.byteOffset + start + a.count * width * TypedArray.BYTES_PER_ELEMENT)), width);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", attribute(primitive.attributes.POSITION, 3));
  geometry.setIndex(attribute(primitive.indices, 1));
  const original = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const rig = createSnowmanGrabRig(original);
  const positions = geometry.getAttribute("position");
  const weights = rig.mesh.geometry.getAttribute("skinWeight");
  rig.applyPose(0); rig.mesh.updateMatrixWorld(true); rig.mesh.skeleton.update();
  for (let i = 0; i < positions.count; i++) {
    expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1);
    const rest = rig.mesh.getVertexPosition(i, new THREE.Vector3());
    expect(rest.distanceTo(new THREE.Vector3().fromBufferAttribute(positions, i))).toBeLessThan(1e-6);
  }
  rig.applyPose(1); rig.mesh.updateMatrixWorld(true); rig.mesh.skeleton.update();
  for (let i = 0; i < positions.count; i++) {
    expect(rig.mesh.getVertexPosition(i, new THREE.Vector3()).toArray().every(Number.isFinite)).toBe(true);
  }
  expect(original.geometry.getAttribute("skinWeight")).toBeUndefined();
  const copy = clone(rig.mesh) as THREE.SkinnedMesh;
  bindSnowmanGrabPose(copy)(0);
  expect(copy.skeleton).not.toBe(rig.mesh.skeleton);
  expect(copy.getObjectByName("body")!.position.y).toBeCloseTo(.4);
  expect(rig.mesh.getObjectByName("body")!.position.y).toBeCloseTo(.28);
});
