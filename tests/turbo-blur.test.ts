import { expect, it, vi } from "vitest";
import { TurboBlur, turboBlurTarget } from "../src/view/turboBlur.ts";
import type { WebGLRenderer } from "three";

it("uses the shared item/trick timer and special timer, including fade-out", () => {
  expect(turboBlurTarget(3.2,0,true)).toBe(1);
  expect(turboBlurTarget(.8,0,true)).toBe(1);
  expect(turboBlurTarget(0,3,true)).toBe(1);
  expect(turboBlurTarget(.125,0,true)).toBe(.5);
  expect(turboBlurTarget(3,3,false)).toBe(0);
  expect(turboBlurTarget(0,0,true)).toBe(0);
});
it("does no framebuffer copy or extra rendering when inactive", () => {
  const render=vi.fn(),copyFramebufferToTexture=vi.fn();
  const effect=new TurboBlur();
  for(let i=0;i<60;i++) effect.render({render,copyFramebufferToTexture} as unknown as WebGLRenderer,0,1/60);
  expect(render).not.toHaveBeenCalled(); expect(copyFramebufferToTexture).not.toHaveBeenCalled();
  effect.dispose();
});
