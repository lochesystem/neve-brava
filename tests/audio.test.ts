import { describe, expect, it } from "vitest";
import { courseMusicPath, menuMusicPath, snowmanVoicePath } from "../src/input/AudioManager.ts";

describe("trilhas da campanha", () => {
  it("mantém um tema próprio nos menus", () => {
    expect(menuMusicPath("/neve-brava/")).toBe("/neve-brava/audio/main-menu-theme.mp3");
  });

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

  it("vincula as falas do Nevinho aos cinco eventos da corrida", () => {
    expect(["nitro", "overtake-first", "hit", "special", "wind-hit"].map(cue =>
      snowmanVoicePath(cue as Parameters<typeof snowmanVoicePath>[0], "/neve-brava/"))).toEqual([
      "/neve-brava/audio/voices/snowman/nitro.mp3",
      "/neve-brava/audio/voices/snowman/overtake-first.mp3",
      "/neve-brava/audio/voices/snowman/hit.mp3",
      "/neve-brava/audio/voices/snowman/special.mp3",
      "/neve-brava/audio/voices/snowman/wind-hit.mp3",
    ]);
  });
});
