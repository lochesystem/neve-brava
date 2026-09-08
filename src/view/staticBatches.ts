import * as THREE from "three";

/** Preserve transforms/materials while giving each spatial batch its own culling bounds. */
export function batchStaticMeshes(meshes: THREE.Mesh[], cellSize = 120): THREE.InstancedMesh[] {
  const buckets = new Map<string, { source: THREE.Mesh; matrices: THREE.Matrix4[] }>();
  const position = new THREE.Vector3();
  for (const mesh of meshes) {
    mesh.updateMatrix();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const add = (matrix: THREE.Matrix4) => {
      position.setFromMatrixPosition(matrix);
      const key = `${mesh.geometry.uuid}:${materials.map(m => m.uuid).join(",")}:${Math.floor(position.x / cellSize)}:${Math.floor(position.z / cellSize)}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, bucket = { source: mesh, matrices: [] });
      bucket.matrices.push(matrix);
    };
    if (mesh instanceof THREE.InstancedMesh) {
      for (let i = 0; i < mesh.count; i++) {
        const matrix = new THREE.Matrix4();
        mesh.getMatrixAt(i, matrix);
        add(matrix.premultiply(mesh.matrix));
      }
    } else add(mesh.matrix.clone());
  }
  return [...buckets.values()].map(({ source, matrices }) => {
    const batch = new THREE.InstancedMesh(source.geometry, source.material, matrices.length);
    matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
    batch.castShadow = source.castShadow;
    batch.receiveShadow = source.receiveShadow;
    batch.userData = { ...source.userData };
    batch.computeBoundingSphere();
    return batch;
  });
}
