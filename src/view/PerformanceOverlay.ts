import type * as THREE from "three";

/** Opt-in diagnostics; no DOM or sampling cost in normal play. */
export class PerformanceOverlay {
  private element: HTMLPreElement | null = null;
  private samples: number[] = [];
  private previous = 0;
  private lastReport = 0;

  constructor() {
    if (new URLSearchParams(location.search).get("perf") !== "1") return;
    this.element = document.createElement("pre");
    this.element.style.cssText = "position:fixed;left:8px;top:100px;z-index:9999;padding:8px;background:#102030dc;color:#fff;font:11px monospace;pointer-events:none";
    document.body.append(this.element);
  }

  update(info: THREE.WebGLInfo, particles: number, pooled: number): void {
    if (!this.element) return;
    const now = performance.now();
    if (this.previous && now - this.previous < 250) this.samples.push(now - this.previous);
    this.previous = now;
    if (now - this.lastReport < 1000 || !this.samples.length) return;
    const sorted = this.samples.sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    this.element.textContent = `${(1000 / mean).toFixed(0)} FPS · p95 ${sorted[Math.floor((sorted.length - 1) * .95)].toFixed(1)} ms\nDraw calls ${info.render.calls} · tri ${info.render.triangles.toLocaleString()}\nGeometrias ${info.memory.geometries} · texturas ${info.memory.textures}\nPartículas ${particles} · reserva ${pooled}`;
    this.samples.length = 0;
    this.lastReport = now;
  }
}
