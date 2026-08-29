import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  COURSE_HALF_WIDTH,
  COURSE_LENGTH,
  OBSTACLES,
  RAMPS,
  courseFrame,
  courseHeight,
  courseSlope,
  courseTerrainHeight,
  courseWorldPoint,
  rampHeight,
  rampLength,
} from "../core/course.ts";
import { dampAlpha, clamp } from "../core/math.ts";
import { CRASH_RECOVERY_TIME, type GameEvent, type RiderState } from "../core/simulation.ts";
import type { RivalState } from "../core/rival.ts";

export type Quality = "high" | "medium" | "performance";

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
};

const PALETTE = {
  ink: 0x253348,
  snow: 0xfff8e7,
  snowBlue: 0xc7d6eb,
  mint: 0x57c8ad,
  pine: 0x24576a,
  pineLight: 0x3a8290,
  coral: 0xff725e,
  yellow: 0xffc94f,
  lavender: 0xa58bdd,
  rock: 0x66758e,
};

function toon(color: number, options: Partial<THREE.MeshToonMaterialParameters> = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, ...options });
}

function outlineMesh(geometry: THREE.BufferGeometry, scale = 1.035): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.setScalar(scale);
  return mesh;
}

function outlined(geometry: THREE.BufferGeometry, color: number): THREE.Group {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(geometry, toon(color));
  fill.castShadow = true;
  fill.receiveShadow = true;
  group.add(outlineMesh(geometry), fill);
  return group;
}

function createTree(height: number, accent = false): THREE.Group {
  const group = new THREE.Group();
  const trunk = outlined(new THREE.CylinderGeometry(0.28, 0.42, height * 0.34, 7), accent ? PALETTE.coral : 0x765241);
  trunk.position.y = height * 0.17;
  group.add(trunk);
  const colors = accent ? [PALETTE.coral, PALETTE.yellow, PALETTE.lavender] : [PALETTE.pine, PALETTE.pineLight, PALETTE.mint];
  for (let index = 0; index < 3; index += 1) {
    const crown = outlined(new THREE.ConeGeometry(height * (0.22 - index * 0.025), height * 0.42, 7), colors[index]);
    crown.position.y = height * (0.38 + index * 0.2);
    group.add(crown);
  }
  return group;
}

function createRock(scale: number, accent = false): THREE.Group {
  const rock = outlined(new THREE.DodecahedronGeometry(scale, 0), accent ? PALETTE.lavender : PALETTE.rock);
  rock.scale.set(1.15, 0.72, 0.9);
  rock.rotation.set(0.12, 0.35, -0.08);
  return rock;
}

function createFence(width: number): THREE.Group {
  const group = new THREE.Group();
  const postGeometry = new THREE.BoxGeometry(0.28, 1.6, 0.28);
  for (const x of [-width * 0.72, width * 0.72]) {
    const post = outlined(postGeometry, PALETTE.coral);
    post.position.set(x, 0.8, 0);
    group.add(post);
  }
  const plank = outlined(new THREE.BoxGeometry(width * 1.6, 0.38, 0.24), PALETTE.yellow);
  plank.position.y = 1.05;
  plank.rotation.z = -0.08;
  group.add(plank);
  return group;
}

function createIceCrystal(scale: number, accent = false): THREE.Group {
  const group = new THREE.Group();
  const colors = accent ? [PALETTE.lavender, PALETTE.mint, PALETTE.snowBlue] : [0x78cce1, 0xa9e8ff, 0xdff7ff];
  for (let index = 0; index < 3; index += 1) {
    const shard = outlined(new THREE.OctahedronGeometry(scale * (index === 0 ? 1 : 0.68), 0), colors[index]);
    shard.scale.set(0.46, 1.55 + index * 0.25, 0.52);
    shard.position.set((index - 1) * scale * 0.62, scale * (0.8 + index * 0.14), (index % 2) * 0.24);
    shard.rotation.z = (index - 1) * 0.16;
    group.add(shard);
  }
  return group;
}

function createLog(width: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = outlined(new THREE.CylinderGeometry(0.48, 0.58, width * 1.65, 9), 0x8b5a3c);
  trunk.rotation.z = Math.PI / 2;
  trunk.position.y = 0.52;
  group.add(trunk);
  for (const x of [-width * 0.82, width * 0.82]) {
    const ring = outlined(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 9), PALETTE.yellow);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(x, 0.52, 0);
    group.add(ring);
  }
  return group;
}

function createSnowball(scale: number, accent = false): THREE.Group {
  const group = new THREE.Group();
  for (let index = 0; index < 3; index += 1) {
    const ball = outlined(new THREE.IcosahedronGeometry(scale * (0.72 + index * 0.12), 1), accent && index === 1 ? PALETTE.mint : PALETTE.snowBlue);
    ball.position.set((index - 1) * scale * 0.56, scale * (0.55 + (index % 2) * 0.16), (index % 2) * 0.28);
    group.add(ball);
  }
  return group;
}

function createLabel(text: string, width: number, height: number, color: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "900 142px Impact, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#253348";
  context.lineWidth = 28;
  context.strokeText(text, canvas.width / 2, canvas.height / 2 + 6);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
}

function createEventArch(label: string, primary: number, accent: number): THREE.Group {
  const group = new THREE.Group();
  const width = 31;
  for (const side of [-1, 1]) {
    const post = outlined(new THREE.BoxGeometry(0.85, 7.4, 0.85), primary);
    post.position.set(side * width / 2, 3.7, 0);
    post.rotation.z = side * -0.025;
    group.add(post);
    const cap = outlined(new THREE.ConeGeometry(1.25, 1.8, 4), accent);
    cap.position.set(side * width / 2, 8.15, 0);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
  }
  const banner = outlined(new THREE.BoxGeometry(width + 1.2, 2.05, 0.42), primary);
  banner.position.y = 7.15;
  group.add(banner);
  const labelMesh = createLabel(label, 13.5, 2.45, "#fff8e7");
  labelMesh.position.set(0, 7.18, 0.24);
  group.add(labelMesh);
  for (const x of [-10.5, 10.5]) {
    const badge = outlined(new THREE.OctahedronGeometry(0.72, 0), accent);
    badge.position.set(x, 7.18, 0.42);
    group.add(badge);
  }
  return group;
}

function createCheckeredLine(width = 28): THREE.Group {
  const group = new THREE.Group();
  const columns = 14;
  const tileWidth = width / columns;
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(tileWidth, 0.07, 0.85),
        toon((row + column) % 2 === 0 ? PALETTE.ink : PALETTE.snow),
      );
      tile.position.set(-width / 2 + tileWidth * (column + 0.5), 0.04, (row - 0.5) * 0.85);
      tile.receiveShadow = true;
      group.add(tile);
    }
  }
  return group;
}

function createFlag(color: number): THREE.Group {
  const group = new THREE.Group();
  const pole = outlined(new THREE.CylinderGeometry(0.1, 0.14, 4.5, 6), PALETTE.ink);
  pole.position.y = 2.25;
  group.add(pole);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2.15, -0.62);
  shape.lineTo(0, -1.24);
  shape.closePath();
  const flag = outlined(new THREE.ShapeGeometry(shape), color);
  flag.position.set(0.08, 4.25, 0);
  group.add(flag);
  return group;
}

function createChalet(): THREE.Group {
  const group = new THREE.Group();
  const cabin = outlined(new THREE.BoxGeometry(7.5, 3.6, 6), 0x8f5b45);
  cabin.position.y = 1.8;
  group.add(cabin);
  const roof = outlined(new THREE.ConeGeometry(5.8, 3.1, 4), PALETTE.coral);
  roof.position.y = 5;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  const door = outlined(new THREE.BoxGeometry(1.45, 2.45, 0.24), PALETTE.pine);
  door.position.set(0, 1.25, 3.1);
  group.add(door);
  for (const x of [-2.25, 2.25]) {
    const window = outlined(new THREE.BoxGeometry(1.2, 1.15, 0.2), PALETTE.yellow);
    window.position.set(x, 2.15, 3.12);
    group.add(window);
  }
  const chimney = outlined(new THREE.BoxGeometry(0.8, 2.3, 0.8), PALETTE.ink);
  chimney.position.set(2.2, 5.6, 0.4);
  group.add(chimney);
  return group;
}

function createSpectator(color: number): THREE.Group {
  const group = new THREE.Group();
  const body = outlined(new THREE.SphereGeometry(0.56, 8, 6), PALETTE.snow);
  body.scale.y = 1.12;
  body.position.y = 0.65;
  group.add(body);
  const head = outlined(new THREE.SphereGeometry(0.38, 8, 6), PALETTE.snow);
  head.position.y = 1.5;
  group.add(head);
  const hat = outlined(new THREE.ConeGeometry(0.42, 0.82, 7), color);
  hat.position.y = 2.05;
  group.add(hat);
  const scarf = outlined(new THREE.TorusGeometry(0.38, 0.075, 5, 10), color);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.23;
  group.add(scarf);
  return group;
}

function createPodium(): THREE.Group {
  const group = new THREE.Group();
  const specs = [
    { x: 0, height: 2.2, color: PALETTE.yellow },
    { x: -2.2, height: 1.45, color: PALETTE.snowBlue },
    { x: 2.2, height: 1.05, color: PALETTE.coral },
  ];
  for (const spec of specs) {
    const step = outlined(new THREE.BoxGeometry(2.15, spec.height, 2.4), spec.color);
    step.position.set(spec.x, spec.height / 2, 0);
    group.add(step);
  }
  return group;
}

function createRampWedgeGeometry(width: number, length: number, height: number): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const approachHeight = 0.12;
  const positions = [
    -halfWidth, 0, halfLength,
    halfWidth, 0, halfLength,
    -halfWidth, approachHeight, halfLength,
    halfWidth, approachHeight, halfLength,
    -halfWidth, 0, -halfLength,
    halfWidth, 0, -halfLength,
    -halfWidth, height, -halfLength,
    halfWidth, height, -halfLength,
  ];
  const indices = [
    2, 3, 6, 3, 7, 6,
    0, 4, 1, 1, 4, 5,
    0, 1, 2, 1, 3, 2,
    4, 6, 5, 5, 6, 7,
    0, 2, 4, 2, 6, 4,
    1, 5, 3, 3, 5, 7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createRampModel(width: number, built: boolean, length: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const approachHeight = 0.12;
  const faceColor = built ? PALETTE.coral : PALETTE.snowBlue;
  const topColor = built ? PALETTE.yellow : PALETTE.snow;
  const angle = Math.atan2(height - approachHeight, length);

  const wedge = outlined(createRampWedgeGeometry(width, length, height), faceColor);
  group.add(wedge);

  const top = outlined(new THREE.BoxGeometry(width * 0.92, 0.1, length * 0.94), topColor);
  top.position.y = (height + approachHeight) / 2 + 0.06;
  top.rotation.x = angle;
  group.add(top);

  for (const side of [-1, 1]) {
    const rail = outlined(new THREE.BoxGeometry(0.18, 0.15, length * 0.96), built ? PALETTE.lavender : PALETTE.mint);
    rail.position.set(side * (width * 0.46), (height + approachHeight) / 2 + 0.17, 0);
    rail.rotation.x = angle;
    group.add(rail);
  }

  for (const z of [length * 0.24, 0, -length * 0.24]) {
    const progress = (length / 2 - z) / length;
    const stripe = outlined(new THREE.BoxGeometry(width * 0.56, 0.09, 0.42), built ? PALETTE.snow : PALETTE.coral);
    stripe.position.set(0, approachHeight + progress * (height - approachHeight) + 0.14, z);
    stripe.rotation.x = angle;
    group.add(stripe);
  }

  const lip = outlined(new THREE.BoxGeometry(width + 0.38, 0.34, 0.3), built ? PALETTE.lavender : PALETTE.yellow);
  lip.position.set(0, height + 0.04, -length / 2);
  group.add(lip);

  return group;
}

function limb(length: number, color: number, radius = 0.12): THREE.Group {
  const part = outlined(new THREE.CapsuleGeometry(radius, length, 4, 7), color);
  part.position.y = -length / 2;
  return part;
}

function createRiderModel(): THREE.Group {
  const rider = new THREE.Group();
  const board = outlined(new THREE.BoxGeometry(2.05, 0.12, 0.48, 3, 1, 3), PALETTE.coral);
  board.position.y = 0.05;
  board.rotation.y = Math.PI / 2;
  rider.add(board);

  const hips = new THREE.Group();
  hips.position.y = 0.64;
  rider.add(hips);
  const jacket = outlined(new THREE.SphereGeometry(0.43, 10, 8), PALETTE.yellow);
  jacket.scale.set(0.86, 1.14, 0.72);
  jacket.position.y = 0.82;
  hips.add(jacket);
  const head = outlined(new THREE.SphereGeometry(0.28, 10, 8), 0xf2b38b);
  head.position.y = 1.5;
  hips.add(head);
  const beanie = outlined(new THREE.SphereGeometry(0.3, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), PALETTE.pine);
  beanie.position.y = 1.57;
  hips.add(beanie);
  const scarf = outlined(new THREE.TorusGeometry(0.3, 0.08, 6, 12), PALETTE.coral);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.27;
  hips.add(scarf);

  for (const side of [-1, 1]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.23, 0.55, 0);
    legPivot.rotation.z = side * 0.18;
    legPivot.add(limb(0.62, side < 0 ? PALETTE.lavender : PALETTE.pineLight, 0.14));
    hips.add(legPivot);
    const armPivot = new THREE.Group();
    armPivot.name = side < 0 ? "arm-left" : "arm-right";
    armPivot.position.set(side * 0.38, 1.05, 0);
    armPivot.rotation.z = side * 0.72;
    armPivot.add(limb(0.65, PALETTE.yellow, 0.11));
    hips.add(armPivot);
  }
  hips.name = "hips";
  rider.scale.setScalar(1.1);
  return rider;
}

export class GameView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 520);
  private world = new THREE.Group();
  private rider = new THREE.Group();
  private riderTumblePivot = new THREE.Group();
  private riderVisual = createRiderModel();
  private rival = new THREE.Group();
  private rivalVisual = createRiderModel();
  private contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 20),
    new THREE.MeshBasicMaterial({ color: 0x35516a, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  private rivalShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 20),
    new THREE.MeshBasicMaterial({ color: 0x35516a, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  private hips: THREE.Group | null = this.riderVisual.getObjectByName("hips") as THREE.Group;
  private particles: Particle[] = [];
  private snowMaterial = toon(PALETTE.snow, { vertexColors: true });
  private quality: Quality = "medium";
  private lookOffset = 0;
  private elapsedVisual = 0;
  private debugLines = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xfff0c9, 3.1);
  private sunTarget = new THREE.Object3D();
  private snowfall: THREE.Points | null = null;
  private snowfallPositions: Float32Array | null = null;
  private skyDome: THREE.Mesh | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0x5f8fbd);
    this.scene.fog = new THREE.Fog(0xc7d8e1, 135, 470);
    this.createLighting();
    this.createSky();
    this.scene.add(this.world);
    this.createWorld();
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.scale.set(1.8, 0.62, 1);
    this.riderTumblePivot.position.y = 1.18;
    this.riderVisual.position.y = -1.18;
    this.riderTumblePivot.add(this.riderVisual);
    this.rider.add(this.riderTumblePivot);
    this.rival.add(this.rivalVisual);
    this.rivalShadow.rotation.x = -Math.PI / 2;
    this.rivalShadow.scale.set(1.9, .7, 1);
    this.scene.add(this.contactShadow, this.rider, this.rivalShadow, this.rival, this.debugLines);
    this.loadRiderModel();
    this.loadRivalModel();
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private loadRiderModel(): void {
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/snow-main.glb`,
      gltf => {
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const height = Math.max(0.001, bounds.max.y - bounds.min.y);
        const scale = 2.45 / height;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });

        const orientedModel = new THREE.Group();
        // O eixo frontal do GLB não coincide com o eixo longitudinal da prancha.
        // Este ponto médio remove o desvio visual para a esquerda ou direita.
        orientedModel.rotation.y = Math.PI * 0.625;
        orientedModel.add(model);
        this.riderVisual.clear();
        this.riderVisual.scale.setScalar(1);
        this.riderVisual.add(orientedModel);
        this.hips = null;
      },
      undefined,
      error => console.warn("Não foi possível carregar o snowboarder 3D; mantendo o placeholder.", error),
    );
  }

  private loadRivalModel(): void {
    new GLTFLoader().load(
      `${import.meta.env.BASE_URL}models/yeti.glb`,
      gltf => {
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const height = Math.max(.001, bounds.max.y - bounds.min.y);
        const scale = 2.75 / height;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
        model.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        const orientedModel = new THREE.Group();
        // O modelo do Tripo usa o mesmo eixo diagonal do snowboarder principal.
        // Alinha a prancha ao sentido da pista para ele não correr de lado.
        orientedModel.rotation.y = Math.PI * .625;
        orientedModel.add(model);
        this.rivalVisual.clear();
        this.rivalVisual.scale.setScalar(1);
        this.rivalVisual.add(orientedModel);
      },
      undefined,
      error => console.warn("Não foi possível carregar o yeti rival; mantendo o placeholder.", error),
    );
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const dpr = quality === "high" ? 1.75 : quality === "medium" ? 1.35 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dpr));
    this.renderer.shadowMap.enabled = quality !== "performance";
    this.scene.fog = new THREE.Fog(0xc7d8e1, quality === "performance" ? 105 : 135, quality === "performance" ? 350 : 470);
    this.resize();
  }

  setDebug(enabled: boolean): void {
    this.debugLines.visible = enabled;
  }

  rebuildCourse(): void {
    this.world.traverse(object => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material !== this.snowMaterial) material.dispose();
    });
    this.world.clear();
    this.snowfall = null;
    this.snowfallPositions = null;
    this.createWorld();
  }

  render(state: RiderState, rivalState: RivalState, look: number, dt: number): void {
    this.elapsedVisual += dt;
    this.lookOffset += (look * 3.2 - this.lookOffset) * dampAlpha(5, dt);
    const world = courseWorldPoint(state.s, state.x);
    const frame = courseFrame(state.s);
    const boardY = state.y - 0.39;
    this.rider.position.set(world.x, boardY, world.z);
    const groundY = courseTerrainHeight(state.s, state.x);
    const airGap = Math.max(0, boardY - groundY - 0.08);
    this.contactShadow.position.set(world.x, groundY + 0.035, world.z);
    const shadowMaterial = this.contactShadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.opacity = clamp(0.24 - airGap * 0.035, 0.035, 0.24);
    const shadowScale = clamp(1 - airGap * 0.035, 0.55, 1);
    this.contactShadow.scale.set(1.8 * shadowScale, 0.62 * shadowScale, 1);
    if (state.recovering > 0) {
      const progress = clamp(state.tumbleTime / CRASH_RECOVERY_TIME, 0, 1);
      const smooth = (value: number) => value * value * (3 - 2 * value);
      const fallIn = smooth(clamp(progress / 0.22, 0, 1));
      const standUp = smooth(clamp((progress - 0.78) / 0.22, 0, 1));
      const fallen = fallIn * (1 - standUp);
      this.rider.rotation.set(
        0,
        frame.heading + state.heading + state.tumbleDirection * fallen * 0.08,
        0,
      );
      // Combina o tombo frontal com uma queda lateral curta. A elevação do pivô
      // mantém prancha, cabeça e braços acima da neve durante todo o arrasto.
      this.riderTumblePivot.position.y = 1.18 + fallen * 0.16;
      this.riderTumblePivot.rotation.set(
        -fallen * 1.05,
        0,
        state.tumbleDirection * fallen * 0.62,
      );
    } else {
      const airRoll = state.grounded ? 0 : state.spin;
      this.rider.rotation.set(state.grounded ? 0.03 : state.flip, frame.heading + state.heading + airRoll, -state.carve * 0.3);
      this.riderTumblePivot.position.y = 1.18;
      this.riderTumblePivot.rotation.set(0, 0, 0);
    }
    const tuck = state.recovering > 0 ? 0 : clamp((state.speed - 12) / 30, 0, 1);
    if (this.hips) {
      this.hips.position.y = 0.64 - tuck * 0.18;
      this.hips.rotation.x = -0.12 - tuck * 0.38;
    }
    const armSwing = Math.sin(this.elapsedVisual * 8) * 0.08;
    const leftArm = this.hips?.getObjectByName("arm-left");
    const rightArm = this.hips?.getObjectByName("arm-right");
    if (leftArm) leftArm.rotation.x = armSwing + (state.grabTime > 0 ? -1.3 : 0);
    if (rightArm) rightArm.rotation.x = -armSwing + (state.grabTime > 0 ? -1.3 : 0);
    this.updateCamera(state, dt);
    this.updateParticles(dt);
    this.updateSnowfall(state, dt);
    if (state.recovering > 0 && Math.random() < dt * (this.quality === "performance" ? 20 : 42)) {
      const origin = new THREE.Vector3(world.x, groundY + 0.16, world.z);
      const spray = new THREE.Vector3(
        -frame.tx * (2 + Math.random() * 3) + frame.nx * state.tumbleDirection * (1 + Math.random() * 2),
        1.2 + Math.random() * 2.4,
        -frame.tz * (2 + Math.random() * 3) + frame.nz * state.tumbleDirection * (1 + Math.random() * 2),
      );
      this.spawnParticle(origin, Math.random() > 0.18 ? PALETTE.snow : PALETTE.snowBlue, 0.16 + Math.random() * 0.12, 0.48, spray);
    }
    if (state.grounded && state.speed > 12 && Math.random() < dt * (this.quality === "performance" ? 36 : 78)) {
      const origin = new THREE.Vector3(world.x, boardY + 0.08, world.z);
      const spraySpeed = 6 + state.speed * 0.13;
      const backwards = new THREE.Vector3(-frame.tx * spraySpeed, 1.6 + Math.random() * 2.8, -frame.tz * spraySpeed);
      const side = Math.random() > 0.5 ? 1 : -1;
      backwards.x += frame.nx * side * (1.4 + Math.abs(state.carve) * 3);
      backwards.z += frame.nz * side * (1.4 + Math.abs(state.carve) * 3);
      this.spawnParticle(origin, PALETTE.snow, 0.13 + Math.random() * 0.1, 0.5, backwards);
    }
    this.updateRival(rivalState, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updateRival(state: RivalState, dt: number): void {
    const world = courseWorldPoint(state.s, state.x);
    const frame = courseFrame(state.s);
    const groundY = courseTerrainHeight(state.s, state.x);
    const surfaceOffset = Math.max(0, state.y - courseHeight(state.s) - .52);
    this.rival.visible = state.s < COURSE_LENGTH + 4;
    // Usa o relevo lateral real, não apenas a altura da linha central. O pequeno
    // encaixe evita a fresta entre a base da prancha e a neve.
    this.rival.position.set(world.x, groundY + surfaceOffset - .035, world.z);
    this.rival.rotation.set(
      state.stun > 0 ? -Math.min(1.05, state.tumble * 2.7) : state.grounded ? Math.sin(this.elapsedVisual * 9 + state.s * .03) * .035 : 0,
      frame.heading + state.heading + (state.grounded ? 0 : state.spin * clamp(state.airTime / .9, 0, 1)),
      state.stun > 0 ? Math.sin(state.tumble * 8) * .42 : -state.carve * .27,
    );
    const pump = state.grounded && state.stun <= 0 ? (Math.sin(this.elapsedVisual * 9 + state.s * .03) + 1) * .018 : 0;
    this.rivalVisual.position.y = -pump;
    this.rivalVisual.scale.set(1 + pump * .35, 1 - pump * .7, 1 + pump * .35);
    const airGap = Math.max(0, surfaceOffset);
    this.rivalShadow.position.set(world.x, groundY + .04, world.z);
    const material = this.rivalShadow.material as THREE.MeshBasicMaterial;
    material.opacity = clamp(.2 - airGap * .03, .025, .2);
    const scale = clamp(1 - airGap * .035, .55, 1);
    this.rivalShadow.scale.set(1.9 * scale, .7 * scale, 1);

    if (state.grounded && state.speed > 15 && Math.random() < dt * (this.quality === "performance" ? 18 : 38)) {
      const origin = new THREE.Vector3(world.x, groundY + .12, world.z);
      const spray = new THREE.Vector3(-frame.tx * 7 + frame.nx * state.carve * 3, 1.5 + Math.random() * 2, -frame.tz * 7 + frame.nz * state.carve * 3);
      this.spawnParticle(origin, PALETTE.snow, .13 + Math.random() * .08, .42, spray);
    }
  }

  event(event: GameEvent, state: RiderState): void {
    const world = courseWorldPoint(state.s, state.x);
    const position = new THREE.Vector3(world.x, state.y, world.z);
    const count = event.type === "CRASH" ? 20 : event.type === "LAND" ? 14 : event.type === "TAKEOFF" ? 8 : 5;
    const color = event.type === "CRASH" ? PALETTE.coral : event.type === "NEAR_MISS" ? PALETTE.yellow : PALETTE.snowBlue;
    for (let index = 0; index < count; index += 1) this.spawnParticle(position, color, event.type === "CRASH" ? 0.3 : 0.18, 0.65 + Math.random() * 0.4);
  }

  private createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xeaf8ff, 0xb5a8cf, 2.35);
    this.scene.add(hemisphere);
    this.sun.position.set(-65, 110, 35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -48;
    this.sun.shadow.camera.right = 48;
    this.sun.shadow.camera.top = 65;
    this.sun.shadow.camera.bottom = -35;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.target = this.sunTarget;
    this.scene.add(this.sun, this.sunTarget);
  }

  private createSky(): void {
    const geometry = new THREE.SphereGeometry(420, 28, 18);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x4d79ad) },
        horizonColor: { value: new THREE.Color(0xc9dce5) },
        glowColor: { value: new THREE.Color(0xffe8b5) },
      },
      vertexShader: `varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vLocal;uniform vec3 topColor;uniform vec3 horizonColor;uniform vec3 glowColor;void main(){vec3 d=normalize(vLocal);float h=smoothstep(-0.12,0.72,d.y);float glow=pow(max(0.0,dot(d,normalize(vec3(-0.62,0.14,-0.48)))),22.0);vec3 color=mix(horizonColor,topColor,h)+glowColor*glow*0.32;gl_FragColor=vec4(color,1.0);}`,
    });
    this.skyDome = new THREE.Mesh(geometry, material);
    this.skyDome.renderOrder = -1_000;
    this.scene.add(this.skyDome);
  }

  private createWorld(): void {
    const segments = 420;
    // A pista precisa continuar atrás do grid: a câmera de apresentação começa
    // alguns metros antes do atleta e, sem este recuo, enxergava sob o terreno.
    const terrainStart = -52;
    const terrainSpan = COURSE_LENGTH - terrainStart;
    const lanes = [-86, -64, -46, -30, -22, -14, 0, 14, 22, 30, 46, 64, 86];
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const snow = new THREE.Color(PALETTE.snow);
    const blue = new THREE.Color(PALETTE.snowBlue);
    const sideBlue = new THREE.Color(0x91abc6);
    for (let row = 0; row <= segments; row += 1) {
      const s = terrainStart + row / segments * terrainSpan;
      for (const lateral of lanes) {
        const world = courseWorldPoint(s, lateral);
        positions.push(world.x, courseTerrainHeight(s, lateral), world.z);
        const edge = Math.max(0, Math.abs(lateral) - COURSE_HALF_WIDTH);
        const pisteShade = Math.min(1, Math.abs(lateral) / COURSE_HALF_WIDTH);
        const color = edge > 0
          ? blue.clone().lerp(sideBlue, Math.min(1, edge / 50))
          : snow.clone().lerp(blue, pisteShade * 0.34 + (row % 9 === 0 ? 0.035 : 0));
        colors.push(color.r, color.g, color.b);
      }
      if (row < segments) {
        for (let column = 0; column < lanes.length - 1; column += 1) {
          const base = row * lanes.length + column;
          indices.push(base, base + 1, base + lanes.length, base + lanes.length, base + 1, base + lanes.length + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const terrain = new THREE.Mesh(geometry, this.snowMaterial);
    terrain.receiveShadow = true;
    this.world.add(terrain);

    for (const obstacle of OBSTACLES) {
      if (obstacle.decorative) continue;
      let model: THREE.Group;
      if (obstacle.kind === "tree") model = createTree(obstacle.height, obstacle.accent);
      else if (obstacle.kind === "rock") model = createRock(obstacle.radius, obstacle.accent);
      else if (obstacle.kind === "ice") model = createIceCrystal(obstacle.radius, obstacle.accent);
      else if (obstacle.kind === "log") model = createLog(obstacle.radius);
      else if (obstacle.kind === "snowball") model = createSnowball(obstacle.radius, obstacle.accent);
      else model = createFence(obstacle.radius);
      const world = courseWorldPoint(obstacle.s, obstacle.x);
      model.position.set(world.x, courseTerrainHeight(obstacle.s, obstacle.x), world.z);
      model.rotation.y = courseFrame(obstacle.s).heading + (obstacle.s * 0.17) % 0.5 - 0.25;
      this.world.add(model);
    }
    this.createSceneryInstances();
    this.createCourseEdges();
    this.createEventAreas();

    for (const ramp of RAMPS) {
      const length = rampLength(ramp);
      const centerS = ramp.s - length / 2;
      const rampModel = createRampModel(ramp.width, ramp.built, length, rampHeight(ramp));
      const world = courseWorldPoint(centerS, ramp.x);
      rampModel.position.set(world.x, courseTerrainHeight(centerS, ramp.x) + 0.04, world.z);
      rampModel.rotation.set(Math.atan(courseSlope(centerS)), courseFrame(centerS).heading, 0);
      this.world.add(rampModel);
    }

    this.createSnowfall();
  }

  private placeCourseDecoration(object: THREE.Object3D, s: number, lateral: number, yOffset = 0): void {
    const world = courseWorldPoint(s, lateral);
    object.position.set(world.x, courseTerrainHeight(s, lateral) + yOffset, world.z);
    object.rotation.y = courseFrame(s).heading;
    this.world.add(object);
  }

  private createEventAreas(): void {
    const staging = new THREE.Group();
    // Sulcos de máquina quebram a área plana sem competir com o menu.
    const grooveGeometry = new THREE.BoxGeometry(.14, .035, 37);
    const grooveMaterial = toon(0xd7e6ee);
    for (let index = -10; index <= 10; index += 1) {
      const groove = new THREE.Mesh(grooveGeometry, grooveMaterial);
      groove.position.set(index * 2.15, .035, 13.5 + Math.abs(index % 2) * .8);
      groove.receiveShadow = true;
      staging.add(groove);
    }
    // Marcas pintadas levam o olhar até a linha, em vez de deixar um vazio liso.
    for (const side of [-1, 1]) {
      for (let index = 0; index < 3; index += 1) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(2.7, .055, .42),
          toon(index === 1 ? PALETTE.yellow : side < 0 ? PALETTE.coral : PALETTE.mint),
        );
        dash.position.set(side * (7.2 + index * 3.1), .06, 19 + index * 3.5);
        dash.rotation.y = side * .42;
        staging.add(dash);
      }
    }
    const startWorld = courseWorldPoint(0, 0);
    staging.position.set(startWorld.x, courseTerrainHeight(0, 0) + .015, startWorld.z);
    staging.rotation.y = courseFrame(0).heading;
    this.world.add(staging);

    const startArch = createEventArch("PARTIDA", PALETTE.pine, PALETTE.yellow);
    this.placeCourseDecoration(startArch, 21, 0);
    this.placeCourseDecoration(createCheckeredLine(), 4, 0, 0.025);

    const startChalet = createChalet();
    startChalet.rotation.y = 0.18;
    this.placeCourseDecoration(startChalet, 12, -29);
    for (const side of [-1, 1]) {
      const startFlag = createFlag(side < 0 ? PALETTE.coral : PALETTE.lavender);
      startFlag.scale.setScalar(1.18);
      this.placeCourseDecoration(startFlag, 10, side * 18.5);
      for (let index = 0; index < 4; index += 1) {
        const spectator = createSpectator([PALETTE.coral, PALETTE.yellow, PALETTE.mint, PALETTE.lavender][index]);
        spectator.scale.setScalar(0.9 + index * 0.06);
        this.placeCourseDecoration(spectator, 4 + index * 5, side * (22.5 + (index % 2) * 2.4));
      }
    }

    const finishArea = new THREE.Group();
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(62, 0.12, 76), toon(PALETTE.snow));
    plaza.position.set(0, -0.08, -27);
    plaza.receiveShadow = true;
    finishArea.add(plaza);

    const finishArch = createEventArch("META", PALETTE.coral, PALETTE.yellow);
    finishArch.position.set(0, 0.7, 7);
    finishArea.add(finishArch);
    const finishLine = createCheckeredLine(30);
    finishLine.position.set(0, 0.04, 4.2);
    finishArea.add(finishLine);

    const podium = createPodium();
    podium.position.set(-20, 0, -19);
    podium.rotation.y = 0.16;
    finishArea.add(podium);
    const finishChalet = createChalet();
    finishChalet.scale.setScalar(0.82);
    finishChalet.position.set(23, 0, -27);
    finishChalet.rotation.y = -0.24;
    finishArea.add(finishChalet);

    for (const side of [-1, 1]) {
      const flag = createFlag(side < 0 ? PALETTE.mint : PALETTE.lavender);
      flag.position.set(side * 18, 0, -8);
      flag.scale.setScalar(1.35);
      finishArea.add(flag);
      for (let index = 0; index < 5; index += 1) {
        const spectator = createSpectator([PALETTE.yellow, PALETTE.coral, PALETTE.mint, PALETTE.lavender, PALETTE.pineLight][index]);
        spectator.position.set(side * (21 + (index % 2) * 2), 0, 1 - index * 5.2);
        spectator.rotation.y = side * -0.55;
        spectator.scale.setScalar(0.95 + (index % 3) * 0.08);
        finishArea.add(spectator);
      }
    }

    const finishWorld = courseWorldPoint(COURSE_LENGTH, 0);
    finishArea.position.set(finishWorld.x, courseHeight(COURSE_LENGTH), finishWorld.z);
    finishArea.rotation.y = courseFrame(COURSE_LENGTH).heading;
    this.world.add(finishArea);
  }

  private createSceneryInstances(): void {
    const scenery = OBSTACLES.filter(obstacle => obstacle.decorative);
    const trees = scenery.filter(obstacle => obstacle.kind === "tree");
    const rocks = scenery.filter(obstacle => obstacle.kind === "rock");
    const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.48, 2.2, 6);
    const crownGeometry = new THREE.ConeGeometry(1.5, 3.5, 7);
    const upperGeometry = new THREE.ConeGeometry(1.15, 3, 7);
    const trunks = new THREE.InstancedMesh(trunkGeometry, toon(0x6f5145), trees.length);
    const crowns = new THREE.InstancedMesh(crownGeometry, toon(PALETTE.pine), trees.length);
    const uppers = new THREE.InstancedMesh(upperGeometry, toon(PALETTE.pineLight), trees.length);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    trees.forEach((tree, index) => {
      const world = courseWorldPoint(tree.s, tree.x);
      const ground = courseTerrainHeight(tree.s, tree.x);
      const size = tree.height / 7;
      quaternion.setFromEuler(new THREE.Euler(0, (tree.s * 0.23) % Math.PI, 0));
      scale.set(size, size, size);
      position.set(world.x, ground + 1.1 * size, world.z);
      matrix.compose(position, quaternion, scale);
      trunks.setMatrixAt(index, matrix);
      position.y = ground + 3.3 * size;
      matrix.compose(position, quaternion, scale);
      crowns.setMatrixAt(index, matrix);
      position.y = ground + 5.25 * size;
      matrix.compose(position, quaternion, scale);
      uppers.setMatrixAt(index, matrix);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    uppers.castShadow = true;
    this.world.add(trunks, crowns, uppers);

    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const rockInstances = new THREE.InstancedMesh(rockGeometry, toon(PALETTE.rock), rocks.length);
    rocks.forEach((rock, index) => {
      const world = courseWorldPoint(rock.s, rock.x);
      quaternion.setFromEuler(new THREE.Euler(0.1, (rock.s * 0.31) % Math.PI, -0.08));
      scale.set(rock.radius * 1.15, rock.radius * 0.72, rock.radius * 0.9);
      position.set(world.x, courseTerrainHeight(rock.s, rock.x) + rock.radius * 0.55, world.z);
      matrix.compose(position, quaternion, scale);
      rockInstances.setMatrixAt(index, matrix);
    });
    rockInstances.castShadow = true;
    this.world.add(rockInstances);
  }

  private createCourseEdges(): void {
    const samples = 240;
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index <= samples; index += 1) {
        const s = index / samples * COURSE_LENGTH;
        const lateral = side * (COURSE_HALF_WIDTH + 0.25);
        const world = courseWorldPoint(s, lateral);
        points.push(new THREE.Vector3(world.x, courseTerrainHeight(s, lateral) + 0.12, world.z));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: side < 0 ? PALETTE.coral : PALETTE.yellow, transparent: true, opacity: 0.78 }),
      );
      this.world.add(line);
    }

    const markerCount = Math.floor(COURSE_LENGTH / 32) * 2;
    const markerGeometry = new THREE.ConeGeometry(0.24, 1.2, 5);
    const markers = new THREE.InstancedMesh(markerGeometry, toon(PALETTE.coral), markerCount);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let markerIndex = 0;
    for (let s = 32; s < COURSE_LENGTH; s += 32) {
      for (const side of [-1, 1]) {
        const lateral = side * (COURSE_HALF_WIDTH + 0.7);
        const world = courseWorldPoint(s, lateral);
        position.set(world.x, courseTerrainHeight(s, lateral) + 0.6, world.z);
        rotation.setFromEuler(new THREE.Euler(0, courseFrame(s).heading, side * 0.12));
        matrix.compose(position, rotation, scale);
        markers.setMatrixAt(markerIndex, matrix);
        markerIndex += 1;
      }
    }
    markers.castShadow = true;
    this.world.add(markers);
  }

  private createSnowfall(): void {
    const count = 1_400;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 92;
      positions[index * 3 + 1] = Math.random() * 30 - 3;
      positions[index * 3 + 2] = Math.random() * 115 - 36;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.24, transparent: true, opacity: 0.78, depthWrite: false });
    this.snowfall = new THREE.Points(geometry, material);
    this.snowfallPositions = positions;
    this.world.add(this.snowfall);
  }

  private updateCamera(state: RiderState, dt: number): void {
    const speedFactor = clamp((state.speed - 12) / 30, 0, 1);
    const world = courseWorldPoint(state.s, state.x);
    const frame = courseFrame(state.s);
    const behind = 7.6 + speedFactor * 3.2;
    const cameraY = state.y + 3.1 + (state.grounded ? 0 : 1.15);
    const desired = new THREE.Vector3(
      world.x - frame.tx * behind + frame.nx * this.lookOffset,
      cameraY,
      world.z - frame.tz * behind + frame.nz * this.lookOffset,
    );
    this.camera.position.lerp(desired, dampAlpha(state.recovering > 0 ? 9 : 4.8, dt));
    const focusDistance = 16 + speedFactor * 22;
    const focus = new THREE.Vector3(
      world.x + frame.tx * focusDistance + frame.nx * this.lookOffset * 0.25,
      state.y + 0.85,
      world.z + frame.tz * focusDistance + frame.nz * this.lookOffset * 0.25,
    );
    this.camera.lookAt(focus);
    this.camera.fov += (60 + speedFactor * 25 - this.camera.fov) * dampAlpha(4.8, dt);
    this.camera.updateProjectionMatrix();
    this.skyDome?.position.copy(this.camera.position);
    this.sun.position.set(world.x - 65, state.y + 110, world.z + 35);
    this.sunTarget.position.set(world.x, state.y, world.z);
  }

  private updateSnowfall(state: RiderState, dt: number): void {
    if (!this.snowfall || !this.snowfallPositions) return;
    const world = courseWorldPoint(state.s, state.x);
    const frame = courseFrame(state.s);
    this.snowfall.position.set(world.x, state.y + 3, world.z);
    this.snowfall.rotation.y = frame.heading;
    const visibleCount = this.quality === "high" ? 1_400 : this.quality === "medium" ? 900 : 480;
    this.snowfall.geometry.setDrawRange(0, visibleCount);
    for (let index = 0; index < visibleCount; index += 1) {
      const offset = index * 3;
      this.snowfallPositions[offset + 1] -= dt * (3.5 + (index % 7) * 0.24);
      this.snowfallPositions[offset + 2] += dt * (4 + state.speed * 0.28);
      if (this.snowfallPositions[offset + 1] < -5) this.snowfallPositions[offset + 1] = 25 + (index % 11) * 0.45;
      if (this.snowfallPositions[offset + 2] > 78) this.snowfallPositions[offset + 2] = -36;
    }
    (this.snowfall.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  private spawnParticle(origin: THREE.Vector3, color: number, size: number, life: number, initialVelocity?: THREE.Vector3): void {
    if (this.particles.length > (this.quality === "performance" ? 70 : 150)) return;
    const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(size), new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.5, (Math.random() - 0.5) * 1.2));
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      velocity: initialVelocity?.clone() ?? new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 4, 1 + Math.random() * 3),
      life,
      maxLife: life,
    });
  }

  private updateParticles(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.velocity.y -= 7 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      const material = particle.mesh.material as THREE.MeshBasicMaterial;
      material.opacity = clamp(particle.life / particle.maxLife, 0, 1);
      particle.mesh.rotation.x += dt * 5;
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        material.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }
}
