import * as THREE from "three";

/** Giru-only laboratory rig. Source GLB and the race renderer remain unchanged. */
export function createGiruGrabRig(source: THREE.Mesh) {
  source.updateWorldMatrix(true, false);
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  const root = new THREE.Bone(); root.name = "giru-root";
  const body = new THREE.Bone(); body.name = "giru-body"; body.position.set(0, .43, 0); root.add(body);
  const board = new THREE.Bone(); board.name = "giru-board"; board.position.set(0, .07, 0); root.add(board);
  const left = new THREE.Bone(); left.name = "giru-left-arm"; left.position.set(-.09, .17, 0); body.add(left);
  const right = new THREE.Bone(); right.name = "giru-right-arm"; right.position.set(.14, .16, 0); body.add(right);
  const bones = [root, body, board, left, right];
  const hairRoot = new THREE.Bone(); hairRoot.name = "giru-hair-root";
  hairRoot.position.set(-.10, .44, -.065); body.add(hairRoot);
  const hairMid = new THREE.Bone(); hairMid.name = "giru-hair-mid";
  hairMid.position.set(-.13, -.025, -.015); hairRoot.add(hairMid);
  const hairTip = new THREE.Bone(); hairTip.name = "giru-hair-tip";
  hairTip.position.set(-.11, -.10, 0); hairMid.add(hairTip);
  bones.push(hairRoot, hairMid, hairTip);
  const p = geometry.getAttribute("position"), index = geometry.getIndex();
  const parent = Array.from({ length: p.count }, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a: number, b: number) => { parent[find(a)] = find(b); };
  const seams = new Map<string, number>(), neighbours = new Map<number, Set<number>>();
  const welded = new Uint32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(5)).join(",");
    const previous = seams.get(key); welded[i] = previous ?? i;
    if (previous !== undefined) join(i, previous); else seams.set(key, i);
  }
  const connect = (a: number, b: number) => {
    join(a, b); a = welded[a]; b = welded[b];
    if (a === b) return;
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    if (!neighbours.has(b)) neighbours.set(b, new Set());
    neighbours.get(a)!.add(b); neighbours.get(b)!.add(a);
  };
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const a = index?.getX(i) ?? i, b = index?.getX(i + 1) ?? i + 1, c = index?.getX(i + 2) ?? i + 2;
    connect(a, b); connect(b, c); connect(c, a);
  }
  let lowest = 0;
  for (let i = 1; i < p.count; i++) if (p.getY(i) < p.getY(lowest)) lowest = i;
  const boardIsland = find(lowest);
  const indices = new Uint16Array(p.count * 4);
  let weights = new Float32Array(p.count * 4);
  const smooth = THREE.MathUtils.smoothstep;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const isBoard = find(i) === boardIsland;
    // The ponytail is behind the shoulders; the head and feathered pauldron
    // belong to the torso, not the arm's spatial envelope.
    const arm = isBoard ? 0 : smooth(Math.abs(x - .025), .14, .24) * smooth(y, .26, .34) *
      (1 - smooth(y, .54, .62)) * smooth(z, -.08, -.01);
    const lower = isBoard ? 1 : (1 - smooth(y, .16, .4)) * (1 - arm);
    indices.set([2, 3, 4, 1], i * 4);
    weights.set([lower, x < .025 ? arm : 0, x >= .025 ? arm : 0, 1 - lower - arm], i * 4);
  }
  for (let pass = 0; pass < 16; pass++) {
    const next = weights.slice();
    for (const [i, adjacent] of neighbours) {
      if (find(i) === boardIsland || p.getY(i) > .64 || p.getY(i) < .14) continue;
      for (let channel = 0; channel < 4; channel++) {
        let sum = 0; for (const j of adjacent) sum += weights[j * 4 + channel];
        next[i * 4 + channel] = weights[i * 4 + channel] * .55 + sum / adjacent.size * .45;
      }
    }
    for (let i = 0; i < p.count; i++) if (welded[i] !== i) next.set(next.subarray(welded[i] * 4, welded[i] * 4 + 4), i * 4);
    weights = next;
  }
  // Feather the attachment into the torso. The envelope excludes the face,
  // helmet and low shoulder armour; only the projecting ponytail can swing.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // Only the attachment needs the depth gate. Applying it to the entire
    // ponytail pinned forward-curled tips to the torso while neighbours moved.
    const distal = smooth(-x, .205, .275);
    const attachment = smooth(-x, .16, .245) * smooth(y, .60, .70) * (1 - smooth(z, .015, .08));
    const hair = Math.max(attachment, distal * smooth(y, .52, .61));
    if (hair <= 0) continue;
    const tip = smooth(-x, .28, .40);
    const mid = smooth(-x, .20, .30) * (1 - tip);
    indices.set([1, 5, 6, 7], i * 4);
    weights.set([1 - hair, hair * (1 - mid - tip), hair * mid, hair * tip], i * 4);
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = "Giru-grab-experimental"; mesh.add(root); mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;
  const applyPose = (amount: number) => {
    const t = smooth(amount, 0, 1);
    body.position.set(0, .43 - .075 * t, -.01 * t); body.rotation.x = .17 * t;
    board.position.set(0, .07 + .085 * t, .12 * t); board.rotation.x = -.22 * t;
    left.rotation.set(-.1 * t, 0, -.1 * t);
    right.rotation.set(-.7 * t, 0, -.12 * t);
  };
  const angles = new Float64Array(6), velocity = new Float64Array(6);
  const hairBones = [hairRoot, hairMid, hairTip];
  const resetHair = () => {
    angles.fill(0); velocity.fill(0);
    hairBones.forEach(bone => bone.rotation.set(0, 0, 0));
  };
  const updateHair = (dt: number, turn = 0, speed = 0, vertical = 0) => {
    // Bounded substeps prevent explosions after tab suspension. No vertex work
    // or allocations per frame: only three spring-driven bone transforms.
    let remaining = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
    turn = THREE.MathUtils.clamp(turn, -1, 1);
    speed = THREE.MathUtils.clamp(speed, 0, 1);
    vertical = THREE.MathUtils.clamp(vertical, -1, 1);
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / 120); remaining -= step;
      for (let i = 0; i < 3; i++) {
        for (let axis = 0; axis < 2; axis++) {
          const k = i * 2 + axis;
          // Softer links toward the tip produce a delayed follow-through,
          // rather than three equally driven hinges rotating in lockstep.
          const target = axis === 0 ? turn * (.065 + i * .012) : speed * .025 + vertical * .055;
          const stiffness = 42 - i * 10;
          const damping = 9 - i * 1.7;
          velocity[k] += ((target - angles[k]) * stiffness - velocity[k] * damping) * step;
          angles[k] = THREE.MathUtils.clamp(angles[k] + velocity[k] * step, -.25, .25);
        }
      }
    }
    hairBones.forEach((bone, i) => bone.rotation.set(0, angles[i * 2], angles[i * 2 + 1]));
  };
  return { mesh, bones, applyPose, updateHair, resetHair };
}
