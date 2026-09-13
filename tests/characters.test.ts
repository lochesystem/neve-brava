import { describe, expect, it } from "vitest";
import { CHARACTERS, opponentCharacters } from "../src/core/characters.ts";
import { createRival, RIVAL_PROFILES } from "../src/core/rival.ts";

describe("seleção de personagens", () => {
  it("oferece cinco personagens únicos, incluindo o secreto", () => {
    expect(CHARACTERS).toHaveLength(5);
    expect(new Set(CHARACTERS.map(character => character.id)).size).toBe(5);
  });

  it.each(CHARACTERS)("mantém três rivais quando $name é o jogador", player => {
    const startPositions = [3.1, -3.15, 7.4];
    const opponents = opponentCharacters(player.id)
      .map((id, index) => createRival({ ...RIVAL_PROFILES[id], startX: startPositions[index] }));

    expect(opponents).toHaveLength(3);
    expect(opponents.map(opponent => opponent.id)).not.toContain("cactus");
    expect(opponents.map(opponent => opponent.id)).not.toContain(player.id);
    expect(new Set(opponents.map(opponent => opponent.id)).size).toBe(3);
  });
});
