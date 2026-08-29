import {
  COURSE_HALF_WIDTH,
  COURSE_LENGTH,
  OBSTACLES,
  RAMPS,
  courseHeight,
  courseSlope,
  rampHeight,
  rampSurfaceElevation,
  sectionAt,
} from "./course.ts";
import { approach, clamp, crossing, lerp, wrapAngle } from "./math.ts";
import { addCombo, evaluateTrick, gradeLanding, nearMissPoints, type LandingGrade } from "./scoring.ts";

export type GameIntent = {
  steer: number;
  look: number;
  tuck: number;
  brake: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  jumpReleased: boolean;
  grabHeld: boolean;
  spinLeft: boolean;
  spinRight: boolean;
  flipHeld: boolean;
  recoverHeld: boolean;
};

export const EMPTY_INTENT: GameIntent = {
  steer: 0,
  look: 0,
  tuck: 0,
  brake: 0,
  jumpHeld: false,
  jumpPressed: false,
  jumpReleased: false,
  grabHeld: false,
  spinLeft: false,
  spinRight: false,
  flipHeld: false,
  recoverHeld: false,
};

export type GameEvent =
  | { type: "TAKEOFF"; ramp: boolean }
  | { type: "LAND"; grade: LandingGrade; label: string; points: number }
  | { type: "NEAR_MISS"; points: number }
  | { type: "CRASH"; obstacle?: string }
  | { type: "SECTION"; name: string; color: string }
  | { type: "FINISH" };

export type RiderState = {
  s: number;
  x: number;
  y: number;
  speed: number;
  lateralSpeed: number;
  grounded: boolean;
  verticalSpeed: number;
  carve: number;
  heading: number;
  spin: number;
  flip: number;
  grabTime: number;
  airTime: number;
  jumpCharge: number;
  landingAssist: number;
  recovering: number;
  tumbleTime: number;
  tumbleDirection: number;
  invulnerable: number;
  score: number;
  combo: number;
  bestCombo: number;
  bestTrick: string;
  bestTrickPoints: number;
  elapsed: number;
  crashes: number;
  nearMisses: number;
  finished: boolean;
  lastSafeS: number;
  lastSafeX: number;
  section: string;
};

const touchedObstacles = new Set<string>();
const usedRamps = new Set<string>();
export const CRASH_RECOVERY_TIME = 1.15;

export function createRider(): RiderState {
  touchedObstacles.clear();
  usedRamps.clear();
  return {
    s: 0,
    x: 0,
    y: courseHeight(0) + 0.46,
    speed: 18,
    lateralSpeed: 0,
    grounded: true,
    verticalSpeed: 0,
    carve: 0,
    heading: 0,
    spin: 0,
    flip: 0,
    grabTime: 0,
    airTime: 0,
    jumpCharge: 0,
    landingAssist: 0,
    recovering: 0,
    tumbleTime: 0,
    tumbleDirection: 1,
    invulnerable: 0,
    score: 0,
    combo: 1,
    bestCombo: 1,
    bestTrick: "—",
    bestTrickPoints: 0,
    elapsed: 0,
    crashes: 0,
    nearMisses: 0,
    finished: false,
    lastSafeS: 0,
    lastSafeX: 0,
    section: sectionAt(0).name,
  };
}

export function interpolateRider(previous: RiderState, current: RiderState, alpha: number): RiderState {
  const amount = clamp(alpha, 0, 1);
  const angle = (from: number, to: number) => from + wrapAngle(to - from) * amount;
  return {
    ...current,
    s: lerp(previous.s, current.s, amount),
    x: lerp(previous.x, current.x, amount),
    y: lerp(previous.y, current.y, amount),
    speed: lerp(previous.speed, current.speed, amount),
    lateralSpeed: lerp(previous.lateralSpeed, current.lateralSpeed, amount),
    carve: lerp(previous.carve, current.carve, amount),
    heading: angle(previous.heading, current.heading),
    spin: angle(previous.spin, current.spin),
    flip: angle(previous.flip, current.flip),
    grabTime: lerp(previous.grabTime, current.grabTime, amount),
    airTime: lerp(previous.airTime, current.airTime, amount),
    tumbleTime: lerp(previous.tumbleTime, current.tumbleTime, amount),
  };
}

function beginAir(state: RiderState, launch: number, ramp: boolean, events: GameEvent[]): void {
  state.grounded = false;
  state.verticalSpeed = launch;
  state.spin = 0;
  state.flip = 0;
  state.grabTime = 0;
  state.airTime = 0;
  state.landingAssist = 0;
  state.jumpCharge = 0;
  events.push({ type: "TAKEOFF", ramp });
}

function crash(state: RiderState, events: GameEvent[], obstacle?: string): void {
  if (state.recovering > 0 || state.invulnerable > 0 || state.finished) return;
  const tumbleMomentum = state.lateralSpeed + state.carve * 3 + Math.sin(state.spin) * 2;
  state.tumbleDirection = Math.sign(tumbleMomentum) || (state.x >= 0 ? 1 : -1);
  state.tumbleTime = 0;
  state.recovering = CRASH_RECOVERY_TIME;
  state.crashes += 1;
  state.combo = 1;
  state.speed = Math.max(20, state.speed * 0.62);
  state.lateralSpeed = 0;
  state.verticalSpeed = 0;
  state.grounded = false;
  events.push({ type: "CRASH", obstacle });
}

function land(state: RiderState, events: GameEvent[]): void {
  const surfaceVerticalSpeed = courseSlope(state.s) * state.speed;
  const impact = Math.max(0, surfaceVerticalSpeed - state.verticalSpeed);
  const grade = gradeLanding(state.spin, state.flip, impact, state.landingAssist > 0.4);
  const trick = evaluateTrick(state.spin, state.flip, state.grabTime, grade);
  state.grounded = true;
  state.y = courseHeight(state.s) + 0.46;
  state.verticalSpeed = 0;
  state.heading = wrapAngle(state.spin);
  state.spin = state.heading;
  state.flip = wrapAngle(state.flip);
  if (grade === "crash") {
    crash(state, events);
    events.push({ type: "LAND", grade, label: "Pouso perdido", points: 0 });
    return;
  }
  const comboResult = addCombo(state.score, state.combo, trick.basePoints);
  state.score = comboResult.score;
  state.combo = comboResult.combo;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  if (comboResult.awarded > state.bestTrickPoints) {
    state.bestTrickPoints = comboResult.awarded;
    state.bestTrick = trick.name;
  }
  if (grade === "sketchy") state.speed *= 0.82;
  else state.speed = Math.min(45, state.speed + 2.4);
  events.push({ type: "LAND", grade, label: trick.name, points: comboResult.awarded });
}

function updateObstacles(state: RiderState, previousS: number, events: GameEvent[]): void {
  for (const obstacle of OBSTACLES) {
    if (obstacle.decorative) continue;
    if (obstacle.s < previousS - 2 || obstacle.s > state.s + 2 || touchedObstacles.has(obstacle.id)) continue;
    if (!crossing(previousS, state.s + 0.8, obstacle.s)) continue;
    touchedObstacles.add(obstacle.id);
    const lateralDistance = Math.abs(state.x - obstacle.x);
    const collisionDistance = obstacle.radius + 0.7;
    const lowEnough = state.y - courseHeight(state.s) < obstacle.height + 0.35;
    if (lateralDistance < collisionDistance && lowEnough) {
      crash(state, events, obstacle.kind);
    } else if (lateralDistance < collisionDistance + 2.15 && lowEnough) {
      const points = nearMissPoints(state.speed, state.combo);
      state.score += points;
      state.combo = Math.min(8, state.combo + 0.18);
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.nearMisses += 1;
      events.push({ type: "NEAR_MISS", points });
    }
  }
}

function updateRamps(state: RiderState, previousS: number, events: GameEvent[]): void {
  if (!state.grounded) return;
  for (const ramp of RAMPS) {
    if (usedRamps.has(ramp.id) || !crossing(previousS, state.s, ramp.s)) continue;
    usedRamps.add(ramp.id);
    if (Math.abs(state.x - ramp.x) <= ramp.width / 2 + 0.7) {
      state.y = courseHeight(ramp.s) + rampHeight(ramp) + 0.46;
      beginAir(state, ramp.launch + state.speed * 0.045, true, events);
    }
  }
}

function restoreAfterCrash(state: RiderState): void {
  state.s = Math.max(0, state.lastSafeS);
  state.x = state.lastSafeX;
  state.y = courseHeight(state.s) + 0.46;
  state.speed = Math.max(22, state.speed);
  state.lateralSpeed = 0;
  state.grounded = true;
  state.verticalSpeed = 0;
  state.spin = 0;
  state.flip = 0;
  state.heading = 0;
  state.tumbleTime = 0;
  state.tumbleDirection = 1;
  state.invulnerable = 1.2;
}

export function updateRider(state: RiderState, intent: GameIntent, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.finished) return events;
  const step = clamp(dt, 0, 1 / 20);
  state.elapsed += step;
  state.invulnerable = Math.max(0, state.invulnerable - step);

  if (state.recovering > 0) {
    state.recovering = Math.max(0, state.recovering - step);
    state.tumbleTime = Math.min(CRASH_RECOVERY_TIME, state.tumbleTime + step);
    const progress = clamp(state.tumbleTime / CRASH_RECOVERY_TIME, 0, 1);
    const momentum = 1 - progress;
    state.s += state.speed * (0.2 + momentum * 0.1) * step;
    state.x = clamp(
      state.x + state.tumbleDirection * 1.25 * momentum * step,
      -COURSE_HALF_WIDTH + 0.7,
      COURSE_HALF_WIDTH - 0.7,
    );
    state.speed = approach(state.speed, 14, 7 * step);
    const impactHop = progress < 0.18 ? Math.sin((progress / 0.18) * Math.PI) * 0.07 : 0;
    state.y = courseHeight(state.s) + 0.46 + impactHop;
    if (state.recovering <= 0) restoreAfterCrash(state);
    return events;
  }

  const previousS = state.s;
  state.carve = approach(state.carve, intent.steer, step * (state.grounded ? 5.8 : 2.2));

  if (state.grounded) {
    const edgeDrag = Math.max(0, Math.abs(state.x) - 13.5) * 0.72;
    const acceleration = 5.8 + intent.tuck * 8.5 - intent.brake * 15 - state.carve * state.carve * 2.2 - edgeDrag;
    state.speed = clamp(state.speed + acceleration * step, 12, 45);
    const targetLateral = state.carve * Math.min(18, state.speed * 0.38);
    state.lateralSpeed = approach(state.lateralSpeed, targetLateral, 28 * step);
    state.heading = approach(state.heading, -state.carve * 0.42, 3.8 * step);
    state.jumpCharge = intent.jumpHeld ? clamp(state.jumpCharge + step, 0, 0.72) : state.jumpCharge;
    if (intent.jumpReleased && state.jumpCharge > 0.08) beginAir(state, 5.8 + state.jumpCharge * 4.8, false, events);
  } else {
    state.speed = clamp(state.speed + 0.55 * step, 12, 47);
    state.lateralSpeed = approach(state.lateralSpeed, intent.steer * Math.min(16, state.speed * 0.3), 9 * step);
    const spinDirection = Number(intent.spinRight) - Number(intent.spinLeft);
    state.spin += spinDirection * 5.2 * step;
    if (intent.flipHeld) state.flip += 4.5 * step;
    if (intent.grabHeld) state.grabTime += step;
    if (intent.recoverHeld) {
      state.landingAssist = clamp(state.landingAssist + step * 2.2, 0, 1);
      state.spin = approach(state.spin, Math.round(state.spin / (Math.PI * 2)) * Math.PI * 2, 4.4 * step);
      state.flip = approach(state.flip, Math.round(state.flip / (Math.PI * 2)) * Math.PI * 2, 4.4 * step);
    }
    state.airTime += step;
    state.verticalSpeed -= 18.5 * step;
    state.y += state.verticalSpeed * step;
  }

  state.x += state.lateralSpeed * step;
  if (Math.abs(state.x) > COURSE_HALF_WIDTH - 0.7) {
    state.x = clamp(state.x, -COURSE_HALF_WIDTH + 0.7, COURSE_HALF_WIDTH - 0.7);
    state.lateralSpeed *= -0.18;
    state.speed *= 0.985;
  }
  state.s += state.speed * step;

  if (state.grounded) state.y = courseHeight(state.s) + rampSurfaceElevation(state.s, state.x) + 0.46;
  updateRamps(state, previousS, events);
  if (!state.grounded && state.y <= courseHeight(state.s) + 0.46 && state.verticalSpeed < 0) land(state, events);
  if (state.grounded) state.y = courseHeight(state.s) + rampSurfaceElevation(state.s, state.x) + 0.46;
  updateObstacles(state, previousS, events);

  if (state.grounded && state.invulnerable <= 0 && state.s - state.lastSafeS > 18) {
    state.lastSafeS = state.s;
    state.lastSafeX = state.x;
  }

  const section = sectionAt(state.s);
  if (section.name !== state.section) {
    state.section = section.name;
    events.push({ type: "SECTION", name: section.name, color: section.color });
  }

  if (state.s >= COURSE_LENGTH) {
    state.s = COURSE_LENGTH;
    state.finished = true;
    events.push({ type: "FINISH" });
  }
  return events;
}
