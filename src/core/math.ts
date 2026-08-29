export type Vec2 = { x: number; y: number };

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

export function approach(current: number, target: number, amount: number): number {
  if (current < target) return Math.min(target, current + amount);
  return Math.max(target, current - amount);
}

export function dampAlpha(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export function radialDeadzone(x: number, y: number, deadzone = 0.16): Vec2 {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const remapped = clamp((magnitude - deadzone) / (1 - deadzone), 0, 1);
  return { x: x / magnitude * remapped, y: y / magnitude * remapped };
}

export function wrapAngle(angle: number): number {
  const turn = Math.PI * 2;
  return ((angle + Math.PI) % turn + turn) % turn - Math.PI;
}

export function crossing(previous: number, current: number, marker: number): boolean {
  return previous < marker && current >= marker;
}
