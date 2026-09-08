import * as THREE from "three";

/** Conservative Guy v2 experiment: welded weights, rigid board and head. */
export function createGuyGrabRig(source: THREE.Mesh) {
  source.updateWorldMatrix(true, false);
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  const root = new THREE.Bone(); root.name = "guy-root";
  const bone = (name: string, parent: THREE.Bone, x: number, y: number) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, 0); parent.add(b); return b;
  };
  const body = bone("guy-body", root, 0, .43);
  const board = bone("guy-board", root, 0, .075);
  const left = bone("guy-left-arm", body, -.12, .16);
  const right = bone("guy-right-arm", body, .12, .16);
  const bones = [root, body, board, left, right];
  const p = geometry.getAttribute("position"), index = geometry.getIndex();
  const parent = Array.from({length:p.count}, (_, i) => i);
  const find = (i: number): number => { while(parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const weld = new Map<string, number>(), neighbours = new Map<number, Set<number>>();
  const canonical = new Uint32Array(p.count);
  for(let i=0;i<p.count;i++) {
    const key = [p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(",");
    const previous = weld.get(key); canonical[i] = previous ?? i;
    if(previous !== undefined) parent[find(i)] = find(previous); else weld.set(key,i);
  }
  const connect = (a:number,b:number) => {
    parent[find(a)] = find(b); a=canonical[a]; b=canonical[b]; if(a===b)return;
    if(!neighbours.has(a))neighbours.set(a,new Set()); if(!neighbours.has(b))neighbours.set(b,new Set());
    neighbours.get(a)!.add(b); neighbours.get(b)!.add(a);
  };
  for(let i=0;i<(index?.count ?? p.count);i+=3) {
    const a=index?.getX(i)??i,b=index?.getX(i+1)??i+1,c=index?.getX(i+2)??i+2;
    connect(a,b);connect(b,c);connect(c,a);
  }
  let lowest=0; for(let i=1;i<p.count;i++)if(p.getY(i)<p.getY(lowest))lowest=i;
  const boardIsland=find(lowest), smooth=THREE.MathUtils.smoothstep;
  const indices=new Uint16Array(p.count*4); let weights=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i);
    const arm=find(i)===boardIsland?0:smooth(Math.abs(x),.15,.26)*smooth(y,.31,.38)*(1-smooth(y,.57,.65));
    const bottom=find(i)===boardIsland?1:(1-smooth(y,.17,.43))*(1-arm);
    indices.set([2,3,4,1],i*4);weights.set([bottom,x<0?arm:0,x>=0?arm:0,1-bottom-arm],i*4);
  }
  for(let pass=0;pass<20;pass++) {
    const next=weights.slice();
    for(const [i,adjacent] of neighbours) {
      if(find(i)===boardIsland||p.getY(i)<.15||p.getY(i)>.67)continue;
      for(let c=0;c<4;c++) {let sum=0;for(const j of adjacent)sum+=weights[j*4+c];next[i*4+c]=weights[i*4+c]*.55+sum/adjacent.size*.45;}
    }
    for(let i=0;i<p.count;i++)if(canonical[i]!==i)next.set(next.subarray(canonical[i]*4,canonical[i]*4+4),i*4);
    weights=next;
  }
  geometry.setAttribute("skinIndex",new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute("skinWeight",new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,source.material);mesh.add(root);mesh.bind(new THREE.Skeleton(bones));mesh.frustumCulled=false;
  const applyPose=(amount:number)=>{
    const t=smooth(amount,0,1);
    body.position.set(0,.43-.045*t,-.025*t);body.rotation.x=.22*t;
    // Bring the boots AND board out in front; vertical-only motion crushes
    // the knees into the boots instead of reading as an airborne grab.
    board.position.set(0,.075+.13*t,.25*t);board.rotation.x=-.28*t;
    left.rotation.set(-.70*t,0,.30*t);
    right.position.set(.12,.16-.045*t,.035*t);
    right.rotation.set(-.60*t,0,-.30*t);
  };
  return {mesh,bones,applyPose};
}
