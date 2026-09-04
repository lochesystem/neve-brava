export const MULTIPLAYER_CHARACTERS = ["guy", "snowman", "yeti", "giru"] as const;
export type MultiplayerCharacterId = typeof MULTIPLAYER_CHARACTERS[number];

export const MULTIPLAYER_COURSES = ["vale-bravo", "canion-cristal", "bosque-torto", "pico-tempestade"] as const;
export type MultiplayerCourseId = typeof MULTIPLAYER_COURSES[number];

export type RoomMode = "private" | "quick";
export type RoomStatus = "waiting" | "lobby" | "countdown" | "racing" | "finished";

export type MultiplayerPlayer = {
  id: string;
  name: string;
  character: MultiplayerCharacterId;
  ready: boolean;
  host: boolean;
  connected: boolean;
  finishTime: number | null;
};

export type MultiplayerRoom = {
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  courseId: MultiplayerCourseId;
  players: MultiplayerPlayer[];
};

export type PlayerProfile = {
  name: string;
  character: MultiplayerCharacterId;
};

export type RaceStart = {
  room: MultiplayerRoom;
  startsAt: number;
  seed: number;
};

export type NetworkRacerState = {
  s: number;
  x: number;
  y: number;
  speed: number;
  lateralSpeed: number;
  grounded: boolean;
  verticalSpeed: number;
  carve: number;
  heading: number;
  spin: number;
  flip: number;
  recovering: number;
  tumbleTime: number;
  tumbleDirection: number;
  lap: number;
  liftTime: number;
  finished: boolean;
  elapsed: number;
  item: "wind" | "turbo" | "shield" | "blizzard" | null;
  credits: number;
  turboTime: number;
  specialTurboTime: number;
  shieldTime: number;
  slowTime: number;
  timeWarpTime: number;
  freezeTime: number;
};

export type RacerStatePacket = {
  playerId: string;
  sequence: number;
  state: NetworkRacerState;
};

export type MultiplayerAction = {
  id: string;
  actorId: string;
  type: "special" | "wind" | "blizzard";
  targetId?: string;
};

export type ServerError = { message: string };

