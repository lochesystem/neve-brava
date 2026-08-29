import { describe, expect, it } from "vitest";
import { isTouchDevice } from "../src/input/InputManager.ts";

describe("detecção de controles touch", () => {
  it("ativa em aparelhos com pontos de toque", () => expect(isTouchDevice(5, false)).toBe(true));
  it("ativa em ponteiros coarse e no modo forçado", () => {
    expect(isTouchDevice(0, true)).toBe(true);
    expect(isTouchDevice(0, false, true)).toBe(true);
  });
  it("mantém desktop sem touch no modo DualSense", () => expect(isTouchDevice(0, false)).toBe(false));
});
