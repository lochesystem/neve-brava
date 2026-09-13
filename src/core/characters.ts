export type CharacterId = "snowman" | "yeti" | "guy" | "giru" | "cactus";

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  nickname: string;
  color: string;
};

export const CHARACTERS: CharacterDefinition[] = [
  { id: "snowman", name: "Nevinho", nickname: "O clássico da montanha", color: "#ff725e" },
  { id: "yeti", name: "Yeti", nickname: "Força bruta na neve", color: "#a58bdd" },
  { id: "guy", name: "Guy", nickname: "Linha rápida e precisa", color: "#57c8ad" },
  { id: "giru", name: "Giru", nickname: "Rainha da nevasca", color: "#8051b8" },
  { id: "cactus", name: "Cacto", nickname: "O veterano do cânion", color: "#8aab42" },
];

export function characterById(id: CharacterId): CharacterDefinition {
  return CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0];
}

/** Keep four racers and never reveal the secret rider as a bot. */
export function opponentCharacters(player: CharacterId): CharacterId[] {
  return CHARACTERS.filter(character => character.id !== player && character.id !== "cactus").slice(0, 3).map(character => character.id);
}
