export type CharacterId = "snowman" | "yeti" | "guy" | "giru";

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
];

export function characterById(id: CharacterId): CharacterDefinition {
  return CHARACTERS.find(character => character.id === id) ?? CHARACTERS[0];
}
