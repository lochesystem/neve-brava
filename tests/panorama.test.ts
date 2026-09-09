import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("alpine panorama", () => {
  const source = readFileSync("src/view/GameView.ts", "utf8");
  it("ships a 2:1 PNG panorama", () => {
    const png = readFileSync("public/images/scenery/alpine-sunset-v1.png");
    expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20) * 2);
  });
  it("keeps world orientation fixed and limits the pilot to Vale Bravo", () => {
    expect(source).toContain('getActiveCourse().id === "vale-bravo"');
    expect(source).toContain("this.mountainPanorama?.position.copy(this.camera.position)");
    expect(source).not.toMatch(/mountainPanorama\??\.(rotation|quaternion)/);
  });
});
