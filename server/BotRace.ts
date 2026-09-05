import { COURSES, raceProgress, setActiveCourse } from "../src/core/course.js";
import {
  RIVAL_PROFILES,
  applyBlizzardSlow,
  applyFreeze,
  applyTimeWarp,
  applyWindHit,
  createRival,
  resolveRivalContact,
  updateRival,
  type RivalEvent,
  type RivalState,
} from "../src/core/rival.js";
import type {
  BotStatePacket,
  MultiplayerAction,
  MultiplayerBot,
  MultiplayerCharacterId,
  MultiplayerCourseId,
  NetworkRacerState,
  RaceStart,
} from "../shared/multiplayer.js";

type Snowball = { ownerId: string; s: number; lap: number; hit: Set<string> };
type BotRuntime = {
  code: string;
  courseId: MultiplayerCourseId;
  startsAt: number;
  sequence: number;
  broadcastTimer: number;
  accumulated: number;
  lastTick: number;
  random: () => number;
  bots: Map<string, RivalState>;
  descriptors: MultiplayerBot[];
  humans: Map<string, NetworkRacerState>;
  humanCharacters: Map<string, MultiplayerCharacterId>;
  snowballs: Snowball[];
};

type EmitState = (code: string, packet: BotStatePacket) => void;
type EmitAction = (code: string, action: MultiplayerAction) => void;

const BOT_STEP = 1 / 30;
const BOT_BROADCAST_STEP = 1 / 15;
const MAX_RUNTIME_MS = 35 * 60_000;
const WIND_RANGE = 74;

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

function botNetworkState(state: RivalState): NetworkRacerState {
  return {
    s: state.s,
    x: state.x,
    y: state.y,
    speed: state.speed,
    lateralSpeed: state.lateralSpeed,
    grounded: state.grounded,
    verticalSpeed: state.verticalSpeed,
    carve: state.carve,
    heading: state.heading,
    spin: state.spin,
    flip: 0,
    recovering: state.stun,
    tumbleTime: state.tumble,
    tumbleDirection: Math.sign(state.lateralSpeed) || 1,
    lap: state.lap,
    liftTime: state.liftTime,
    finished: state.finished,
    elapsed: state.elapsed,
    item: state.item,
    credits: state.credits,
    turboTime: state.turboTime,
    specialTurboTime: state.specialTurboTime,
    shieldTime: state.shieldTime,
    slowTime: state.slowTime,
    timeWarpTime: state.timeWarpTime,
    freezeTime: state.freezeTime,
  };
}

function actionId(): string {
  return globalThis.crypto.randomUUID();
}

export class BotRaceManager {
  private runtimes = new Map<string, BotRuntime>();

  start(start: RaceStart): void {
    setActiveCourse(start.room.courseId);
    const bots = new Map<string, RivalState>();
    for (const descriptor of start.bots) {
      bots.set(descriptor.actorId, createRival({ ...RIVAL_PROFILES[descriptor.character], startX: descriptor.startX }));
    }
    this.runtimes.set(start.room.code, {
      code: start.room.code,
      courseId: start.room.courseId,
      startsAt: start.startsAt,
      sequence: 0,
      broadcastTimer: 0,
      accumulated: 0,
      lastTick: start.startsAt,
      random: mulberry32(start.seed),
      bots,
      descriptors: start.bots,
      humans: new Map(),
      humanCharacters: new Map(start.room.players.map(player => [player.id, player.character])),
      snowballs: [],
    });
  }

  stop(code: string): void {
    this.runtimes.delete(code);
  }

  count(): number {
    return this.runtimes.size;
  }

  updateHuman(code: string, playerId: string, state: NetworkRacerState): void {
    this.runtimes.get(code)?.humans.set(playerId, state);
  }

  handleHumanAction(code: string, playerId: string, action: Omit<MultiplayerAction, "actorId">): void {
    const runtime = this.runtimes.get(code);
    if (!runtime) return;
    setActiveCourse(runtime.courseId);
    if (action.type === "wind" && action.targetId?.startsWith("bot:")) {
      const target = runtime.bots.get(action.targetId);
      if (target) applyWindHit(target);
      return;
    }
    if (action.type === "blizzard") {
      runtime.bots.forEach(applyBlizzardSlow);
      return;
    }
    if (action.type !== "special") return;
    const character = runtime.humanCharacters.get(playerId);
    const source = runtime.humans.get(playerId);
    if (!character || !source) return;
    this.applySpecial(runtime, playerId, character, source.s, source.lap);
  }

  tick(now: number, emitState: EmitState, emitAction: EmitAction): void {
    for (const [code, runtime] of this.runtimes) {
      if (now - runtime.startsAt > MAX_RUNTIME_MS) {
        this.runtimes.delete(code);
        continue;
      }
      const elapsed = Math.min(.12, Math.max(0, (now - runtime.lastTick) / 1_000));
      runtime.lastTick = now;
      if (now < runtime.startsAt) continue;
      runtime.accumulated = Math.min(.2, runtime.accumulated + elapsed);
      setActiveCourse(runtime.courseId);
      while (runtime.accumulated >= BOT_STEP) {
        this.step(runtime, emitAction);
        runtime.accumulated -= BOT_STEP;
        runtime.broadcastTimer += BOT_STEP;
      }
      if (runtime.broadcastTimer >= BOT_BROADCAST_STEP) {
        runtime.broadcastTimer %= BOT_BROADCAST_STEP;
        this.broadcast(runtime, emitState);
      }
    }
  }

  private step(runtime: BotRuntime, emitAction: EmitAction): void {
    const allBots = [...runtime.bots.entries()];
    for (const [actorId, bot] of allBots) {
      const reference = this.referenceRacer(runtime, actorId);
      const position = this.racePosition(runtime, bot.lap, bot.s);
      const events = updateRival(bot, reference.progress, reference.x, BOT_STEP, position, runtime.random);
      events.forEach(event => this.handleBotEvent(runtime, actorId, bot, event, emitAction));
    }
    for (let first = 0; first < allBots.length; first += 1) {
      for (let second = first + 1; second < allBots.length; second += 1) {
        resolveRivalContact(allBots[first][1], allBots[second][1]);
      }
    }
    this.updateSnowballs(runtime);
  }

  private referenceRacer(runtime: BotRuntime, excludedActorId: string): { progress: number; x: number } {
    const candidates = [
      ...[...runtime.humans.values()].map(state => ({ progress: raceProgress(state.lap, state.s), x: state.x })),
      ...[...runtime.bots.entries()]
        .filter(([actorId]) => actorId !== excludedActorId)
        .map(([, state]) => ({ progress: raceProgress(state.lap, state.s), x: state.x })),
    ];
    return candidates.reduce((leader, candidate) => candidate.progress > leader.progress ? candidate : leader, { progress: 0, x: 0 });
  }

  private racePosition(runtime: BotRuntime, lap: number, s: number): number {
    const progress = raceProgress(lap, s);
    const ahead = [
      ...[...runtime.humans.values()].map(state => raceProgress(state.lap, state.s)),
      ...[...runtime.bots.values()].map(state => raceProgress(state.lap, state.s)),
    ].filter(candidate => candidate > progress + .01).length;
    return Math.min(4, ahead + 1);
  }

  private handleBotEvent(runtime: BotRuntime, actorId: string, bot: RivalState, event: RivalEvent, emitAction: EmitAction): void {
    if (event.type === "RIVAL_ITEM_USED" && event.item === "wind") {
      const targetId = this.windTarget(runtime, actorId, bot);
      if (targetId) emitAction(runtime.code, { id: actionId(), actorId, type: "wind", targetId });
      return;
    }
    if (event.type === "RIVAL_ITEM_USED" && event.item === "blizzard") {
      runtime.bots.forEach((target, targetId) => { if (targetId !== actorId) applyBlizzardSlow(target); });
      emitAction(runtime.code, { id: actionId(), actorId, type: "blizzard" });
      return;
    }
    if (event.type === "RIVAL_SPECIAL") {
      this.applySpecial(runtime, actorId, event.character, bot.s, bot.lap);
      emitAction(runtime.code, { id: actionId(), actorId, type: "special" });
    }
  }

  private windTarget(runtime: BotRuntime, actorId: string, source: RivalState): string | null {
    const candidates = [
      ...[...runtime.humans.entries()].map(([id, state]) => ({ id, state, bot: false })),
      ...[...runtime.bots.entries()].filter(([id]) => id !== actorId).map(([id, state]) => ({ id, state: botNetworkState(state), bot: true })),
    ]
      .filter(candidate => !candidate.state.finished && candidate.state.liftTime <= 0 && candidate.state.lap === source.lap)
      .map(candidate => ({ ...candidate, distance: Math.hypot(candidate.state.s - source.s, (candidate.state.x - source.x) * 1.35) }))
      .filter(candidate => candidate.state.s >= source.s - 5 && candidate.distance <= WIND_RANGE)
      .sort((first, second) => first.distance - second.distance);
    const target = candidates[0];
    if (!target) return null;
    if (target.bot) {
      const bot = runtime.bots.get(target.id);
      if (bot) applyWindHit(bot);
    }
    return target.id;
  }

  private applySpecial(runtime: BotRuntime, actorId: string, character: MultiplayerCharacterId, s: number, lap: number): void {
    if (character === "snowman") {
      runtime.snowballs.push({ ownerId: actorId, s, lap, hit: new Set() });
    } else if (character === "yeti") {
      runtime.bots.forEach((target, targetId) => { if (targetId !== actorId) applyWindHit(target); });
    } else if (character === "giru") {
      runtime.bots.forEach((target, targetId) => { if (targetId !== actorId) applyTimeWarp(target); });
    }
  }

  private updateSnowballs(runtime: BotRuntime): void {
    const courseLength = COURSES.find(course => course.id === runtime.courseId)?.length ?? COURSES[0].length;
    for (const snowball of runtime.snowballs) {
      const previousS = snowball.s;
      snowball.s = Math.min(courseLength, snowball.s + 220 * BOT_STEP);
      runtime.bots.forEach((target, targetId) => {
        if (targetId === snowball.ownerId || snowball.hit.has(targetId) || target.finished || target.lap !== snowball.lap) return;
        if (target.s < previousS - 6 || target.s > snowball.s + 3) return;
        if (applyFreeze(target)) snowball.hit.add(targetId);
      });
    }
    runtime.snowballs = runtime.snowballs.filter(snowball => snowball.s < courseLength);
  }

  private broadcast(runtime: BotRuntime, emitState: EmitState): void {
    emitState(runtime.code, {
      sequence: runtime.sequence++,
      bots: runtime.descriptors.map(descriptor => ({
        ...descriptor,
        state: botNetworkState(runtime.bots.get(descriptor.actorId)!),
      })),
    });
  }
}
