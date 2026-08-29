import { describe, expect, it } from "vitest";
import { courseMusicPath } from "../src/input/AudioManager.ts";

describe("trilhas da campanha", () => {
  it("vincula as quatro pistas às faixas enumeradas", () => {
    expect([1, 2, 3, 4].map(order => courseMusicPath(order, "/neve-brava/"))).toEqual([
      "/neve-brava/audio/track-1.mp3",
      "/neve-brava/audio/track-2.mp3",
      "/neve-brava/audio/track-3.mp3",
      "/neve-brava/audio/track-4.mp3",
    ]);
  });

  it("protege a seleção contra números fora da campanha", () => {
    expect(courseMusicPath(0, "/neve-brava/")).toBe("/neve-brava/audio/track-1.mp3");
    expect(courseMusicPath(9, "/neve-brava/")).toBe("/neve-brava/audio/track-4.mp3");
  });
});
