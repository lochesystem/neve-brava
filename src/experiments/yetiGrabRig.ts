import * as THREE from "three";

/** Experimental rig for the Yeti's connected fur mesh. Never used by the race. */
export function createYetiGrabRig(source: THREE.Mesh) {
  source.updateWorldMatrix(true, false);
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  // Align the face and shoulders with the rig axes, then restore the model orientation.
  const yaw = .4;
  geometry.rotateY(-yaw);
  const root = new THREE.Bone(); root.name = "yeti-root";
  const body = new THREE.Bone(); body.name = "yeti-body"; body.position.set(0, .46, 0); root.add(body);
  const board = new THREE.Bone(); board.name = "yeti-board"; board.position.set(0, .12, 0); root.add(board);
  const left = new THREE.Bone(); left.name = "yeti-left-arm"; left.position.set(-.18, .17, 0); body.add(left);
  const right = new THREE.Bone(); right.name = "yeti-right-arm"; right.position.set(.23, .17, 0); body.add(right);
  const bones = [root, body, board, left, right];
  const positions = geometry.getAttribute("position");
  const parents = Array.from({ length: positions.count }, (_, i) => i);
  const find = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const join = (a: number, b: number) => { parents[find(a)] = find(b); };
  const seams = new Map<string, number>();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(5)).join(",");
    const previous = seams.get(key);
    if (previous !== undefined) join(i, previous); else seams.set(key, i);
  }
  const triangles = geometry.getIndex();
  for (let i = 0; i < (triangles?.count ?? positions.count); i += 3) {
    const a = triangles?.getX(i) ?? i;
    join(a, triangles?.getX(i + 1) ?? i + 1); join(a, triangles?.getX(i + 2) ?? i + 2);
  }
  let lowest = 0;
  for (let i = 1; i < positions.count; i++) if (positions.getY(i) < positions.getY(lowest)) lowest = i;
  const boardIsland = find(lowest);
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const isBoard = find(i) === boardIsland;
    const arm = isBoard ? 0 : THREE.MathUtils.smoothstep(Math.abs(x - .025), .14, .23) *
      THREE.MathUtils.smoothstep(y, .25, .3) * (1 - THREE.MathUtils.smoothstep(y, .64, .73)) *
      THREE.MathUtils.smoothstep(z - x * .42, -.15, -.07);
    const bottom = isBoard ? 1 : (1 - THREE.MathUtils.smoothstep(y, .19, .44)) * (1 - arm);
    indices.set([2, x < .025 ? 3 : 4, 1, 0], i * 4);
    weights.set([bottom, arm, 1 - arm - bottom, 0], i * 4);
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = "Yeti-grab-experimental";
  mesh.add(root); mesh.bind(new THREE.Skeleton(bones)); mesh.rotation.y = yaw;
  mesh.frustumCulled = false;
  const applyPose = (amount: number) => {
    const t = THREE.MathUtils.smoothstep(amount, 0, 1);
    body.position.set(0, .46 - .1 * t, -.02 * t);
    body.rotation.x = .22 * t;
    board.position.set(0, .12 + .1 * t, .13 * t);
    board.rotation.x = -.25 * t;
    // One-handed grab: the other arm stays open for balance and avoids pinching the scarf.
    left.rotation.set(-.12 * t, 0, -.08 * t);
    right.rotation.set(-.5 * t, 0, .05 * t);
  };
  return { mesh, bones, applyPose };
}
