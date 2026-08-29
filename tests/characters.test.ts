import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/core/characters.ts";
import { createRival, RIVAL_PROFILES } from "../src/core/rival.ts";

describe("seleção de personagens", () => {
  it("oferece três personagens únicos", () => {
    expect(CHARACTERS).toHaveLength(3);
    expect(new Set(CHARACTERS.map(character => character.id)).size).toBe(3);
  });

  it.each(CHARACTERS)("mantém dois rivais quando $name é o jogador", player => {
    const opponents = CHARACTERS.filter(character => character.id !== player.id)
      .map((character, index) => createRival({ ...RIVAL_PROFILES[character.id], startX: index ? -3.15 : 3.1 }));

    expect(opponents).toHaveLength(2);
    expect(opponents.map(opponent => opponent.id)).not.toContain(player.id);
    expect(new Set(opponents.map(opponent => opponent.id)).size).toBe(2);
  });
});
