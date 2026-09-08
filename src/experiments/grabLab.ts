import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createSnowmanGrabRig } from "../view/snowmanGrabRig.ts";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createYetiGrabRig } from "./yetiGrabRig.ts";

const isYeti = new URLSearchParams(location.search).get("character") === "yeti";
const characterName = isYeti ? "Yeti" : "Nevinho";

document.body.innerHTML = `<style>body{margin:0;background:#d9eaf0;color:#203047;font:16px system-ui}canvas{display:block;width:100vw;height:100dvh}aside{position:fixed;top:16px;left:16px;width:280px;background:#fff8e9ee;border:2px solid #203047;border-radius:16px;padding:16px;box-sizing:border-box}h1{font-size:20px;margin:0 0 8px}p{font-size:13px}label{display:block;margin:12px 0}input[type=range]{width:100%}button{padding:10px;border:1px solid #203047;border-radius:8px;background:#ffd355;cursor:pointer}small{display:block;margin-top:12px}</style><canvas></canvas><aside><h1>Nevinho · Grab experimental</h1><p>Cópia independente. O personagem do jogo não foi alterado.</p><label>Pose <input id="pose" type="range" min="0" max="1" value="0" step=".01"></label><button id="play">Animar</button><label><input id="bones" type="checkbox"> Mostrar esqueleto</label><small>Arraste para girar a câmera. Scroll para aproximar.</small><p id="status">Carregando modelo…</p></aside>`;
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector("canvas")!, antialias: true });
document.querySelector("h1")!.textContent = `${characterName} · Grab experimental`;
document.title = `${characterName} · laboratório de grab`;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9eaf0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x65788b, 3));
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(2, 4, 3); scene.add(sun);
const camera = new THREE.PerspectiveCamera(35, 1, .01, 30);
camera.position.set(1.5, 1.1, 2);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, .45, 0); controls.update();
const grid = new THREE.GridHelper(3, 12, 0x8195a5, 0xb4cad5); scene.add(grid);
const views = document.createElement("div");
views.style.cssText = "position:fixed;bottom:12px;left:12px;display:flex;gap:6px";
for (const [label, position] of [["Frente", [1, .9, 2.4]], ["Lado", [2.4, .85, -.6]], ["Costas", [-1, 1, -2.4]]] as const) {
  const button = document.createElement("button"); button.textContent = label;
  button.addEventListener("click", () => { camera.position.set(position[0], position[1], position[2]); controls.target.set(0, .45, 0); controls.update(); });
  views.append(button);
}
document.body.append(views);
let animate = false;
const pose = document.querySelector<HTMLInputElement>("#pose")!;
document.querySelector("#play")!.addEventListener("click", e => { animate = !animate; (e.target as HTMLElement).textContent = animate ? "Pausar" : "Animar"; });
pose.addEventListener("input", () => { animate = false; document.querySelector("#play")!.textContent = "Animar"; });
let applyPose = (_amount: number) => {};
new GLTFLoader().load(`${import.meta.env.BASE_URL}models/${isYeti ? "yeti" : "snow-main"}.glb`, gltf => {
  let source: THREE.Mesh | undefined;
  gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) source = object; });
  if (!source) throw new Error(`Malha do ${characterName} não encontrada`);
  const rig = isYeti ? createYetiGrabRig(source) : createSnowmanGrabRig(source);
  scene.add(rig.mesh);
  applyPose = rig.applyPose;
  const helper = new THREE.SkeletonHelper(rig.mesh); helper.visible = false; scene.add(helper);
  document.querySelector("#bones")!.addEventListener("change", e => { helper.visible = (e.target as HTMLInputElement).checked; });
  document.querySelector("#status")!.textContent = "Rig aproximado: corpo, braços e prancha. Arraste Pose para comparar com o original.";
  const download = document.createElement("button");
  download.textContent = "Baixar GLB animado";
  document.querySelector("aside")!.append(download);
  download.addEventListener("click", async () => {
    download.disabled = true;
    animate = false;
    document.querySelector("#play")!.textContent = "Animar";
    const current = Number(pose.value);
    pose.value = "0";
    const times: number[] = [];
    const values = rig.bones.map(() => ({ position: [] as number[], quaternion: [] as number[] }));
    for (let frame = 0; frame <= 72; frame++) {
      const time = frame / 30;
      times.push(time);
      rig.applyPose(time < .8 ? time / .8 : time < 1.4 ? 1 : 1 - (time - 1.4));
      rig.bones.forEach((bone, i) => { bone.position.toArray(values[i].position, frame * 3); bone.quaternion.toArray(values[i].quaternion, frame * 4); });
    }
    const clip = new THREE.AnimationClip(`${characterName}_Grab_Experimental`, 2.4, rig.bones.flatMap((bone, i) => [
      new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, values[i].position),
      new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values[i].quaternion),
    ]));
    try {
      rig.applyPose(0);
      rig.mesh.updateMatrixWorld(true);
      const result = await new GLTFExporter().parseAsync(rig.mesh, { binary: true, animations: [clip] });
      const url = URL.createObjectURL(new Blob([result as ArrayBuffer], { type: "model/gltf-binary" }));
      const link = document.createElement("a"); link.href = url; link.download = `${isYeti ? "yeti" : "snowman"}-grab-experimental.glb`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      document.querySelector("#status")!.textContent = "GLB exportado com esqueleto e animação de grab. Original preservado.";
    } catch (error) {
      document.querySelector("#status")!.textContent = `Falha ao exportar: ${String(error)}`;
    } finally { pose.value = String(current); rig.applyPose(current); download.disabled = false; }
  });
}, undefined, error => { document.querySelector("#status")!.textContent = String(error); });
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener("resize", resize); resize();
renderer.setAnimationLoop(time => { if (animate) pose.value = String((1 - Math.cos(time * .002)) / 2); applyPose(Number(pose.value)); renderer.render(scene, camera); });
