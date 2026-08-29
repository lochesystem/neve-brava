import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../src/core/characters.ts";
import { createRival, RIVAL_PROFILES } from "../src/core/rival.ts";

describe("seleção de personagens", () => {
  it("oferece quatro personagens únicos", () => {
    expect(CHARACTERS).toHaveLength(4);
    expect(new Set(CHARACTERS.map(character => character.id)).size).toBe(4);
  });

  it.each(CHARACTERS)("mantém três rivais quando $name é o jogador", player => {
    const startPositions = [3.1, -3.15, 7.4];
    const opponents = CHARACTERS.filter(character => character.id !== player.id)
      .map((character, index) => createRival({ ...RIVAL_PROFILES[character.id], startX: startPositions[index] }));

    expect(opponents).toHaveLength(3);
    expect(opponents.map(opponent => opponent.id)).not.toContain(player.id);
    expect(new Set(opponents.map(opponent => opponent.id)).size).toBe(3);
  });
});
