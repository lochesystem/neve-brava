import type { CharacterId } from "./characters.ts";

export type SpecialDefinition = { name: string; cost: number };

export const SPECIALS: Record<CharacterId, SpecialDefinition> = {
  snowman: { name: "BOLA GIGANTE", cost: 1_500 },
  yeti: { name: "GRITO GLACIAL", cost: 1_000 },
  guy: { name: "TURBO DUPLO", cost: 1_500 },
  giru: { name: "TEMPO VIOLETA", cost: 1_800 },
};
