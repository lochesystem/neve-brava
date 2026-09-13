import * as THREE from "three";

const smooth = (a: number, b: number, v: number) => THREE.MathUtils.smoothstep(v, a, b);

/** Island-based weights for the approved Snowman grab; preserves the source geometry. */
export function createSnowmanGrabRig(source: THREE.Mesh) {
  const geometry = source.geometry.clone();
  source.updateWorldMatrix(true, false);
  geometry.applyMatrix4(source.matrixWorld);
  const root = new THREE.Bone(); root.name = "grab-root";
  const body = new THREE.Bone(); body.name = "body"; body.position.set(0, .4, 0); root.add(body);
  const board = new THREE.Bone(); board.name = "board-and-boots"; board.position.set(0, .09, 0); root.add(board);
  const left = new THREE.Bone(); left.name = "left-arm"; left.position.set(-.105, .145, 0); body.add(left);
  const right = new THREE.Bone(); right.name = "right-arm"; right.position.set(.15, .145, 0); body.add(right);
  const bones = [root, body, board, left, right];
  const positions = geometry.getAttribute("position");
  // The single mesh contains disconnected islands (arms, snowballs, equipment).
  // Classify whole islands so a rigid branch never stretches into a spike.
  const parent = Array.from({ length: positions.count }, (_, i) => i);
  const find = (v: number): number => { while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; } return v; };
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  const weld = new Map<string, number>();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => v.toFixed(5)).join(",");
    const previous = weld.get(key);
    if (previous !== undefined) join(i, previous); else weld.set(key, i);
  }
  const index = geometry.getIndex();
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
    join(a, b); join(a, c);
  }
  const bounds = new Map<number, THREE.Box3>();
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const id = find(i);
    if (!bounds.has(id)) bounds.set(id, new THREE.Box3());
    bounds.get(id)!.expandByPoint(vertex.fromBufferAttribute(positions, i));
  }
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), box = bounds.get(find(i))!;
    const armWeight = box.min.y > .27 && box.max.y < .58 && (box.max.x > .3 || box.min.x < -.3) ? 1 : 0;
    const boardWeight = box.max.y < .19 ? 1 : box.max.y < .3 ? 1 - smooth(.14, .27, y) : 0;
    indices.set([2, x < 0 ? 3 : 4, 1, 0], i * 4);
    weights.set([boardWeight, armWeight * (1 - boardWeight), (1 - armWeight) * (1 - boardWeight), 0], i * 4);
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = "Nevinho-grab-experimental";
  mesh.add(root);
  mesh.bind(new THREE.Skeleton(bones));
  // The pose leaves the rest bounds; avoid a CPU skinning pass to rebuild them each frame.
  mesh.frustumCulled = false;
  return { mesh, applyPose: bindSnowmanGrabPose(mesh), bones };
}

/** Bind to each instance's own skeleton, never the shared template. */
export function bindSnowmanGrabPose(mesh: THREE.Object3D) {
  const board = mesh.getObjectByName("board-and-boots")!;
  const body = mesh.getObjectByName("body")!;
  const left = mesh.getObjectByName("left-arm")!;
  const right = mesh.getObjectByName("right-arm")!;
  const applyPose = (amount: number) => {
    const t = smooth(0, 1, amount);
    board.position.set(0, .09 + .11 * t, .13 * t);
    board.rotation.x = -.32 * t;
    body.position.set(0, .4 - .12 * t, -.015 * t);
    body.rotation.set(.22 * t, 0, 0);
    left.rotation.set(-.65 * t, 0, .52 * t);
    right.rotation.set(-.65 * t, 0, -.52 * t);
  };
  return applyPose;
}

/** Add after the grab pose has reset the bones each frame. No geometry changes,
 * allocations or simulated physics: shoulders follow the balance shift with lag. */
export function bindSnowmanRidePose(mesh: THREE.Object3D) {
  const body = mesh.getObjectByName("body")!;
  const left = mesh.getObjectByName("left-arm")!;
  const right = mesh.getObjectByName("right-arm")!;
  let torso = 0, arms = 0, idlePhase = 0;
  return (dt: number, carve: number, speed: number, active: boolean, grab = 0) => {
    const delta = THREE.MathUtils.clamp(dt, 0, .1);
    const target = active ? THREE.MathUtils.clamp(carve, -1, 1) * THREE.MathUtils.smoothstep(speed, 2, 25) : 0;
    torso = THREE.MathUtils.damp(torso, target, 9, delta);
    arms = THREE.MathUtils.damp(arms, torso, 5, delta);
    // Suppress immediately for falls/freeze/air; never overwrite the grab.
    const weight = active ? 1 - THREE.MathUtils.smoothstep(grab, 0, .8) : 0;
    const lean = torso * weight, balance = arms * weight;
    // A relaxed 3.8-second breath, with shoulders trailing the torso.
    // Translate/rotate rigid snowballs rather than scaling the mesh like rubber.
    if (active) idlePhase = (idlePhase + delta * Math.PI * 2 / 3.8) % (Math.PI * 2);
    const idle = weight * (1 - THREE.MathUtils.smoothstep(Math.abs(torso), .08, .7));
    const breath = Math.sin(idlePhase), shoulder = Math.sin(idlePhase - .35);
    // Exaggerate the silhouette for the distant chase camera, not the tempo.
    body.position.y += breath * .012 * idle;
    body.rotation.x += breath * .028 * idle;
    body.rotation.z += Math.sin(idlePhase * 2) * .014 * idle;
    left.rotation.x += shoulder * .105 * idle;
    right.rotation.x += Math.sin(idlePhase - .55) * .084 * idle;
    left.rotation.z += shoulder * .075 * idle;
    right.rotation.z -= shoulder * .075 * idle;
    body.rotation.x += lean * .055;
    body.rotation.y += lean * .045;
    left.rotation.x += balance * .20;
    right.rotation.x -= balance * .16;
    left.rotation.z += Math.max(0, balance) * .22 + Math.min(0, balance) * .09;
    right.rotation.z += Math.min(0, balance) * .22 + Math.max(0, balance) * .09;
  };
}
