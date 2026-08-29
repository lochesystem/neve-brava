import { afterEach, describe, expect, it } from "vitest";
import { COURSES, COURSE_HALF_WIDTH, COURSE_LENGTH, courseHeight, setActiveCourse } from "../src/core/course.ts";
import { createRival, interpolateRival, updateRival } from "../src/core/rival.ts";

afterEach(() => setActiveCourse(COURSES[0].id));

describe("rival yeti", () => {
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
      const rival = createRival();
      let finishEvents = 0;
      for (let index = 0; index < 8_000 && !rival.finished; index += 1) {
        finishEvents += updateRival(rival, rival.s, 0, 1 / 60).filter(event => event.type === "RIVAL_FINISH").length;
      }
      expect(rival.s).toBe(COURSE_LENGTH);
      expect(rival.finished).toBe(true);
      expect(rival.finishTime).toBeGreaterThan(45);
      expect(finishEvents).toBe(1);
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

  it("interpola o movimento sem saltos visuais", () => {
    const previous = createRival();
    const current = { ...previous, s: 10, x: -4, y: previous.y - 1, heading: .4 };
    const half = interpolateRival(previous, current, .5);
    expect(half.s).toBe(5);
    expect(half.x).toBeCloseTo(-.45);
    expect(half.heading).toBeCloseTo(.2);
  });
});
