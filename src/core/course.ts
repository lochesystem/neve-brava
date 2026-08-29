import { clamp } from "./math.ts";

export type ObstacleKind = "tree" | "rock" | "fence" | "ice" | "log" | "snowball";
export type Obstacle = { id: string; kind: ObstacleKind; s: number; x: number; radius: number; height: number; accent?: boolean; decorative?: boolean };
export type Ramp = { id: string; s: number; x: number; width: number; launch: number; built: boolean };
export type CourseSection = { start: number; end: number; name: string; color: string };
type Wave = { amplitude: number; frequency: number; phase: number };

export type CourseDefinition = {
  id: string; order: number; name: string; subtitle: string; description: string; difficulty: string;
  length: number; halfWidth: number; startHeight: number; descent: number; terrainRoughness: number; scenerySeed: number;
  curveWaves: Wave[]; heightWaves: Wave[]; sections: CourseSection[]; ramps: Ramp[]; obstacles: Obstacle[];
};

const hazard = (id: string, kind: ObstacleKind, s: number, x: number, radius: number, height: number, accent = false): Obstacle => ({ id, kind, s, x, radius, height, accent });
const jump = (id: string, s: number, x: number, width: number, launch: number, built = false): Ramp => ({ id, s, x, width, launch, built });

export const COURSES: CourseDefinition[] = [
  {
    id: "vale-bravo", order: 1, name: "Vale Bravo", subtitle: "A linha de abertura", difficulty: "INICIANTE",
    description: "Curvas largas, slalom e quatro saltos para aprender a sustentar velocidade.",
    length: 3_000, halfWidth: 20, startHeight: 78, descent: 0.115, terrainRoughness: 0.55, scenerySeed: 0x4e455645,
    curveWaves: [{ amplitude: 52, frequency: .0042, phase: 0 }, { amplitude: 17, frequency: .0105, phase: .7 }, { amplitude: 14, frequency: .015, phase: 1.8 }, { amplitude: 24, frequency: .0017, phase: 0 }],
    heightWaves: [{ amplitude: 2.8, frequency: .012, phase: 0 }, { amplitude: .65, frequency: .035, phase: 0 }],
    sections: [
      { start: 0, end: 360, name: "Primeiras curvas", color: "#ffcf5a" }, { start: 360, end: 820, name: "Bosque dos recortes", color: "#78e0d0" },
      { start: 820, end: 1_280, name: "Serpentina azul", color: "#9bb7ff" }, { start: 1_280, end: 1_820, name: "Vale do vento", color: "#ff8f82" },
      { start: 1_820, end: 3_000, name: "Salto do sol", color: "#d89dff" },
    ],
    ramps: [jump("pine", 430, -7, 6, 8.2), jump("banner", 910, 7.5, 5.5, 9, true), jump("canyon", 1_455, -5.5, 7, 10.2), jump("final", 2_730, 0, 11, 12.2, true)],
    obstacles: [
      hazard("gate-l", "tree", 115, -7, 1.15, 6), hazard("gate-r", "tree", 115, 7, 1.15, 6), hazard("first-rock", "rock", 205, 1.5, 1.5, 2.4, true),
      hazard("slalom-a", "fence", 285, -9, 2.4, 1.5), hazard("slalom-b", "fence", 330, 8, 2.4, 1.5), hazard("split-rock", "rock", 585, 0, 2.1, 3.2, true),
      hazard("split-l", "tree", 650, -5, 1.25, 7), hazard("split-r", "tree", 650, 5, 1.25, 7), hazard("blue-fence", "fence", 805, -7.5, 3.2, 1.5),
      hazard("banner-rock", "rock", 900, 1.5, 1.65, 2.6), hazard("serpent-a", "tree", 1_030, -8, 1.2, 6), hazard("serpent-b", "tree", 1_080, 7, 1.2, 6),
      hazard("serpent-c", "rock", 1_135, -4, 1.55, 2.7), hazard("serpent-d", "fence", 1_195, 8.5, 2.6, 1.5), hazard("wind-l", "rock", 1_335, -8, 1.7, 2.8),
      hazard("wind-r", "rock", 1_335, 8, 1.7, 2.8), hazard("landing", "rock", 1_590, -9, 1.8, 3), hazard("speed-a", "fence", 1_710, -5, 2.7, 1.5),
      hazard("speed-b", "fence", 1_770, 6, 2.7, 1.5), hazard("forest-a", "tree", 1_930, -7, 1.25, 7), hazard("forest-b", "tree", 1_975, 6, 1.25, 7),
      hazard("forest-c", "rock", 2_025, -3, 1.65, 2.8), hazard("choice-l", "fence", 2_130, -10, 3.5, 1.6), hazard("choice-r", "fence", 2_130, 10, 3.5, 1.6),
      hazard("late-a", "rock", 2_310, 7, 1.75, 3), hazard("late-b", "tree", 2_390, -6, 1.3, 7), hazard("late-c", "fence", 2_475, 8, 2.7, 1.5),
      hazard("sun-l", "tree", 2_590, -5, 1.25, 7), hazard("sun-r", "tree", 2_590, 5, 1.25, 7), hazard("last-snow", "snowball", 2_815, -5, 1.65, 2.5),
    ],
  },
  {
    id: "canion-cristal", order: 2, name: "Cânion Cristal", subtitle: "Gelo entre paredes", difficulty: "INTERMEDIÁRIA",
    description: "Corredor estreito, cotovelos rápidos, cristais de gelo e troncos atravessados.",
    length: 3_200, halfWidth: 17.5, startHeight: 92, descent: .112, terrainRoughness: .85, scenerySeed: 0x43525953,
    curveWaves: [{ amplitude: 65, frequency: .0051, phase: .2 }, { amplitude: 24, frequency: .0128, phase: 1.1 }, { amplitude: 11, frequency: .021, phase: 2.2 }, { amplitude: 28, frequency: .0022, phase: 1.8 }],
    heightWaves: [{ amplitude: 3.4, frequency: .014, phase: .4 }, { amplitude: .85, frequency: .041, phase: 1.1 }],
    sections: [
      { start: 0, end: 520, name: "Porta de gelo", color: "#a9e8ff" }, { start: 520, end: 1_100, name: "Cotovelo branco", color: "#78e0d0" },
      { start: 1_100, end: 1_780, name: "Garganta azul", color: "#9bb7ff" }, { start: 1_780, end: 2_480, name: "Fenda quebrada", color: "#d89dff" },
      { start: 2_480, end: 3_200, name: "Lâmina final", color: "#ff8f82" },
    ],
    ramps: [jump("crystal-a", 520, 6, 5.5, 8.8, true), jump("crystal-b", 1_180, -6, 6, 9.6), jump("crystal-c", 2_050, 5, 5.5, 10.4, true), jump("crystal-final", 2_890, -2, 9, 11.8)],
    obstacles: [
      hazard("ice-a", "ice", 170, -4, 1.7, 3.8, true), hazard("ice-b", "ice", 235, 6, 1.5, 3.4), hazard("log-a", "log", 340, -7, 3.1, 1.35),
      hazard("snow-a", "snowball", 430, 5, 1.7, 2.6), hazard("ice-gate-l", "ice", 630, -8, 1.8, 4.2), hazard("ice-gate-r", "ice", 630, 8, 1.8, 4.2),
      hazard("log-b", "log", 770, 5, 3, 1.4), hazard("crystal-rock", "rock", 920, -2, 2, 3.1, true), hazard("ice-c", "ice", 1_060, 7, 1.6, 3.7),
      hazard("fence-a", "fence", 1_260, -7, 2.8, 1.5), hazard("snow-b", "snowball", 1_390, 2, 2, 2.8), hazard("log-c", "log", 1_510, 8, 3.2, 1.35),
      hazard("ice-d", "ice", 1_660, -5, 1.9, 4.4, true), hazard("ice-e", "ice", 1_820, 6, 1.5, 3.5), hazard("fence-b", "fence", 1_940, -8, 2.9, 1.5),
      hazard("snow-c", "snowball", 2_180, -1, 2.2, 3), hazard("log-d", "log", 2_330, 7, 3.1, 1.4), hazard("ice-f", "ice", 2_480, -7, 1.8, 4),
      hazard("ice-g", "ice", 2_590, 5, 1.7, 3.9, true), hazard("fence-c", "fence", 2_710, -4, 3, 1.5), hazard("snow-d", "snowball", 2_820, 7, 1.8, 2.7),
      hazard("log-e", "log", 3_020, -6, 3.1, 1.35),
    ],
  },
  {
    id: "bosque-torto", order: 3, name: "Bosque Torto", subtitle: "A montanha não coopera", difficulty: "AVANÇADA",
    description: "Pista larga porém irregular, zigue-zagues curtos, árvores caídas e neve acumulada.",
    length: 3_400, halfWidth: 21, startHeight: 108, descent: .11, terrainRoughness: 1.15, scenerySeed: 0x544f5254,
    curveWaves: [{ amplitude: 43, frequency: .0066, phase: .4 }, { amplitude: 31, frequency: .0108, phase: 2.4 }, { amplitude: 18, frequency: .0185, phase: .7 }, { amplitude: 34, frequency: .0025, phase: 2.1 }],
    heightWaves: [{ amplitude: 3.8, frequency: .016, phase: 1.2 }, { amplitude: 1.05, frequency: .046, phase: .3 }],
    sections: [
      { start: 0, end: 600, name: "Troncos tortos", color: "#ffcf5a" }, { start: 600, end: 1_220, name: "Dentes de pinheiro", color: "#57c8ad" },
      { start: 1_220, end: 1_900, name: "Ondas de neve", color: "#9bb7ff" }, { start: 1_900, end: 2_650, name: "Mata fechada", color: "#ff8f82" },
      { start: 2_650, end: 3_400, name: "Clareira brava", color: "#d89dff" },
    ],
    ramps: [jump("wood-a", 610, -8, 7, 9.2), jump("wood-b", 1_330, 8, 6, 10, true), jump("wood-c", 2_210, -4, 8, 10.8), jump("wood-final", 3_080, 4, 9, 12, true)],
    obstacles: [
      hazard("tree-a", "tree", 150, -4, 1.35, 7.2), hazard("tree-b", "tree", 230, 6, 1.3, 7), hazard("log-a", "log", 330, 0, 3.5, 1.45, true),
      hazard("snow-a", "snowball", 470, -8, 2.2, 3), hazard("tree-c", "tree", 690, 2, 1.35, 7.5), hazard("tree-d", "tree", 760, -7, 1.3, 6.8),
      hazard("log-b", "log", 880, 8, 3.2, 1.4), hazard("rock-a", "rock", 1_020, -2, 2.1, 3.3), hazard("snow-b", "snowball", 1_160, 7, 2.3, 3.1),
      hazard("fence-a", "fence", 1_310, -9, 3, 1.5), hazard("tree-e", "tree", 1_470, 5, 1.4, 7.7, true), hazard("log-c", "log", 1_610, -6, 3.6, 1.5),
      hazard("snow-c", "snowball", 1_760, 1, 2.5, 3.3), hazard("tree-f", "tree", 1_910, -8, 1.35, 7.4), hazard("tree-g", "tree", 1_980, 7, 1.3, 7.1),
      hazard("rock-b", "rock", 2_100, 0, 2.2, 3.5, true), hazard("log-d", "log", 2_330, 6, 3.4, 1.45), hazard("snow-d", "snowball", 2_470, -5, 2.25, 3),
      hazard("tree-h", "tree", 2_610, 8, 1.4, 7.8), hazard("fence-b", "fence", 2_760, -8, 3.1, 1.55), hazard("log-e", "log", 2_890, 1, 3.6, 1.5, true),
      hazard("snow-e", "snowball", 3_170, -6, 2.1, 2.9), hazard("tree-i", "tree", 3_260, 7, 1.4, 7.6),
    ],
  },
  {
    id: "pico-tempestade", order: 4, name: "Pico Tempestade", subtitle: "A descida sem linha reta", difficulty: "EXTREMA",
    description: "Curvas fechadas, piso ondulado, cristais, bloqueios e os maiores saltos da campanha.",
    length: 3_600, halfWidth: 18.5, startHeight: 128, descent: .108, terrainRoughness: 1.35, scenerySeed: 0x53544f52,
    curveWaves: [{ amplitude: 72, frequency: .0058, phase: .5 }, { amplitude: 27, frequency: .0145, phase: 2.2 }, { amplitude: 16, frequency: .024, phase: 1.4 }, { amplitude: 38, frequency: .0028, phase: .9 }],
    heightWaves: [{ amplitude: 4.1, frequency: .017, phase: .6 }, { amplitude: 1.1, frequency: .049, phase: 1.6 }],
    sections: [
      { start: 0, end: 620, name: "Cornija alta", color: "#a9e8ff" }, { start: 620, end: 1_320, name: "Serra serrilhada", color: "#ffcf5a" },
      { start: 1_320, end: 2_050, name: "Olho da nevasca", color: "#d89dff" }, { start: 2_050, end: 2_850, name: "Parede do trovão", color: "#ff8f82" },
      { start: 2_850, end: 3_600, name: "Último raio", color: "#57c8ad" },
    ],
    ramps: [jump("storm-a", 540, 5, 6, 10.2, true), jump("storm-b", 1_270, -6, 7, 11), jump("storm-c", 2_140, 5, 7, 11.8, true), jump("storm-final", 3_280, 0, 10, 13.2, true)],
    obstacles: [
      hazard("ice-a", "ice", 145, 4, 1.8, 4.2), hazard("fence-a", "fence", 255, -7, 3, 1.5), hazard("snow-a", "snowball", 370, 0, 2.3, 3.1),
      hazard("log-a", "log", 470, 8, 3.5, 1.45), hazard("ice-b", "ice", 700, -6, 2, 4.6, true), hazard("ice-c", "ice", 780, 7, 1.7, 4),
      hazard("fence-b", "fence", 900, 1, 3.4, 1.6), hazard("rock-a", "rock", 1_020, -8, 2.2, 3.5), hazard("log-b", "log", 1_140, 6, 3.5, 1.5),
      hazard("snow-b", "snowball", 1_350, -2, 2.5, 3.4), hazard("ice-d", "ice", 1_490, 8, 2, 4.7), hazard("fence-c", "fence", 1_630, -7, 3.2, 1.55),
      hazard("ice-e", "ice", 1_790, 1, 2.2, 5, true), hazard("log-c", "log", 1_940, -8, 3.6, 1.5), hazard("snow-c", "snowball", 2_130, 7, 2.4, 3.2),
      hazard("rock-b", "rock", 2_300, -1, 2.3, 3.6), hazard("ice-f", "ice", 2_450, -8, 1.9, 4.4), hazard("fence-d", "fence", 2_590, 7, 3.3, 1.55),
      hazard("log-d", "log", 2_740, 0, 3.7, 1.55, true), hazard("snow-d", "snowball", 2_920, -7, 2.5, 3.4), hazard("ice-g", "ice", 3_040, 7, 2, 4.6),
      hazard("fence-e", "fence", 3_170, -7, 3.2, 1.55), hazard("rock-c", "rock", 3_420, 5, 2.3, 3.6), hazard("ice-h", "ice", 3_500, -6, 1.8, 4.2),
    ],
  },
];

let activeCourse = COURSES[0];
export let COURSE_LENGTH = activeCourse.length;
export let COURSE_HALF_WIDTH = activeCourse.halfWidth;
export let SECTIONS = activeCourse.sections;
export let RAMPS: Ramp[] = [];
export let OBSTACLES: Obstacle[] = [];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function decorateSafeEdges(course: CourseDefinition): Obstacle[] {
  const random = mulberry32(course.scenerySeed);
  const result: Obstacle[] = [];
  for (let s = 35; s < course.length - 35; s += 13 + random() * 8) {
    for (const side of [-1, 1]) for (let layer = 0; layer < 2; layer += 1) {
      const x = side * (course.halfWidth + 4 + layer * 16 + random() * 26);
      const kind: ObstacleKind = random() > .12 ? "tree" : "rock";
      result.push({ id: `${course.id}-edge-${result.length}`, kind, s: s + (random() - .5) * 15, x,
        radius: kind === "tree" ? 1.1 : 1.45, height: kind === "tree" ? 5 + random() * 4.5 : 2.2 + random(), decorative: true });
    }
  }
  return result;
}

function activate(course: CourseDefinition): void {
  activeCourse = course;
  COURSE_LENGTH = course.length;
  COURSE_HALF_WIDTH = course.halfWidth;
  SECTIONS = course.sections;
  RAMPS = course.ramps.map(item => ({ ...item, id: `${course.id}-${item.id}` }));
  OBSTACLES = [...course.obstacles.map(item => ({ ...item, id: `${course.id}-${item.id}` })), ...decorateSafeEdges(course)];
}

export function setActiveCourse(id: string): CourseDefinition {
  const course = COURSES.find(candidate => candidate.id === id) ?? COURSES[0];
  activate(course);
  return course;
}
export function getActiveCourse(): CourseDefinition { return activeCourse; }
activate(activeCourse);

export function rampLength(item: Ramp): number { return item.built ? 9.5 : 8.5; }
export function rampHeight(item: Ramp): number { return item.built ? 2.35 : 1.8; }
export function rampSurfaceElevation(s: number, lateral: number): number {
  for (const item of RAMPS) {
    if (Math.abs(lateral - item.x) > item.width / 2 + .7) continue;
    const length = rampLength(item), start = item.s - length;
    if (s >= start && s <= item.s) return clamp((s - start) / length, 0, 1) * rampHeight(item);
  }
  return 0;
}

export function courseHeight(s: number): number {
  const progress = clamp(s, 0, COURSE_LENGTH);
  return activeCourse.startHeight - progress * activeCourse.descent
    + activeCourse.heightWaves.reduce((sum, wave) => sum + Math.sin(progress * wave.frequency + wave.phase) * wave.amplitude, 0);
}
export function courseSlope(s: number): number {
  const epsilon = .5;
  return (courseHeight(s + epsilon) - courseHeight(s - epsilon)) / (epsilon * 2);
}
export function courseCenterX(s: number): number {
  const progress = clamp(s, 0, COURSE_LENGTH);
  return activeCourse.curveWaves.reduce((sum, wave) => sum + Math.sin(progress * wave.frequency + wave.phase) * wave.amplitude, 0);
}
export function courseFrame(s: number): { tx: number; tz: number; nx: number; nz: number; heading: number } {
  const epsilon = .5, dx = (courseCenterX(s + epsilon) - courseCenterX(s - epsilon)) / (epsilon * 2), length = Math.hypot(dx, 1);
  const tx = dx / length, tz = -1 / length, nx = -tz, nz = tx;
  return { tx, tz, nx, nz, heading: Math.atan2(-tx, -tz) };
}
export function courseWorldPoint(s: number, lateral = 0): { x: number; z: number } {
  const frame = courseFrame(s);
  return { x: courseCenterX(s) + frame.nx * lateral, z: -s + frame.nz * lateral };
}
export function courseTerrainHeight(s: number, lateral: number): number {
  const edge = Math.max(0, Math.abs(lateral) - COURSE_HALF_WIDTH);
  const mountain = edge * .16 + Math.sin(s * .021 + lateral * .12) * Math.min(2.8, edge * .045);
  const pisteCrown = -Math.pow(Math.abs(lateral) / COURSE_HALF_WIDTH, 1.7) * (.3 + activeCourse.terrainRoughness * .22);
  return courseHeight(s) + pisteCrown + mountain;
}
export function sectionAt(s: number): CourseSection {
  return SECTIONS.find(section => s >= section.start && s < section.end) ?? SECTIONS[SECTIONS.length - 1];
}

export function validateCourse(): string[] {
  const issues: string[] = [];
  if (COURSE_LENGTH < 2_000) issues.push("A pista é curta demais para a campanha.");
  for (const item of RAMPS) {
    if (Math.abs(item.x) + item.width / 2 > COURSE_HALF_WIDTH - 1) issues.push(`${item.id}: rampa fora da pista.`);
    if (item.s <= 30 || item.s >= COURSE_LENGTH - 80) issues.push(`${item.id}: rampa sem aproximação/recepção.`);
  }
  for (const item of OBSTACLES) {
    if (!item.decorative && Math.abs(item.x) + item.radius > COURSE_HALF_WIDTH) issues.push(`${item.id}: obstáculo fora da pista.`);
    if (item.decorative && Math.abs(item.x) < COURSE_HALF_WIDTH + 2) issues.push(`${item.id}: decoração invade a pista.`);
    if (item.radius > COURSE_HALF_WIDTH - 3) issues.push(`${item.id}: obstáculo bloqueia toda a rota.`);
  }
  for (let s = 0; s < COURSE_LENGTH; s += 10) if (Math.abs(courseSlope(s)) > .25) issues.push(`Inclinação excessiva em ${s} m.`);
  return issues;
}
export function validateAllCourses(): Record<string, string[]> {
  const previous = activeCourse.id, result: Record<string, string[]> = {};
  for (const course of COURSES) { setActiveCourse(course.id); result[course.id] = validateCourse(); }
  setActiveCourse(previous);
  return result;
}
