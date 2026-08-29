import { describe, expect, it } from "vitest";
import { addCombo, evaluateTrick, gradeLanding, rotationError } from "../src/core/scoring.ts";

describe("manobras e pontuação", () => {
  it("reconhece rotação completa, flip e grab", () => {
    const trick = evaluateTrick(Math.PI * 2, Math.PI * 2, 0.9, "clean");
    expect(trick.name).toContain("360°");
    expect(trick.name).toContain("Flip");
    expect(trick.name).toContain("Grab longo");
    expect(trick.basePoints).toBeGreaterThan(1_000);
  });

  it("diferencia pouso limpo, ruim e queda", () => {
    expect(gradeLanding(Math.PI * 2 + 0.1, 0, 9, false)).toBe("clean");
    expect(gradeLanding(0.7, 0, 12, false)).toBe("sketchy");
    expect(gradeLanding(Math.PI, 0, 12, false)).toBe("crash");
    expect(gradeLanding(0, 0, 20, false)).toBe("clean");
    expect(gradeLanding(0, 0, 23, false)).toBe("sketchy");
    expect(gradeLanding(0, 0, 26, false)).toBe("crash");
    expect(rotationError(Math.PI * 2 + 0.2)).toBeCloseTo(0.2);
  });

  it("limita o multiplicador e aplica-o aos pontos", () => {
    let score = 0;
    let combo = 1;
    for (let index = 0; index < 30; index += 1) ({ score, combo } = addCombo(score, combo, 600));
    expect(combo).toBe(8);
    expect(score).toBeGreaterThan(10_000);
  });
});
