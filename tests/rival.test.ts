import { afterEach, describe, expect, it } from "vitest";
import { COURSES, COURSE_HALF_WIDTH, COURSE_LENGTH, ITEM_BOXES, RACE_LAPS, courseHeight, raceProgress, setActiveCourse } from "../src/core/course.ts";
import {
  applyBlizzardSlow, applyWindHit, createRival, GUY_PROFILE, interpolateRival, resolveRivalContact, updateRival, YETI_PROFILE,
} from "../src/core/rival.ts";

afterEach(() => setActiveCourse(COURSES[0].id));

describe("rivais", () => {
  it("desce com decisões suaves e permanece dentro da pista", () => {
    const rival = createRival();
    let maximumStep = 0;
    let minimumX = rival.x, maximumX = rival.x;
    for (let index = 0; index < 1_800; index += 1) {
      const before = rival.x;
      updateRival(rival, rival.s - 5, 0, 1 / 60);
      maximumStep = Math.max(maximumStep, Math.abs(rival.x - before));
      minimumX = Math.min(minimumX, rival.x); maximumX = Math.max(maximumX, rival.x);
      expect(Math.abs(rival.x)).toBeLessThanOrEqual(COURSE_HALF_WIDTH - 1.09);
      expect(rival.y).toBeGreaterThanOrEqual(courseHeight(rival.s) + .51);
    }
    expect(rival.s).toBeGreaterThan(850);
    expect(maximumStep).toBeLessThan(.2);
    expect(maximumX - minimumX).toBeGreaterThan(8);
  });

  it("conclui as quatro pistas sem ficar preso em obstáculos", () => {
    for (const course of COURSES) {
      setActiveCourse(course.id);
      for (const profile of [YETI_PROFILE, GUY_PROFILE]) {
        const rival = createRival(profile);
        let finishEvents = 0;
        for (let index = 0; index < 24_000 && !rival.finished; index += 1) {
          finishEvents += updateRival(rival, raceProgress(rival.lap, rival.s), 0, 1 / 60).filter(event => event.type === "RIVAL_FINISH").length;
        }
        expect(rival.s).toBe(COURSE_LENGTH);
        expect(rival.lap).toBe(RACE_LAPS);
        expect(rival.finished).toBe(true);
        expect(rival.finishTime).toBeGreaterThan(150);
        expect(finishEvents).toBe(1);
      }
    }
  });

  it("usa apenas uma correção de ritmo limitada", () => {
    const behind = createRival();
    const ahead = createRival();
    for (let index = 0; index < 600; index += 1) {
      updateRival(behind, behind.s + 200, 0, 1 / 60);
      updateRival(ahead, Math.max(0, ahead.s - 200), 0, 1 / 60);
    }
    expect(behind.speed - ahead.speed).toBeLessThanOrEqual(6);
  });

  it("pressiona acima da velocidade máxima de chão do jogador quando fica para trás", () => {
    for (const profile of [YETI_PROFILE, GUY_PROFILE]) {
      const rival = createRival(profile);
      for (let index = 0; index < 600; index += 1) updateRival(rival, rival.s + 100, 0, 1 / 60);
      expect(rival.speed).toBeGreaterThan(45);
      expect(rival.speed).toBeLessThanOrEqual(50.5);
    }
  });

  it("interpola o movimento sem saltos visuais", () => {
    const previous = createRival();
    const current = { ...previous, s: 10, x: -4, y: previous.y - 1, heading: .4 };
    const half = interpolateRival(previous, current, .5);
    expect(half.s).toBe(5);
    expect(half.x).toBeCloseTo(-.45);
    expect(half.heading).toBeCloseTo(.2);
  });

  it("dá ao Guy uma linha diferente da linha do Yeti", () => {
    const yeti = createRival(YETI_PROFILE);
    const guy = createRival(GUY_PROFILE);
    for (let index = 0; index < 1_200; index += 1) {
      updateRival(yeti, 300, 0, 1 / 60);
      updateRival(guy, 300, 0, 1 / 60);
    }
    expect(guy.name).toBe("GUY");
    expect(yeti.name).toBe("YETI");
    expect(Math.abs(guy.x - yeti.x)).toBeGreaterThan(.5);
  });

  it("separa adversários quando eles disputam a mesma linha", () => {
    const yeti = createRival(YETI_PROFILE);
    const guy = createRival(GUY_PROFILE);
    guy.x = yeti.x + .2;
    guy.s = yeti.s + .2;
    expect(resolveRivalContact(yeti, guy)).toBe(true);
    expect(Math.abs(yeti.x - guy.x)).toBeGreaterThan(.2);
    expect(yeti.contactCooldown).toBeGreaterThan(0);
    expect(guy.contactCooldown).toBeGreaterThan(0);
  });

  it("reage ao tiro de vento perdendo velocidade, sendo empurrado e caindo", () => {
    const yeti = createRival(YETI_PROFILE);
    const speed = yeti.speed;
    applyWindHit(yeti);
    expect(yeti.speed).toBeLessThan(speed);
    expect(Math.abs(yeti.lateralSpeed)).toBeGreaterThan(7);
    expect(yeti.windHit).toBeGreaterThan(0);
    expect(yeti.stun).toBeGreaterThan(0);
    expect(yeti.grounded).toBe(false);
    expect(yeti.verticalSpeed).toBeGreaterThan(0);
  });

  it("fica temporariamente lento ao ser atingido pela Nevasca e depois recupera o ritmo", () => {
    const guy = createRival(GUY_PROFILE);
    guy.speed = 46;
    expect(applyBlizzardSlow(guy)).toBe(true);
    expect(guy.slowTime).toBeGreaterThan(4);
    expect(guy.speed).toBeLessThan(40);
    for (let index = 0; index < 120; index += 1) updateRival(guy, raceProgress(guy.lap, guy.s), 0, 1 / 60);
    expect(guy.speed).toBeLessThan(34);
    for (let index = 0; index < 240; index += 1) updateRival(guy, raceProgress(guy.lap, guy.s), 0, 1 / 60);
    expect(guy.slowTime).toBe(0);
    expect(guy.speed).toBeGreaterThan(40);
  });

  it("recebe turbo ao completar a rotação e pousar corretamente", () => {
    const guy = createRival(GUY_PROFILE);
    guy.s = 80;
    guy.grounded = false;
    guy.y = courseHeight(guy.s) + .53;
    guy.verticalSpeed = -4;
    guy.spin = Math.PI * 2;
    guy.airTime = .8;
    const events = updateRival(guy, raceProgress(guy.lap, guy.s), 0, 1 / 60);
    const landing = events.find(event => event.type === "RIVAL_LAND");
    expect(landing?.type === "RIVAL_LAND" && landing.boost).toBeGreaterThan(1.4);
    expect(guy.turboTime).toBeGreaterThan(1.4);
    expect(guy.speed).toBeGreaterThan(18.5);
  });

  it("coleta caixa sem moedas e não a trata como obstáculo", () => {
    const box = ITEM_BOXES.find(item => item.item === "turbo") ?? ITEM_BOXES[0];
    const guy = createRival(GUY_PROFILE);
    guy.s = box.s - .35;
    guy.x = box.x;
    guy.targetX = box.x;
    guy.decisionTimer = 1;
    guy.speed = 24;

    const events = updateRival(guy, raceProgress(guy.lap, guy.s), guy.x, 1 / 20);

    expect(events).toContainEqual({ type: "RIVAL_ITEM", item: box.item, id: box.id });
    expect(guy.collectedBoxes).toContain(box.id);
    expect(guy.stun).toBe(0);
    expect(guy.crashes).toBe(0);
    if (box.item === "turbo") expect(guy.turboTime).toBeGreaterThan(3);
  });
});
