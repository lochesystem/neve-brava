import * as THREE from "three";

/** Cactus.glb-specific rig. Rigid trunk/crest, welded joint weights and rigid board. */
export function createCactusGrabRig(source: THREE.Mesh) {
  source.updateWorldMatrix(true, false);
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  const root = new THREE.Bone(); root.name = "cactus-root";
  const make = (name: string, x: number, y: number, z = 0, parent = root) => {
    const bone = new THREE.Bone(); bone.name = `cactus-${name}`;
    bone.position.set(x, y, z); parent.add(bone); return bone;
  };
  const body = make("body", 0, .30);
  const board = make("board", 0, .08);
  const left = make("left-arm", -.12, .27, 0, body);
  const right = make("right-arm", .12, .27, 0, body);
  const bones = [root, body, board, left, right];
  const legs = [-1, 1].map((side, i) => {
    const hip = new THREE.Vector3(side * .085, .38, 0);
    const knee = new THREE.Vector3(side * .125, .30, .015);
    const ankle = new THREE.Vector3(side * .165, .23, .02);
    const thigh = make(`thigh-${i}`, hip.x, hip.y, hip.z);
    const shin = make(`shin-${i}`, knee.x, knee.y, knee.z);
    const index = bones.length; bones.push(thigh, shin);
    return { hip, knee, ankle, thigh, shin, index, upper: knee.clone().sub(hip), lower: ankle.clone().sub(knee) };
  });
  const positions = geometry.getAttribute("position"), triangles = geometry.index;
  const parents = Array.from({length: positions.count}, (_, i) => i);
  const find = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const weld = new Map<string, number>();
  for (let i=0;i<positions.count;i++) {
    const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>v.toFixed(5)).join(",");
    const previous=weld.get(key);
    if(previous!==undefined)parents[find(i)]=find(previous);else weld.set(key,i);
  }
  for(let i=0;i<(triangles?.count ?? positions.count);i+=3) {
    const a=triangles?.getX(i)??i,b=triangles?.getX(i+1)??i+1,c=triangles?.getX(i+2)??i+2;
    parents[find(a)]=find(b);parents[find(a)]=find(c);
  }
  const bounds=new Map<number,THREE.Box3>(),v=new THREE.Vector3();
  for(let i=0;i<positions.count;i++) {
    const id=find(i);if(!bounds.has(id))bounds.set(id,new THREE.Box3());
    bounds.get(id)!.expandByPoint(v.fromBufferAttribute(positions,i));
  }
  const indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
  const smooth=THREE.MathUtils.smoothstep;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),island=bounds.get(find(i))!;
    // Board islands and boot details move as complete rigid objects.
    const rigidBottom=island.max.y<.25;
    const armIsland=island.min.y>.30 && island.max.y<.66 && (island.min.x>.04 || island.max.x<-.04);
    const arm=armIsland ? 1-smooth(y,.55,.635) : 0;
    if(rigidBottom){indices.set([2,0,0,0],i*4);weights[i*4]=1;continue;}
    if(y>=.40 || armIsland) {
      indices.set([x<0?3:4,1,0,0],i*4);weights.set([arm,1-arm,0,0],i*4);continue;
    }
    const leg=legs[x<0?0:1],boot=1-smooth(y,.23,.265),hip=smooth(y,.32,.40),knee=smooth(y,.27,.32);
    indices.set([2,leg.index,leg.index+1,1],i*4);
    weights.set([boot,(1-boot)*(1-hip)*knee,(1-boot)*(1-hip)*(1-knee),(1-boot)*hip],i*4);
  }
  geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,source.material);
  mesh.name="Cacto-grab";mesh.add(root);mesh.bind(new THREE.Skeleton(bones));mesh.frustumCulled=false;
  const applyPose=(amount:number)=>{
    const t=smooth(amount,0,1);
    body.position.set(0,.30-.025*t,-.015*t);body.rotation.x=.16*t;
    board.position.set(0,.08+.075*t,.13*t);board.rotation.x=-.25*t;
    left.rotation.set(-.48*t,0,.20*t);right.rotation.set(-.48*t,0,-.20*t);
    for(const leg of legs) {
      if(t===0){leg.thigh.position.copy(leg.hip);leg.shin.position.copy(leg.knee);leg.thigh.quaternion.identity();leg.shin.quaternion.identity();continue;}
      const hip=leg.hip.clone().sub(new THREE.Vector3(0,.30,0)).applyEuler(body.rotation).add(body.position);
      const ankle=leg.ankle.clone().sub(new THREE.Vector3(0,.08,0)).applyEuler(board.rotation).add(board.position);
      const direction=ankle.clone().sub(hip),a=leg.upper.length(),b=leg.lower.length();
      const distance=THREE.MathUtils.clamp(direction.length(),Math.abs(a-b)+1e-5,a+b-1e-5);direction.normalize();
      const along=(a*a-b*b+distance*distance)/(2*distance);
      const pole=new THREE.Vector3(0,0,1).addScaledVector(direction,-direction.z).normalize();
      const knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
      leg.thigh.position.copy(hip);leg.shin.position.copy(knee);
      leg.thigh.quaternion.setFromUnitVectors(leg.upper.clone().normalize(),knee.clone().sub(hip).normalize());
      leg.shin.quaternion.setFromUnitVectors(leg.lower.clone().normalize(),ankle.clone().sub(knee).normalize());
    }
  };
  return {mesh,bones,applyPose};
}
