import * as THREE from "three";
import { createYetiGrabRig } from "../experiments/yetiGrabRig.ts";
import { createGiruGrabRig } from "../experiments/giruGrabRig.ts";
import { createGuyGrabRig } from "../experiments/guyGrabRig.ts";
import { createCactusGrabRig } from "../experiments/cactusGrabRig.ts";

type PoseTrack = { name: string; positions: number[]; rotations: number[] };
const STEPS = 32;

/** Bake the approved lab poses once, so gameplay never runs IK or skin weighting. */
export function createCharacterGrabModel(scene: THREE.Object3D, id: "yeti" | "giru" | "guy" | "cactus") {
  let source: THREE.Mesh | undefined;
  scene.traverse(object => { if(object instanceof THREE.Mesh) source=object; });
  const model = new THREE.Group();
  if(!source) { model.add(scene); return model; }
  const rig = id === "cactus" ? createCactusGrabRig(source) : id === "yeti" ? createYetiGrabRig(source) : id === "giru" ? createGiruGrabRig(source) : createGuyGrabRig(source);
  const tracks: PoseTrack[] = rig.bones.filter(b=>!b.name.startsWith("giru-hair")).map(b=>({name:b.name,positions:[],rotations:[]}));
  for(let i=0;i<=STEPS;i++) {
    rig.applyPose(i/STEPS);
    for(const track of tracks) {
      const bone=rig.mesh.getObjectByName(track.name)!;
      bone.position.toArray(track.positions,i*3);bone.quaternion.toArray(track.rotations,i*4);
    }
  }
  rig.applyPose(0); rig.mesh.updateMatrixWorld(true);
  model.add(rig.mesh);model.userData.grabTracks=tracks;
  return model;
}

/** Bind only to the cloned instance, including when two players choose the same rider. */
export function bindCharacterGrab(instance: THREE.Object3D): ((amount:number)=>void) | null {
  let tracks: PoseTrack[] | undefined;
  instance.traverse(object=>{ if(object.userData.grabTracks)tracks=object.userData.grabTracks; });
  if(!tracks)return null;
  const bindings=tracks.map(track=>({track,bone:instance.getObjectByName(track.name)!}));
  const position=new THREE.Vector3(), rotation=new THREE.Quaternion();
  return amount=>{
    const frame=THREE.MathUtils.clamp(amount,0,1)*STEPS;
    const a=Math.floor(frame),b=Math.min(a+1,STEPS),mix=frame-a;
    for(const {track,bone} of bindings) {
      bone.position.fromArray(track.positions,a*3).lerp(position.fromArray(track.positions,b*3),mix);
      bone.quaternion.fromArray(track.rotations,a*4).slerp(rotation.fromArray(track.rotations,b*4),mix);
    }
  };
}
