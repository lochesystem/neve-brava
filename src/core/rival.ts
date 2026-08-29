import {
  COURSE_HALF_WIDTH,
  COURSE_LENGTH,
  ITEM_BOXES,
  OBSTACLES,
  RAMPS,
  courseHeight,
  getActiveCourse,
  rampHeight,
  rampLength,
} from "./course.ts";
import { clamp, lerp, wrapAngle } from "./math.ts";
import type { RiderState } from "./simulation.ts";
import type { CharacterId } from "./characters.ts";

export type RivalEvent =
  | { type: "RIVAL_CRASH" }
  | { type: "RIVAL_TAKEOFF" }
  | { type: "RIVAL_LAND" }
  | { type: "RIVAL_FINISH" };

export type RivalState = {
  id: CharacterId;
  name: string;
  linePhase: number;
  paceBias: number;
  aggression: number;
  rampAffinity: number;
  s: number;
  x: number;
  y: number;
  speed: number;
  lateralSpeed: number;
  targetX: number;
  decisionTimer: number;
  grounded: boolean;
  verticalSpeed: number;
  carve: number;
  heading: number;
  spin: number;
  airTime: number;
  stun: number;
  tumble: number;
  finished: boolean;
  finishTime: number;
  elapsed: number;
  crashes: number;
  lastRamp: string;
  contactCooldown: number;
  windHit: number;
};

export type RivalProfile = Pick<RivalState, "id" | "name" | "linePhase" | "paceBias" | "aggression" | "rampAffinity"> & {
  startX: number;
};

export const YETI_PROFILE: RivalProfile = {
  id: "yeti", name: "YETI", startX: 3.1, linePhase: 0, paceBias: 1.55, aggression: 1, rampAffinity: .8,
};

export const GUY_PROFILE: RivalProfile = {
  id: "guy", name: "GUY", startX: -3.15, linePhase: 2.35, paceBias: 1.15, aggression: .68, rampAffinity: 1.55,
};

export const SNOWMAN_PROFILE: RivalProfile = {
  id: "snowman", name: "NEVINHO", startX: 3.1, linePhase: 1.15, paceBias: 1.35, aggression: .82, rampAffinity: 1.12,
};

export const GIRU_PROFILE: RivalProfile = {
  id: "giru", name: "GIRU", startX: 7.4, linePhase: 3.7, paceBias: 1.48, aggression: .94, rampAffinity: 1.3,
};

export const RIVAL_PROFILES: Record<CharacterId, RivalProfile> = {
  snowman: SNOWMAN_PROFILE,
  yeti: YETI_PROFILE,
  guy: GUY_PROFILE,
  giru: GIRU_PROFILE,
};

export function createRival(profile: RivalProfile = YETI_PROFILE): RivalState {
  return {
    id: profile.id,
    name: profile.name,
    linePhase: profile.linePhase,
    paceBias: profile.paceBias,
    aggression: profile.aggression,
    rampAffinity: profile.rampAffinity,
    s: 0,
    x: profile.startX,
    y: courseHeight(0) + .52,
    speed: 18.5,
    lateralSpeed: 0,
    targetX: profile.startX,
    decisionTimer: 0,
    grounded: true,
    verticalSpeed: 0,
    carve: 0,
    heading: 0,
    spin: 0,
    airTime: 0,
    stun: 0,
    tumble: 0,
    finished: false,
    finishTime: 0,
    elapsed: 0,
    crashes: 0,
    lastRamp: "",
    contactCooldown: 0,
    windHit: 0,
  };
}

function lineRisk(state: RivalState, candidate: number, preferredLine: number): number {
  let risk = Math.abs(candidate - preferredLine) * .075 + Math.abs(candidate - state.x) * .012;
  for (const obstacle of OBSTACLES) {
    if (obstacle.decorative) continue;
    const ahead = obstacle.s - state.s;
    if (ahead < 5 || ahead > 82) continue;
    const clearance = Math.abs(candidate - obstacle.x) - obstacle.radius;
    if (clearance < 3.3) risk += (3.3 - clearance) * (2.25 - ahead / 105);
  }
  for (const box of ITEM_BOXES) {
    const ahead = box.s - state.s;
    if (ahead < 5 || ahead > 76) continue;
    const clearance = Math.abs(candidate - box.x) - box.radius;
    if (clearance < 3) risk += (3 - clearance) * (2.1 - ahead / 100);
  }
  // Cada perfil decide quanto vale abandonar a linha atual para buscar uma rampa.
  for (const ramp of RAMPS) {
    const ahead = ramp.s - state.s;
    if (ahead > 14 && ahead < 72 && Math.abs(candidate - ramp.x) < ramp.width * .45) risk -= .55 * state.rampAffinity;
  }
  return risk;
}

function chooseLine(state: RivalState, playerS: number, playerX: number): void {
  const edge = COURSE_HALF_WIDTH - 2.2;
  const candidates = [-.78, -.52, -.26, 0, .26, .52, .78].map(value => value * edge);
  const raceGap = playerS - state.s;
  const mountainLine = (
    Math.sin(state.s * .027 + getActiveCourse().order * 1.4 + state.linePhase) * .48
    + Math.sin(state.s * .011 + 2.3 + state.linePhase * .55) * .2
  ) * edge;
  let preferredLine = mountainLine;
  if (raceGap > -3 && raceGap < 20) {
    // Atrás ou emparelhado: abre para o lado livre e prepara a ultrapassagem.
    const passingWidth = .48 + state.aggression * .18;
    preferredLine = playerX >= 0 ? -edge * passingWidth : edge * passingWidth;
  } else if (raceGap <= -3 && raceGap > -18) {
    // Na frente: protege a linha sem perseguir o jogador como um ímã.
    const defendSide = Math.sign(playerX - state.x) || Math.sign(mountainLine) || 1;
    preferredLine = clamp(playerX - defendSide * (1.3 + state.aggression * 1.3), -edge * .68, edge * .68);
  }
  state.targetX = candidates.reduce((best, candidate) =>
    lineRisk(state, candidate, preferredLine) < lineRisk(state, best, preferredLine) ? candidate : best,
  candidates[0]);
  state.decisionTimer = .58 + (1 - state.aggression) * .22 + (Math.sin(state.s * .11 + state.linePhase) + 1) * .18;
}

function obstacleCollision(state: RivalState): boolean {
  if (!state.grounded || state.stun > 0) return false;
  return OBSTACLES.some(obstacle => !obstacle.decorative
    && Math.abs(obstacle.s - state.s) < 1.15
    && Math.abs(obstacle.x - state.x) < obstacle.radius + .72)
    || ITEM_BOXES.some(box => Math.abs(box.s - state.s) < 1.15 && Math.abs(box.x - state.x) < box.radius + .72);
}

export function applyWindHit(state: RivalState): boolean {
  if (state.finished || state.stun > 0) return false;
  const direction = Math.sign(state.x) || (Math.sin(state.s + state.linePhase) > 0 ? 1 : -1);
  state.windHit = 1.05;
  state.stun = 1.05;
  state.tumble = .01;
  state.crashes += 1;
  state.grounded = false;
  state.verticalSpeed = 3.4;
  state.speed = Math.max(16, state.speed * .68);
  state.lateralSpeed += direction * 10.5;
  state.targetX = clamp(state.x + direction * 6.5, -COURSE_HALF_WIDTH + 1.4, COURSE_HALF_WIDTH - 1.4);
  state.decisionTimer = 1.1;
  state.contactCooldown = 1.2;
  return true;
}

export function updateRival(state: RivalState, playerS: number, playerX: number, dt: number): RivalEvent[] {
  const events: RivalEvent[] = [];
  if (state.finished) return events;
  const step = clamp(dt, 0, 1 / 20);
  state.elapsed += step;
  state.contactCooldown = Math.max(0, state.contactCooldown - step);
  state.windHit = Math.max(0, state.windHit - step);

  if (state.stun > 0) {
    state.stun = Math.max(0, state.stun - step);
    state.tumble += step;
    state.speed = Math.max(12, state.speed - 16 * step);
    state.s += state.speed * .28 * step;
    state.y = Math.max(courseHeight(state.s) + .52, state.y - 7 * step);
    if (state.stun === 0) {
      state.grounded = true;
      state.y = courseHeight(state.s) + .52;
      state.tumble = 0;
      state.targetX = clamp(state.x, -COURSE_HALF_WIDTH + 2, COURSE_HALF_WIDTH - 2);
    }
    return events;
  }

  state.decisionTimer -= step;
  if (state.decisionTimer <= 0) chooseLine(state, playerS, playerX);

  const coursePace = 43 + getActiveCourse().order * .3 + state.paceBias;
  const gap = playerS - state.s;
  // Recupera terreno com firmeza, mas desacelera quando abre vantagem para a
  // disputa continuar legível e não virar uma perseguição impossível.
  const catchUp = clamp(gap * .22, -3.5, 4.5);
  const rhythm = Math.sin(state.s * .018 + getActiveCourse().order) * 1.15;
  const targetSpeed = clamp(coursePace + catchUp + rhythm, 35, 47.5);
  state.speed += clamp(targetSpeed - state.speed, -5.5 * step, 7.6 * step);

  const desiredLateral = clamp((state.targetX - state.x) * 1.15, -10.5, 10.5);
  state.lateralSpeed += clamp(desiredLateral - state.lateralSpeed, -18 * step, 18 * step);
  state.x = clamp(state.x + state.lateralSpeed * step, -COURSE_HALF_WIDTH + 1.1, COURSE_HALF_WIDTH - 1.1);
  state.carve += (clamp(state.lateralSpeed / 9, -1, 1) - state.carve) * Math.min(1, step * 7);
  state.heading += (state.carve * .13 - state.heading) * Math.min(1, step * 8);

  const previousS = state.s;
  state.s = Math.min(COURSE_LENGTH, state.s + state.speed * step);

  if (state.grounded) {
    const ramp = RAMPS.find(item => item.id !== state.lastRamp
      && previousS < item.s && state.s >= item.s
      && Math.abs(state.x - item.x) < item.width / 2 + .5);
    if (ramp) {
      state.lastRamp = ramp.id;
      state.grounded = false;
      state.y = courseHeight(ramp.s) + rampHeight(ramp) + .52;
      state.verticalSpeed = ramp.launch + state.speed * .04;
      state.spin = Math.sin(ramp.s) > 0 ? Math.PI * 2 : -Math.PI * 2;
      state.airTime = 0;
      events.push({ type: "RIVAL_TAKEOFF" });
    } else {
      const climbingRamp = RAMPS.find(item => {
        const start = item.s - rampLength(item);
        return state.s >= start && state.s <= item.s && Math.abs(state.x - item.x) < item.width / 2 + .5;
      });
      const rise = climbingRamp ? (state.s - (climbingRamp.s - rampLength(climbingRamp))) / rampLength(climbingRamp) * rampHeight(climbingRamp) : 0;
      state.y = courseHeight(state.s) + rise + .52;
    }
  } else {
    state.airTime += step;
    state.verticalSpeed -= 21.5 * step;
    state.y += state.verticalSpeed * step;
    const floor = courseHeight(state.s) + .52;
    if (state.y <= floor && state.verticalSpeed < 0) {
      state.y = floor;
      state.verticalSpeed = 0;
      state.grounded = true;
      state.spin = 0;
      state.airTime = 0;
      events.push({ type: "RIVAL_LAND" });
    }
  }

  // A IA normalmente evita a linha ruim, mas ainda pode errar sob pressão.
  if (obstacleCollision(state)) {
    state.stun = .82;
    state.tumble = .01;
    state.crashes += 1;
    state.speed *= .58;
    state.lateralSpeed *= -.25;
    state.grounded = false;
    state.verticalSpeed = 2.2;
    events.push({ type: "RIVAL_CRASH" });
  }

  if (state.s >= COURSE_LENGTH) {
    state.finished = true;
    state.finishTime = state.elapsed;
    events.push({ type: "RIVAL_FINISH" });
  }
  return events;
}

export function resolveRiderContact(rival: RivalState, rider: RiderState): boolean {
  if (rival.contactCooldown > 0 || rival.stun > 0 || rider.recovering > 0 || !rival.grounded || !rider.grounded) return false;
  if (Math.abs(rival.s - rider.s) > 1.75 || Math.abs(rival.x - rider.x) > 1.5) return false;
  const side = Math.sign(rival.x - rider.x) || (Math.sin(rival.s) > 0 ? 1 : -1);
  rival.x += side * .32;
  rider.x -= side * .24;
  rival.lateralSpeed += side * 2.8;
  rider.lateralSpeed -= side * 2.1;
  const sharedSpeed = (rival.speed + rider.speed) * .5;
  rival.speed = sharedSpeed * .985;
  rider.speed = sharedSpeed * .975;
  rival.contactCooldown = .55;
  return true;
}

export function resolveRivalContact(first: RivalState, second: RivalState): boolean {
  if (first.contactCooldown > 0 || second.contactCooldown > 0 || first.stun > 0 || second.stun > 0 || !first.grounded || !second.grounded) return false;
  if (Math.abs(first.s - second.s) > 1.7 || Math.abs(first.x - second.x) > 1.45) return false;
  const side = Math.sign(first.x - second.x) || (Math.sin(first.s + first.linePhase) > 0 ? 1 : -1);
  first.x += side * .25;
  second.x -= side * .25;
  first.lateralSpeed += side * 2.2;
  second.lateralSpeed -= side * 2.2;
  const sharedSpeed = (first.speed + second.speed) * .5;
  first.speed = sharedSpeed * .99;
  second.speed = sharedSpeed * .99;
  first.contactCooldown = .5;
  second.contactCooldown = .5;
  return true;
}

export function interpolateRival(previous: RivalState, current: RivalState, alpha: number): RivalState {
  const amount = clamp(alpha, 0, 1);
  return {
    ...current,
    s: lerp(previous.s, current.s, amount),
    x: lerp(previous.x, current.x, amount),
    y: lerp(previous.y, current.y, amount),
    speed: lerp(previous.speed, current.speed, amount),
    lateralSpeed: lerp(previous.lateralSpeed, current.lateralSpeed, amount),
    carve: lerp(previous.carve, current.carve, amount),
    heading: previous.heading + wrapAngle(current.heading - previous.heading) * amount,
    spin: previous.spin + wrapAngle(current.spin - previous.spin) * amount,
    airTime: lerp(previous.airTime, current.airTime, amount),
    tumble: lerp(previous.tumble, current.tumble, amount),
    windHit: lerp(previous.windHit, current.windHit, amount),
  };
}
