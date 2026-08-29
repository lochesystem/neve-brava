import { clamp } from "./math.ts";

export type LandingGrade = "clean" | "sketchy" | "crash";

export type TrickResult = {
  name: string;
  basePoints: number;
  spinTurns: number;
  flipTurns: number;
  landing: LandingGrade;
};

export function rotationError(angle: number): number {
  const turn = Math.PI * 2;
  const normalized = ((angle % turn) + turn) % turn;
  return Math.min(normalized, turn - normalized);
}

export function gradeLanding(spin: number, flip: number, impactSpeed: number, recovering: boolean): LandingGrade {
  if (recovering) return "sketchy";
  const error = Math.max(rotationError(spin), rotationError(flip));
  if (error < 0.48 && impactSpeed < 21) return "clean";
  if (error < 1.08 && impactSpeed < 25) return "sketchy";
  return "crash";
}

export function evaluateTrick(spin: number, flip: number, grabTime: number, landing: LandingGrade): TrickResult {
  const spinTurns = Math.floor((Math.abs(spin) + 0.35) / (Math.PI * 2));
  const flipTurns = Math.floor((Math.abs(flip) + 0.35) / (Math.PI * 2));
  const parts: string[] = [];
  if (spinTurns > 0) parts.push(`${spinTurns * 360}°`);
  if (flipTurns > 0) parts.push(flipTurns === 1 ? "Flip" : `${flipTurns}x Flip`);
  if (grabTime > 0.16) parts.push(grabTime > 0.8 ? "Grab longo" : "Grab");
  if (!parts.length) parts.push("Salto");
  const variety = Number(spinTurns > 0) + Number(flipTurns > 0) + Number(grabTime > 0.16);
  const raw = 120 + spinTurns * 420 + flipTurns * 560 + Math.round(grabTime * 230) + Math.max(0, variety - 1) * 240;
  const landingFactor = landing === "clean" ? 1.25 : landing === "sketchy" ? 0.65 : 0;
  return { name: parts.join(" + "), basePoints: Math.round(raw * landingFactor), spinTurns, flipTurns, landing };
}

export function addCombo(score: number, combo: number, basePoints: number): { score: number; combo: number; awarded: number } {
  const nextCombo = clamp(combo + 0.25 + Math.min(0.5, basePoints / 2_000), 1, 8);
  const awarded = Math.round(basePoints * nextCombo);
  return { score: score + awarded, combo: nextCombo, awarded };
}

export function nearMissPoints(speed: number, combo: number): number {
  return Math.round((80 + clamp(speed, 0, 50) * 5) * combo);
}
