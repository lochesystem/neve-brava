import { describe, expect, it } from "vitest";
import { COINS, COURSES, COURSE_HALF_WIDTH, COURSE_LENGTH, ITEM_BOXES, OBSTACLES, RAMPS, courseCenterX, courseFrame, courseHeight, obstacleConflictsWithRamp, setActiveCourse, validateAllCourses, validateCourse } from "../src/core/course.ts";

describe("pista", () => {
  it("possui duração, conteúdo e geometria válidos", () => {
    expect(COURSE_LENGTH).toBeGreaterThanOrEqual(3_000);
    expect(RAMPS).toHaveLength(4);
    expect(OBSTACLES.length).toBeGreaterThan(60);
    expect(COINS).toHaveLength(24);
    expect(ITEM_BOXES).toHaveLength(9);
    expect(COINS.every(coin => coin.value === 100)).toBe(true);
    expect(ITEM_BOXES.every(box => !("cost" in box))).toBe(true);
    expect(validateCourse()).toEqual([]);
  });

  it("desce de forma contínua até a chegada", () => {
    let largestStep = 0;
    for (let s = 5; s <= COURSE_LENGTH; s += 5) {
      largestStep = Math.max(largestStep, Math.abs(courseHeight(s) - courseHeight(s - 5)));
    }
    expect(courseHeight(COURSE_LENGTH)).toBeLessThan(courseHeight(0) - 300);
    expect(largestStep).toBeLessThan(1.4);
  });

  it("possui curvas visíveis e mantém a floresta fora da área jogável", () => {
    const centers: number[] = [];
    const headings: number[] = [];
    for (let s = 0; s <= COURSE_LENGTH; s += 50) {
      centers.push(courseCenterX(s));
      headings.push(courseFrame(s).heading);
    }
    expect(Math.max(...centers) - Math.min(...centers)).toBeGreaterThan(100);
    expect(Math.max(...headings) - Math.min(...headings)).toBeGreaterThan(0.7);
    const scenery = OBSTACLES.filter(obstacle => obstacle.decorative);
    expect(scenery.length).toBeGreaterThan(600);
    expect(scenery.every(obstacle => Math.abs(obstacle.x) > COURSE_HALF_WIDTH + 2)).toBe(true);
  });

  it("mantém as quatro pistas da campanha válidas, distintas e jogáveis", () => {
    expect(COURSES).toHaveLength(4);
    expect(validateAllCourses()).toEqual(Object.fromEntries(COURSES.map(course => [course.id, []])));
    expect(new Set(COURSES.map(course => course.name)).size).toBe(4);
    expect(new Set(COURSES.map(course => course.length)).size).toBe(4);
    for (const course of COURSES) {
      setActiveCourse(course.id);
      expect(RAMPS).toHaveLength(4);
      expect(OBSTACLES.some(item => !item.decorative)).toBe(true);
      expect(new Set(ITEM_BOXES.map(box => box.item))).toEqual(new Set(["wind", "turbo", "shield"]));
      expect(courseHeight(COURSE_LENGTH)).toBeLessThan(courseHeight(0) - 300);
    }
    setActiveCourse(COURSES[0].id);
  });

  it("mantém aproximação, superfície e recepção das rampas livres de obstáculos", () => {
    for (const course of COURSES) {
      setActiveCourse(course.id);
      const conflicts = OBSTACLES.filter(obstacle => !obstacle.decorative)
        .flatMap(obstacle => RAMPS.filter(ramp => obstacleConflictsWithRamp(obstacle, ramp))
          .map(ramp => `${obstacle.id} sobre ${ramp.id}`));
      expect(conflicts, course.name).toEqual([]);
    }
    setActiveCourse(COURSES[0].id);
  });
});
