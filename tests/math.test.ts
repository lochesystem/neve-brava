import { describe, expect, it } from "vitest";
import { crossing, radialDeadzone, wrapAngle } from "../src/core/math.ts";
import { isDualSenseId } from "../src/input/InputManager.ts";

describe("matemática de input e movimento", () => {
  it("remove drift e remapeia a deadzone radial", () => {
    expect(radialDeadzone(0.08, -0.04, 0.16)).toEqual({ x: 0, y: 0 });
    expect(radialDeadzone(1, 0, 0.16)).toEqual({ x: 1, y: 0 });
    const diagonal = radialDeadzone(0.5, 0.5, 0.16);
    expect(diagonal.x).toBeCloseTo(diagonal.y);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeLessThan(1);
  });

  it("detecta cruzamento sem disparar duas vezes", () => {
    expect(crossing(9.9, 10.1, 10)).toBe(true);
    expect(crossing(10.1, 11, 10)).toBe(false);
  });

  it("normaliza ângulos pelo caminho curto", () => {
    expect(wrapAngle(Math.PI * 2 + 0.2)).toBeCloseTo(0.2);
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI);
  });

  it("reconhece IDs usuais do DualSense e rejeita controle genérico", () => {
    expect(isDualSenseId("DualSense Wireless Controller")).toBe(true);
    expect(isDualSenseId("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)")).toBe(true);
    expect(isDualSenseId("Generic USB Gamepad")).toBe(false);
  });
});
