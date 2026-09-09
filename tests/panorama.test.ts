import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COURSE_PANORAMAS } from "../src/view/coursePanoramas.ts";

describe("alpine panorama", () => {
  const source = readFileSync("src/view/GameView.ts", "utf8");
  it.each(Object.entries(COURSE_PANORAMAS))("ships a 2:1 panorama for %s", (_id, definition) => {
    const png = readFileSync(`public/images/scenery/${definition.file}`);
    expect(png.readUInt32BE(16)).toBe(png.readUInt32BE(20) * 2);
  });
  it("keeps world orientation fixed and discards stale course loads", () => {
    expect(Object.keys(COURSE_PANORAMAS)).toHaveLength(4);
    expect(source).toContain('this.panoramaRequested !== courseId');
    expect(source).toContain('this.mountainPanorama.material.map?.dispose()');
    expect(source).toContain("this.mountainPanorama?.position.copy(this.camera.position)");
    expect(source).not.toMatch(/mountainPanorama\??\.(rotation|quaternion)/);
  });
});
