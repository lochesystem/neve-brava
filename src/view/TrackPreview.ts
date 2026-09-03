import * as THREE from "three";
import { courseCenterFor, courseHeightFor, type CourseDefinition, type ObstacleKind } from "../core/course.ts";

const SAMPLES = 180;
const COURSE_THEMES = [
  { snow: 0xf7eed5, edge: 0x57c8ad, accent: 0xffc94f, ground: 0x315f72 },
  { snow: 0xe9f7fb, edge: 0x75cde8, accent: 0x9be8ff, ground: 0x294b69 },
  { snow: 0xf2f0df, edge: 0x72b895, accent: 0xffa85f, ground: 0x315846 },
  { snow: 0xeee8f6, edge: 0xb393dc, accent: 0xff725e, ground: 0x382f5d },
] as const;

function pointAt(course: CourseDefinition, s: number): THREE.Vector3 {
  return new THREE.Vector3(
    courseCenterFor(course, s) * .72,
    (courseHeightFor(course, s) - course.startHeight) * .52,
    (course.length * .5 - s) * .14,
  );
}

function sideAt(course: CourseDefinition, s: number): THREE.Vector3 {
  const before = pointAt(course, Math.max(0, s - 2));
  const after = pointAt(course, Math.min(course.length, s + 2));
  const tangent = after.sub(before).setY(0).normalize();
  return new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
}

function addCourseRibbon(group: THREE.Group, course: CourseDefinition, theme: typeof COURSE_THEMES[number]): void {
  const positions: number[] = [], colors: number[] = [];
  const snow = new THREE.Color(theme.snow), sectionColor = new THREE.Color();
  for (let index = 0; index < SAMPLES; index += 1) {
    const s0 = index / SAMPLES * course.length, s1 = (index + 1) / SAMPLES * course.length;
    const a = pointAt(course, s0), b = pointAt(course, s1);
    const sideA = sideAt(course, s0), sideB = sideAt(course, s1), half = course.halfWidth * .92;
    const leftA = a.clone().addScaledVector(sideA, -half), rightA = a.clone().addScaledVector(sideA, half);
    const leftB = b.clone().addScaledVector(sideB, -half), rightB = b.clone().addScaledVector(sideB, half);
    positions.push(...leftA.toArray(), ...rightA.toArray(), ...leftB.toArray(), ...rightA.toArray(), ...rightB.toArray(), ...leftB.toArray());
    const section = course.sections.find(candidate => s0 >= candidate.start && s0 < candidate.end);
    sectionColor.set(section?.color ?? theme.edge).lerp(snow, .72);
    for (let vertex = 0; vertex < 6; vertex += 1) colors.push(sectionColor.r, sectionColor.g, sectionColor.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: .04, side: THREE.DoubleSide })));

  const rails: number[] = [];
  for (let index = 0; index < SAMPLES; index += 1) {
    const s0 = index / SAMPLES * course.length, s1 = (index + 1) / SAMPLES * course.length;
    for (const direction of [-1, 1]) {
      const a = pointAt(course, s0).addScaledVector(sideAt(course, s0), direction * course.halfWidth * .94);
      const b = pointAt(course, s1).addScaledVector(sideAt(course, s1), direction * course.halfWidth * .94);
      a.y += .6; b.y += .6; rails.push(...a.toArray(), ...b.toArray());
    }
  }
  const railGeometry = new THREE.BufferGeometry();
  railGeometry.setAttribute("position", new THREE.Float32BufferAttribute(rails, 3));
  group.add(new THREE.LineSegments(railGeometry, new THREE.LineBasicMaterial({ color: theme.edge, transparent: true, opacity: .95, toneMapped: false })));
}

function obstacleGeometry(kind: ObstacleKind): THREE.BufferGeometry {
  if (kind === "tree") return new THREE.ConeGeometry(4.2, 13, 7);
  if (kind === "ice") return new THREE.ConeGeometry(3.5, 10, 5);
  if (kind === "rock") return new THREE.DodecahedronGeometry(3.7, 0);
  if (kind === "snowball") return new THREE.SphereGeometry(4, 10, 7);
  return new THREE.BoxGeometry(9, 2.2, 2);
}

function obstacleColor(kind: ObstacleKind): number {
  if (kind === "tree") return 0x2c745f;
  if (kind === "ice") return 0x72d7ef;
  if (kind === "rock") return 0x718294;
  if (kind === "snowball") return 0xffffff;
  return 0x87543c;
}

function addCourseDetails(group: THREE.Group, course: CourseDefinition, theme: typeof COURSE_THEMES[number]): void {
  const obstacleMaterials = new Map<ObstacleKind, THREE.MeshStandardMaterial>();
  const obstacleGeometries = new Map<ObstacleKind, THREE.BufferGeometry>();
  for (const obstacle of course.obstacles) {
    if (obstacle.decorative) continue;
    const material = obstacleMaterials.get(obstacle.kind)
      ?? new THREE.MeshStandardMaterial({ color: obstacleColor(obstacle.kind), roughness: .72, metalness: obstacle.kind === "ice" ? .18 : 0 });
    const geometry = obstacleGeometries.get(obstacle.kind) ?? obstacleGeometry(obstacle.kind);
    obstacleMaterials.set(obstacle.kind, material);
    obstacleGeometries.set(obstacle.kind, geometry);
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(pointAt(course, obstacle.s)).addScaledVector(sideAt(course, obstacle.s), obstacle.x * .92);
    marker.position.y += obstacle.kind === "tree" ? 6.5 : obstacle.kind === "ice" ? 5 : 2;
    marker.scale.setScalar(obstacle.accent ? 1.22 : 1);
    group.add(marker);
  }

  const rampMaterial = new THREE.MeshStandardMaterial({ color: theme.accent, roughness: .5, metalness: .08 });
  for (const ramp of course.ramps) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(Math.max(8, ramp.width * 1.05), 1.1, 6), rampMaterial);
    marker.position.copy(pointAt(course, ramp.s)).addScaledVector(sideAt(course, ramp.s), ramp.x * .92);
    marker.position.y += 1;
    marker.rotation.y = Math.atan2(sideAt(course, ramp.s).z, sideAt(course, ramp.s).x) + Math.PI / 2;
    marker.rotation.x = -.13;
    group.add(marker);
  }

  const gateMaterial = new THREE.MeshBasicMaterial({ color: theme.accent, toneMapped: false });
  for (const s of [0, course.length]) {
    const gate = new THREE.Group(), width = course.halfWidth * 1.45;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width * 2, .8, .8), gateMaterial); bar.position.y = 5;
    gate.add(bar);
    for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.8, 5.4, .8), gateMaterial); post.position.set(side * width, 2.4, 0); gate.add(post); }
    gate.position.copy(pointAt(course, s));
    gate.rotation.y = Math.atan2(sideAt(course, s).z, sideAt(course, s).x);
    group.add(gate);
  }
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments)) return;
    geometries.add(object.geometry);
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    entries.forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
}

export class TrackPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  private model = new THREE.Group();
  private courseId = "";
  private visible = false;
  private lastTime = performance.now();

  constructor(private canvas: HTMLCanvasElement, mobile = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1 : 1.35));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.camera.position.set(7.1, 4.8, 7.8); this.camera.lookAt(0, -.25, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x31576a, 2.8));
    const key = new THREE.DirectionalLight(0xfff4d8, 4.2); key.position.set(5, 9, 6); this.scene.add(key);
    requestAnimationFrame(this.animate);
  }

  setVisible(visible: boolean): void { this.visible = visible; }

  setCourse(course: CourseDefinition): void {
    if (course.id === this.courseId) return;
    this.courseId = course.id;
    this.canvas.setAttribute("aria-label", `Maquete tridimensional da pista real ${course.name}`);
    disposeObject(this.model); this.scene.remove(this.model);
    const theme = COURSE_THEMES[Math.max(0, Math.min(COURSE_THEMES.length - 1, course.order - 1))];
    const content = new THREE.Group(); addCourseRibbon(content, course, theme); addCourseDetails(content, course, theme);
    const bounds = new THREE.Box3().setFromObject(content), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const scale = 8.8 / Math.max(size.x, size.z, 1);
    content.scale.setScalar(scale); content.position.copy(center).multiplyScalar(-scale);
    this.model = new THREE.Group(); this.model.add(content); this.model.position.x = .65; this.model.rotation.set(-.09, -.42, 0); this.scene.add(this.model);
  }

  private animate = (now: number): void => {
    requestAnimationFrame(this.animate);
    const dt = Math.min(.05, (now - this.lastTime) / 1_000); this.lastTime = now;
    if (!this.visible || !this.courseId) return;
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight), ratio = this.renderer.getPixelRatio();
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.zoom = Math.max(1, Math.min(1.7, this.camera.aspect / 2.6));
      this.camera.updateProjectionMatrix();
    }
    this.model.rotation.y += dt * .2;
    this.renderer.render(this.scene, this.camera);
  };
}
