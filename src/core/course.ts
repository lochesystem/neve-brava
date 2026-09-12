import { clamp } from "./math.ts";

export type ObstacleKind = "tree" | "rock" | "fence" | "ice" | "log" | "snowball";
export type ItemKind = "wind" | "turbo" | "shield" | "blizzard";
export type Obstacle = { id: string; kind: ObstacleKind; s: number; x: number; radius: number; height: number; accent?: boolean; decorative?: boolean };
export type Ramp = { id: string; s: number; x: number; width: number; launch: number; built: boolean; natural?: boolean; length?: number; height?: number };
export type Tunnel = { start: number; end: number; halfWidth: number; height: number };
export type Fork = { start: number; end: number; left: number; right: number; detour?: number; bridge?: boolean };
export type CoinPickup = { id: string; s: number; x: number; value: 100 };
export type ItemBox = { id: string; s: number; x: number; item: ItemKind; radius: number; height: number };
export type CourseSection = { start: number; end: number; name: string; color: string };
type Wave = { amplitude: number; frequency: number; phase: number };

export const RACE_LAPS = 3;
export const LIFT_TRANSITION_TIME = 2.8;

export type CourseDefinition = {
  id: string; order: number; name: string; subtitle: string; description: string; difficulty: string;
  length: number; halfWidth: number; startHeight: number; descent: number; terrainRoughness: number; scenerySeed: number;
  curveWaves: Wave[]; heightWaves: Wave[]; sections: CourseSection[]; ramps: Ramp[]; obstacles: Obstacle[];
  tunnels?: Tunnel[]; forks?: Fork[];
  biome?: "desert";
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
    id: "pico-tempestade", order: 4, name: "Pico Tempestade", subtitle: "A coroa da montanha", difficulty: "EXTREMA",
    description: "A grande final: cristas expostas, galeria de gelo, quatro saltos naturais e a travessia dos arcos da coroa.",
    length: 3_600, halfWidth: 18.5, startHeight: 128, descent: .108, terrainRoughness: 1.35, scenerySeed: 0x53544f52,
    curveWaves: [{ amplitude: 72, frequency: .0058, phase: .5 }, { amplitude: 27, frequency: .0145, phase: 2.2 }, { amplitude: 16, frequency: .024, phase: 1.4 }, { amplitude: 38, frequency: .0028, phase: .9 }],
    heightWaves: [{ amplitude: 4.1, frequency: .017, phase: .6 }, { amplitude: 1.1, frequency: .049, phase: 1.6 }],
    sections: [
      { start: 0, end: 620, name: "Crista da tempestade", color: "#a9e8ff" }, { start: 620, end: 1_180, name: "Galeria violeta", color: "#c4a1ef" },
      { start: 1_180, end: 2_050, name: "Olho da nevasca", color: "#d89dff" }, { start: 2_050, end: 2_850, name: "Escadaria de neve", color: "#ffcf5a" },
      { start: 2_850, end: 3_600, name: "Coroa da montanha", color: "#ffdc82" },
    ],
    tunnels: [{start:800,end:1120,halfWidth:16.5,height:14}],
    ramps: [
      {...jump("storm-a",540,0,30,12),natural:true,length:44,height:4},
      {...jump("storm-b",1270,0,30,14),natural:true,length:48,height:6},
      {...jump("storm-c",2140,0,30,15),natural:true,length:54,height:7},
      {...jump("storm-final",3280,0,32,17),natural:true,length:62,height:8},
    ],
    obstacles: [
      hazard("ice-a", "ice", 145, 4, 1.8, 4.2), hazard("fence-a", "fence", 255, -7, 3, 1.5), hazard("snow-a", "snowball", 370, 0, 2.3, 3.1),
      hazard("log-a", "log", 470, 8, 3.5, 1.45), hazard("ice-b", "ice", 700, -6, 2, 4.6, true), hazard("ice-c", "ice", 780, 7, 1.7, 4),
      hazard("fence-b", "fence", 900, 1, 3.4, 1.6), hazard("rock-a", "rock", 1_020, -8, 2.2, 3.5), hazard("log-b", "log", 1_140, 6, 3.5, 1.5),
      hazard("snow-b", "snowball", 1_350, -2, 2.5, 3.4), hazard("ice-d", "ice", 1_490, 8, 2, 4.7), hazard("fence-c", "fence", 1_630, -7, 3.2, 1.55),
      hazard("ice-e", "ice", 1_790, 1, 2.2, 5, true), hazard("log-c", "log", 1_940, -8, 3.6, 1.5), hazard("snow-c", "snowball", 2_240, 7, 2.4, 3.2),
      hazard("rock-b", "rock", 2_300, -1, 2.3, 3.6), hazard("ice-f", "ice", 2_450, -8, 1.9, 4.4), hazard("fence-d", "fence", 2_590, 7, 3.3, 1.55),
      hazard("log-d", "log", 2_740, 0, 3.7, 1.55, true), hazard("snow-d", "snowball", 2_920, -7, 2.5, 3.4), hazard("ice-g", "ice", 3_040, 7, 2, 4.6),
      hazard("fence-e", "fence", 3_170, -7, 3.2, 1.55), hazard("rock-c", "rock", 3_420, 5, 2.3, 3.6), hazard("ice-h", "ice", 3_500, -6, 1.8, 4.2),
    ],
  },
];

COURSES.splice(3, 0, {
  id: "passagem-geleira", order: 4, name: "Passagem da Geleira", subtitle: "Por dentro da montanha", difficulty: "AVANÇADA",
  description: "Túnel de gelo, bifurcação com atalho estreito à esquerda e saltos na própria neve.",
  length: 3300, halfWidth: 20, startHeight: 130, descent: .115, terrainRoughness: .6, scenerySeed: 0x47454c4f,
  curveWaves: [{ amplitude: 36, frequency: .004, phase: 0 }, { amplitude: 12, frequency: .009, phase: .5 }],
  heightWaves: [{ amplitude: 2, frequency: .014, phase: 0 }],
  sections: [
    { start: 0, end: 450, name: "Entrada da geleira", color: "#9fe7ff" },
    { start: 450, end: 800, name: "Túnel azul", color: "#77b6dd" },
    { start: 800, end: 1300, name: "Escolha sua linha", color: "#ffcf5a" },
    { start: 1300, end: 2200, name: "Cornijas de neve", color: "#d89dff" },
    { start: 2200, end: 3300, name: "Salto da geleira", color: "#57c8ad" },
  ],
  tunnels: [{ start: 470, end: 730, halfWidth: 17, height: 11 }],
  forks: [{ start: 910, end: 1230, left: -6, right: -4, detour: 130 }],
  ramps: [
    { ...jump("lip-a", 350, 0, 32, 11), natural: true, length: 38, height: 4 },
    { ...jump("lip-b", 1510, 0, 32, 14), natural: true, length: 48, height: 6 },
    { ...jump("lip-c", 2100, 0, 32, 13), natural: true, length: 42, height: 5 },
    { ...jump("lip-final", 2870, 0, 32, 16), natural: true, length: 55, height: 7 },
  ],
  obstacles: [hazard("entry-ice", "ice", 175, 8, 2, 4),
    hazard("shortcut-log", "log", 1090, -14, 2.6, 1.2),
    hazard("main-a", "ice", 980, 5, 3.5, 4), hazard("main-b", "ice", 1060, 15, 3.5, 4), hazard("main-c", "ice", 1150, 5, 3.5, 4),
    hazard("exit-rock", "rock", 1690, -10, 2, 3), hazard("exit-ice", "ice", 2450, 7, 2, 4), hazard("last-rock", "rock", 3100, -7, 2, 3)],
});
COURSES.splice(4,0,{
  id:"canion-ferrugem",order:5,name:"Cânion Ferrugem",subtitle:"Por cima ou por baixo",difficulty:"AVANÇADA",biome:"desert",
  description:"Arenito vermelho, ponte suspensa sobre o leito seco e um atalho por baixo da travessia.",
  length:3500,halfWidth:20,startHeight:155,descent:.112,terrainRoughness:.4,scenerySeed:0x53414e44,
  curveWaves:[{amplitude:45,frequency:.0035,phase:0},{amplitude:13,frequency:.009,phase:.6}],
  heightWaves:[{amplitude:1.4,frequency:.012,phase:0}],
  sections:[
    {start:0,end:550,name:"Portas de arenito",color:"#e6a85d"},
    {start:550,end:1100,name:"Curvas da garganta",color:"#df8054"},
    {start:1100,end:1800,name:"Travessia suspensa",color:"#ffcc67"},
    {start:1800,end:2600,name:"Leito do vento",color:"#c79d76"},
    {start:2600,end:3500,name:"Salto do poente",color:"#ffad6b"}],
  forks:[{start:1120,end:1740,left:-6,right:-4,detour:155,bridge:true}],
  ramps:[
    {...jump("dune-a",430,0,30,10),natural:true,length:35,height:4},
    {...jump("ledge-b",950,-4,24,12),natural:true,length:40,height:5},
    {...jump("wash-c",2270,0,30,13),natural:true,length:45,height:6},
    {...jump("sunset",3180,0,32,15),natural:true,length:50,height:7}],
  obstacles:[hazard("rock-a","rock",190,-7,2.3,3),hazard("rock-b","rock",285,8,2.7,3.4),
    hazard("gorge-a","rock",630,6,2.8,3),hazard("gorge-b","rock",750,-6,2.7,3),
    hazard("gorge-c","rock",835,9,2.3,3),hazard("shortcut-a","rock",1280,-14,2.1,2.4),
    hazard("shortcut-b","rock",1620,-11,1.7,2.5),hazard("wash-a","rock",1940,5,3,3.5),
    hazard("wash-b","rock",2070,-8,2.5,3),hazard("wash-c","rock",2460,9,2.5,3),
    hazard("mesa-a","rock",2710,-7,2.8,4),hazard("mesa-b","rock",2920,7,2.8,3.5),hazard("last","rock",3370,-9,2,3)]
});
COURSES.forEach((course, index) => { course.order = index + 1; });

let activeCourse = COURSES[0];
export let COURSE_LENGTH = activeCourse.length;
export let COURSE_HALF_WIDTH = activeCourse.halfWidth;
export let SECTIONS = activeCourse.sections;
export let RAMPS: Ramp[] = [];
export let OBSTACLES: Obstacle[] = [];
export let COINS: CoinPickup[] = [];
export let ITEM_BOXES: ItemBox[] = [];

export function raceProgress(lap: number, s: number): number {
  return (Math.max(1, lap) - 1) * COURSE_LENGTH + clamp(s, 0, COURSE_LENGTH);
}

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
      // There is no terrain beside the upper deck to support edge props.
      if (course.forks?.some(f => f.bridge && s >= f.start - 20 && s <= f.end + 20)) continue;
      const kind: ObstacleKind = course.biome === "desert" ? "rock" : random() > .12 ? "tree" : "rock";
      result.push({ id: `${course.id}-edge-${result.length}`, kind, s: s + (random() - .5) * 15, x,
        radius: kind === "tree" ? 1.1 : 1.45, height: kind === "tree" ? 5 + random() * 4.5 : 2.2 + random(), decorative: true });
    }
  }
  return result;
}

function safePickupX(course: CourseDefinition, s: number, preferred: number, radius: number): number {
  const edge = course.halfWidth - radius - 1.4;
  const candidates = [preferred, 0, -preferred, edge * .55, -edge * .55].map(value => clamp(value, -edge, edge));
  return candidates.find(candidate => !course.forks?.some(fork => s >= fork.start - 20 && s <= fork.end + 20 && candidate > fork.left - radius - 1 && candidate < fork.right + radius + 1) && course.obstacles.every(obstacle =>
    Math.abs(obstacle.s - s) > 16 || Math.abs(obstacle.x - candidate) > obstacle.radius + radius + 1.4,
  ) && course.ramps.every(ramp =>
    Math.abs(ramp.s - s) > 24 || Math.abs(ramp.x - candidate) > ramp.width / 2 + radius + 1,
  )) ?? clamp(preferred, -edge, edge);
}

function generatePickups(course: CourseDefinition): { coins: CoinPickup[]; boxes: ItemBox[] } {
  const random = mulberry32(course.scenerySeed ^ 0x4954454d);
  const coins: CoinPickup[] = [];
  const clusterCount = 8;
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const centerS = 105 + cluster * (course.length - 240) / clusterCount;
    const preferred = (random() * 2 - 1) * (course.halfWidth - 4);
    const centerX = safePickupX(course, centerS, preferred, .65);
    const direction = random() > .5 ? 1 : -1;
    for (let index = 0; index < 3; index += 1) {
      const s = centerS + (index - 1) * 5.2;
      coins.push({
        id: `${course.id}-coin-${cluster}-${index}`,
        s,
        x: clamp(centerX + direction * Math.sin(index / 2 * Math.PI) * 1.25, -course.halfWidth + 1.2, course.halfWidth - 1.2),
        value: 100,
      });
    }
  }

  const itemOrder: ItemKind[] = ["wind", "turbo", "shield"];
  const boxes: ItemBox[] = [];
  const boxCount = 9;
  for (let index = 0; index < boxCount; index += 1) {
    const s = 360 + index * (course.length - 620) / (boxCount - 1);
    // Mantém as caixas próximas das linhas mais usadas para serem vistas e
    // disputadas, sem transformá-las em bloqueios obrigatórios.
    const preferred = (random() * 2 - 1) * course.halfWidth * .55;
    boxes.push({
      id: `${course.id}-box-${index}`,
      s,
      x: safePickupX(course, s, preferred, 1.15),
      item: itemOrder[(index + course.order - 1) % itemOrder.length],
      radius: 1.05,
      height: 2.1,
    });
  }
  return { coins, boxes };
}

function activate(course: CourseDefinition): void {
  activeCourse = course;
  COURSE_LENGTH = course.length;
  COURSE_HALF_WIDTH = course.halfWidth;
  SECTIONS = course.sections;
  RAMPS = course.ramps.map(item => ({ ...item, id: `${course.id}-${item.id}` }));
  OBSTACLES = [...course.obstacles.map(item => ({ ...item, id: `${course.id}-${item.id}` })), ...decorateSafeEdges(course)];
  const pickups = generatePickups(course);
  COINS = pickups.coins;
  ITEM_BOXES = pickups.boxes;
}

export function setActiveCourse(id: string): CourseDefinition {
  const course = COURSES.find(candidate => candidate.id === id) ?? COURSES[0];
  activate(course);
  return course;
}
export function getActiveCourse(): CourseDefinition { return activeCourse; }
activate(activeCourse);

export function rampLength(item: Ramp): number { return item.length ?? (item.built ? 9.5 : 8.5); }
export function rampHeight(item: Ramp): number { return item.height ?? (item.built ? 2.35 : 1.8); }
export function obstacleConflictsWithRamp(obstacle: Obstacle, ramp: Ramp): boolean {
  const approachStart = ramp.s - rampLength(ramp) - 12;
  const landingEnd = ramp.s + 24;
  const insideJumpSection = obstacle.s + obstacle.radius >= approachStart && obstacle.s - obstacle.radius <= landingEnd;
  const insideRampLane = Math.abs(obstacle.x - ramp.x) <= ramp.width / 2 + obstacle.radius + 1;
  return insideJumpSection && insideRampLane;
}
export function rampSurfaceElevation(s: number, lateral: number): number {
  for (const item of RAMPS) {
    if (Math.abs(lateral - item.x) > item.width / 2 + .7) continue;
    const length = rampLength(item), start = item.s - length;
    if (s >= start && s <= item.s) return clamp((s - start) / length, 0, 1) * rampHeight(item);
  }
  return 0;
}

export function courseHeightFor(course: CourseDefinition, s: number, lateral = 0): number {
  const progress = clamp(s, 0, course.length);
  return course.startHeight - progress * course.descent
    + course.heightWaves.reduce((sum, wave) => sum + Math.sin(progress * wave.frequency + wave.phase) * wave.amplitude, 0)
    + routeHeightFor(course,s,lateral);
}
export function courseHeight(s: number, lateral = 0): number { return courseHeightFor(activeCourse, s, lateral); }
export function isBridgeSurface(s:number,x:number):boolean {
  return !!activeCourse.forks?.some(f=>f.bridge&&s>=f.start&&s<=f.end&&x>=f.right);
}
/** Pickups on curved, layered routes use the visible world-space contact, not a single s-plane. */
export function touchesItemBox(state:{s:number;x:number;y:number},previousS:number,box:ItemBox):boolean {
  const fork=activeCourse.forks?.find(f=>box.s>=f.start&&box.s<=f.end);
  if(!fork)return previousS<box.s&&state.s+.9>=box.s&&Math.abs(state.x-box.x)<=box.radius+.72&&state.y-courseHeight(state.s,state.x)<=box.height+.35;
  if(box.s<previousS-6||box.s>state.s+6)return false;
  const middle=(fork.left+fork.right)/2;
  if((state.x<middle)!==(box.x<middle))return false;
  const a=courseWorldPoint(previousS,state.x),b=courseWorldPoint(state.s,state.x),p=courseWorldPoint(box.s,box.x);
  const dx=b.x-a.x,dz=b.z-a.z;
  const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/Math.max(.000001,dx*dx+dz*dz),0,1);
  const height=state.y-courseTerrainHeight(box.s,box.x);
  return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<=box.radius+.9&&height>=-1&&height<=box.height+.35;
}
export function courseSlope(s: number, lateral = 0): number {
  const epsilon = .5;
  return (courseHeight(s + epsilon,lateral) - courseHeight(s - epsilon,lateral)) / (epsilon * 2);
}
export function routeHeightFor(course: CourseDefinition,s:number,lateral=0):number {
  const fork=course.forks?.find(f=>f.bridge && s>=f.start && s<=f.end);
  if(!fork)return 0;
  const side=clamp((lateral-fork.left)/(fork.right-fork.left),0,1);
  const t=(s-fork.start)/(fork.end-fork.start);
  const approach=clamp(Math.min(t,1-t)/.18,0,1);
  const elevation=approach*approach*(3-2*approach);
  return (-15+side*23)*elevation;
}
function baseCenterFor(course: CourseDefinition, s: number): number {
  const progress = clamp(s, 0, course.length);
  return course.curveWaves.reduce((sum, wave) => sum + Math.sin(progress * wave.frequency + wave.phase) * wave.amplitude, 0);
}
export function routeOffsetFor(course: CourseDefinition, s: number, lateral = 0): number {
  const fork = course.forks?.find(f => s >= f.start && s <= f.end);
  if (!fork) return 0;
  const progress = (s-fork.start)/(fork.end-fork.start);
  const side = clamp((lateral-fork.left)/(fork.right-fork.left),0,1);
  const exit=clamp(Math.min(progress,1-progress)/.22,0,1);
  const branch=exit*exit*(3-2*exit);
  // The optional route visibly peels left, while x=0 remains on the broad main route.
  return (fork.detour ?? 0)*Math.sin(Math.PI*progress)**2*side*(fork.bridge ? Math.sin(2*Math.PI*progress) : 1)
    - 35*branch*(1-side);
}
export function courseCenterFor(course: CourseDefinition, s: number): number {
  return baseCenterFor(course,s)+routeOffsetFor(course,s);
}
export function courseCenterX(s: number): number { return courseCenterFor(activeCourse, s); }
export function courseFrame(s: number, lateral = 0): { tx: number; tz: number; nx: number; nz: number; heading: number } {
  const a=courseWorldPoint(s-.5,lateral), b=courseWorldPoint(s+.5,lateral), dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  const tx = dx / length, tz = dz / length, nx = -tz, nz = tx;
  return { tx, tz, nx, nz, heading: Math.atan2(-tx, -tz) };
}
export function courseWorldPoint(s: number, lateral = 0): { x: number; z: number } {
  return courseWorldPointFor(activeCourse,s,lateral);
}
export function courseWorldPointFor(course: CourseDefinition,s: number,lateral=0): {x:number;z:number} {
  const dx=baseCenterFor(course,s+.5)-baseCenterFor(course,s-.5), length=Math.hypot(dx,1);
  return {x:baseCenterFor(course,s)+routeOffsetFor(course,s,lateral)+lateral/length,z:-s+dx/length*lateral};
}
export function courseTerrainHeight(s: number, lateral: number): number {
  const edge = Math.max(0, Math.abs(lateral) - COURSE_HALF_WIDTH);
  const mountain = edge * .16 + Math.sin(s * .021 + lateral * .12) * Math.min(2.8, edge * .045);
  const pisteCrown = -Math.pow(Math.abs(lateral) / COURSE_HALF_WIDTH, 1.7) * (.3 + activeCourse.terrainRoughness * .22);
  const naturalRamp = RAMPS.some(ramp => ramp.natural && s >= ramp.s - rampLength(ramp) && s <= ramp.s && Math.abs(lateral - ramp.x) <= ramp.width / 2 + .7);
  return courseHeight(s,lateral) + (naturalRamp ? rampSurfaceElevation(s, lateral) : activeCourse.biome === "desert" && edge===0 ? 0 : pisteCrown + mountain);
}

/** Shared by client and server bots: physical walls cannot be crossed sideways. */
export function isForkSection(s:number):boolean {
  return !!activeCourse.forks?.some(f=>s>=f.start&&s<=f.end);
}
export function courseWallX(s: number, x: number, previousX = x): number {
  let result = x;
  for (const tunnel of activeCourse.tunnels ?? []) if (s >= tunnel.start && s <= tunnel.end)
    result = clamp(result, -tunnel.halfWidth + .8, tunnel.halfWidth - .8);
  for (const fork of activeCourse.forks ?? []) if (s >= fork.start && s <= fork.end) {
    const middle = (fork.left + fork.right) / 2;
    result = previousX < middle ? Math.min(result, fork.left - .8) : Math.max(result, fork.right + .8);
  }
  return result;
}
export function courseCeiling(s: number, lateral = 0): number {
  const tunnel = activeCourse.tunnels?.find(item => s >= item.start && s <= item.end);
  const bridge=activeCourse.forks?.find(f=>f.bridge&&s>=f.start&&s<=f.end&&lateral<f.left);
  if(bridge){
    const p=courseWorldPoint(s,lateral),a=courseWorldPoint(s,bridge.right),b=courseWorldPoint(s,COURSE_HALF_WIDTH);
    if(p.x>=Math.min(a.x,b.x)-1&&p.x<=Math.max(a.x,b.x)+1)return courseHeight(s,bridge.right)-.4;
  }
  return tunnel ? courseHeight(s) + 3 + (tunnel.height-3)*Math.sqrt(Math.max(0,1-(lateral/tunnel.halfWidth)**2)) : Infinity;
}
/** New terrain uses physical distance; old tracks retain their established pace. */
export function courseAdvanceScale(s: number, lateralSpeed: number, speed: number, lateral = 0): number {
  if (!activeCourse.forks) return 1;
  const a=courseWorldPoint(s-.5,lateral),b=courseWorldPoint(s+.5,lateral);
  return 1 / Math.sqrt((b.x-a.x)**2+(b.z-a.z)**2+Math.pow(lateralSpeed/Math.max(1,speed),2));
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
    if (!item.decorative && RAMPS.some(ramp => obstacleConflictsWithRamp(item, ramp))) issues.push(`${item.id}: obstáculo invade a área segura de uma rampa.`);
  }
  for (const box of ITEM_BOXES) {
    if (Math.abs(box.x) + box.radius > COURSE_HALF_WIDTH - .2) issues.push(`${box.id}: caixa fora da pista.`);
    if (OBSTACLES.some(obstacle => !obstacle.decorative && Math.abs(obstacle.s - box.s) < 12 && Math.abs(obstacle.x - box.x) < obstacle.radius + box.radius + .8)) issues.push(`${box.id}: caixa sobreposta a obstáculo.`);
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
