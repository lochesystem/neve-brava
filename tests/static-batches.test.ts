import { expect, it } from "vitest";
import * as THREE from "three";
import { batchStaticMeshes } from "../src/view/staticBatches.ts";

it("batches nearby matching meshes without changing their transforms or assets", () => {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const meshes = [10, 20, 300].map(z => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(1, 2, z);
    mesh.rotation.y = .4;
    mesh.scale.set(1, 2, 3);
    return mesh;
  });
  const batches = batchStaticMeshes(meshes);
  expect(batches.map(b => b.count)).toEqual([2, 1]);
  const actual = new THREE.Matrix4();
  batches[0].getMatrixAt(1, actual);
  actual.elements.forEach((value, i) => expect(value).toBeCloseTo(meshes[1].matrix.elements[i], 5));
  expect(batches[0].geometry).toBe(geometry);
  expect(batches[0].material).toBe(material);
  expect(batches[0].boundingSphere!.radius).toBeLessThan(20);
});

it("splits existing tree instances into independently culled spatial chunks", () => {
  const source = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3);
  [0, 50, 500].forEach((z, i) => source.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, 0, z)));
  source.userData.persistentEnvironmentAsset = true;
  const batches = batchStaticMeshes([source]);
  expect(batches.map(b => b.count)).toEqual([2, 1]);
  expect(batches.every(b => b.userData.persistentEnvironmentAsset)).toBe(true);
});
