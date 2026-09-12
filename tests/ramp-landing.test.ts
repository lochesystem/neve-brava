import { afterEach, describe, expect, it } from "vitest";
import { RAMPS, courseHeight, rampLength, setActiveCourse } from "../src/core/course.ts";
import { createRider, EMPTY_INTENT, updateRider, type GameEvent } from "../src/core/simulation.ts";

afterEach(() => setActiveCourse("vale-bravo"));

function jump(index: number, speed: number, spin = 0) {
  setActiveCourse("passagem-geleira");
  const ramp = RAMPS[index], rider = createRider();
  rider.s = ramp.s - rampLength(ramp) - 2;
  rider.x = ramp.x;
  rider.speed = speed;
  rider.y = courseHeight(rider.s) + .46;
  if (speed === 58) rider.turboTime = 5;
  const events: GameEvent[] = [];
  for (let i = 0; i < 600; i++) {
    const step = updateRider(rider, EMPTY_INTENT, 1 / 60);
    events.push(...step);
    if (step.some(event => event.type === "TAKEOFF")) rider.spin = spin;
    if (step.some(event => event.type === "LAND" || event.type === "CRASH")) break;
  }
  return { rider, events };
}

describe("high ramp landing tolerance", () => {
  it.each([18, 40, 58])("lands aligned on all four natural ramps at %s m/s", speed => {
    for (let ramp = 0; ramp < 4; ramp++) {
      const { rider, events } = jump(ramp, speed);
      expect(events.some(event => event.type === "CRASH")).toBe(false);
      expect(events).toContainEqual(expect.objectContaining({ type: "LAND", grade: "clean" }));
      expect(rider.rampImpactAllowance).toBe(0);
    }
  });
  it("still crashes on an unfinished half spin", () => {
    const { events } = jump(3, 40, Math.PI);
    expect(events).toContainEqual(expect.objectContaining({ type: "LAND", grade: "crash" }));
  });
  it("rewards a completed spin with a clean landing and boost", () => {
    const { events } = jump(3, 40, Math.PI * 2);
    const landing = events.find(event => event.type === "LAND");
    expect(landing?.grade).toBe("clean");
    expect(landing?.boost).toBeGreaterThan(0);
  });
  it("does not exempt an unrelated hard fall", () => {
    const rider = createRider();
    rider.s = 70; rider.y = courseHeight(70) + .6;
    rider.grounded = false; rider.verticalSpeed = -35;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events).toContainEqual(expect.objectContaining({ type: "LAND", grade: "crash" }));
  });
});
