import {
  MULTIPLAYER_CHARACTERS,
  MULTIPLAYER_COURSES,
  MULTIPLAYER_START_X,
  type MultiplayerCharacterId,
  type MultiplayerCourseId,
  type MultiplayerPlayer,
  type MultiplayerRoom,
  type PlayerProfile,
  type RoomMode,
  type RaceStart,
} from "../shared/multiplayer.js";

type InternalRoom = MultiplayerRoom & { createdAt: number; updatedAt: number; startsAt: number | null };

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL = 30 * 60_000;
const MAX_PLAYERS = 4;

function cleanName(value: string): string {
  const name = value.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16);
  return name || "PILOTO";
}

function validCharacter(value: string): value is MultiplayerCharacterId {
  return (MULTIPLAYER_CHARACTERS as readonly string[]).includes(value);
}

function validCourse(value: string): value is MultiplayerCourseId {
  return (MULTIPLAYER_COURSES as readonly string[]).includes(value);
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();
  private socketRooms = new Map<string, string>();

  create(socketId: string, profile: PlayerProfile, mode: RoomMode): MultiplayerRoom {
    this.leave(socketId);
    const code = this.generateCode();
    const room: InternalRoom = {
      code,
      mode,
      status: "waiting",
      courseId: "vale-bravo",
      players: [this.player(socketId, profile, true)],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startsAt: null,
    };
    this.rooms.set(code, room);
    this.socketRooms.set(socketId, code);
    return this.publicRoom(room);
  }

  quickMatch(socketId: string, profile: PlayerProfile): MultiplayerRoom {
    const room = [...this.rooms.values()].find(candidate => candidate.mode === "quick"
      && (candidate.status === "waiting" || candidate.status === "lobby")
      && candidate.players.length < MAX_PLAYERS);
    if (!room) return this.create(socketId, profile, "quick");
    return this.join(room.code, socketId, profile);
  }

  join(rawCode: string, socketId: string, profile: PlayerProfile): MultiplayerRoom {
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new Error("Sala não encontrada.");
    if (room.status === "countdown" || room.status === "racing" || room.status === "finished") throw new Error("A corrida desta sala já começou.");
    if (room.players.length >= MAX_PLAYERS) throw new Error("Esta sala está cheia.");
    const requestedCharacter = room.players.some(player => player.character === profile.character)
      ? MULTIPLAYER_CHARACTERS.find(character => !room.players.some(player => player.character === character)) ?? profile.character
      : profile.character;
    this.leave(socketId);
    room.players.push(this.player(socketId, { ...profile, character: requestedCharacter }, false));
    room.status = "lobby";
    room.updatedAt = Date.now();
    this.socketRooms.set(socketId, room.code);
    return this.publicRoom(room);
  }

  updatePlayer(socketId: string, profile: Partial<PlayerProfile>): MultiplayerRoom {
    const room = this.requireRoom(socketId);
    const player = this.requirePlayer(room, socketId);
    if (room.status === "countdown" || room.status === "racing" || room.status === "finished") throw new Error("A corrida já começou.");
    if (profile.character && validCharacter(profile.character)) {
      if (room.players.some(candidate => candidate.id !== socketId && candidate.character === profile.character)) {
        throw new Error("Esse piloto já foi escolhido nesta sala.");
      }
      player.character = profile.character;
    }
    if (profile.name !== undefined) player.name = cleanName(profile.name);
    player.ready = false;
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  setCourse(socketId: string, courseId: string): MultiplayerRoom {
    const room = this.requireRoom(socketId);
    const player = this.requirePlayer(room, socketId);
    if (!player.host) throw new Error("Somente o anfitrião escolhe a pista.");
    if (!validCourse(courseId)) throw new Error("Pista inválida.");
    room.courseId = courseId;
    room.players.forEach(candidate => { candidate.ready = false; });
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  setReady(socketId: string, ready: boolean): MultiplayerRoom {
    const room = this.requireRoom(socketId);
    this.requirePlayer(room, socketId).ready = ready;
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  canStart(socketId: string): InternalRoom {
    const room = this.requireRoom(socketId);
    const player = this.requirePlayer(room, socketId);
    if (!player.host) throw new Error("Somente o anfitrião pode iniciar.");
    if (room.players.length < 2) throw new Error("A sala precisa de pelo menos dois jogadores.");
    if (!room.players.every(candidate => candidate.connected)) throw new Error("Todos precisam estar conectados para iniciar.");
    if (!room.players.every(candidate => candidate.ready)) throw new Error("Todos precisam confirmar que estão prontos.");
    return room;
  }

  start(socketId: string): RaceStart {
    const room = this.canStart(socketId);
    room.status = "countdown";
    room.startsAt = Date.now() + 3_500;
    room.updatedAt = Date.now();
    const occupied = new Set(room.players.map(player => player.character));
    const bots = MULTIPLAYER_CHARACTERS
      .filter(character => !occupied.has(character))
      .map((character, index) => ({
        actorId: `bot:${character}`,
        character,
        startX: MULTIPLAYER_START_X[room.players.length + index],
      }));
    return { room: this.publicRoom(room), startsAt: room.startsAt, seed: Math.floor(Math.random() * 2 ** 31), bots };
  }

  markRacing(code: string): void {
    const room = this.rooms.get(code);
    if (room && room.status === "countdown") room.status = "racing";
  }

  finish(socketId: string, finishTime: number): MultiplayerRoom {
    const room = this.requireRoom(socketId);
    const player = this.requirePlayer(room, socketId);
    if (player.finishTime === null) player.finishTime = Math.max(0, Math.min(60 * 60, finishTime));
    if (room.players.every(candidate => candidate.finishTime !== null || !candidate.connected)) room.status = "finished";
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  roomFor(socketId: string): MultiplayerRoom | null {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) : null;
    return room ? this.publicRoom(room) : null;
  }

  room(code: string): MultiplayerRoom | null {
    const room = this.rooms.get(code);
    return room ? this.publicRoom(room) : null;
  }

  setConnected(socketId: string, connected: boolean): MultiplayerRoom | null {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) : null;
    const player = room?.players.find(candidate => candidate.id === socketId);
    if (!room || !player) return null;
    player.connected = connected;
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  codeFor(socketId: string): string | null {
    return this.socketRooms.get(socketId) ?? null;
  }

  leave(socketId: string): MultiplayerRoom | null {
    const code = this.socketRooms.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    this.socketRooms.delete(socketId);
    if (!room) return null;
    const leaving = room.players.find(player => player.id === socketId);
    if (room.status === "countdown" || room.status === "racing") {
      if (leaving) leaving.connected = false;
      if (room.players.every(player => !player.connected || player.finishTime !== null)) room.status = "finished";
    } else {
      room.players = room.players.filter(player => player.id !== socketId);
      if (!room.players.length) {
        this.rooms.delete(code);
        return null;
      }
      if (leaving?.host) room.players[0].host = true;
      room.status = room.players.length > 1 ? "lobby" : "waiting";
    }
    room.updatedAt = Date.now();
    return this.publicRoom(room);
  }

  cleanup(): void {
    const cutoff = Date.now() - ROOM_TTL;
    for (const [code, room] of this.rooms) if (room.updatedAt < cutoff) {
      room.players.forEach(player => this.socketRooms.delete(player.id));
      this.rooms.delete(code);
    }
  }

  count(): number { return this.rooms.size; }

  private requireRoom(socketId: string): InternalRoom {
    const code = this.socketRooms.get(socketId);
    const room = code ? this.rooms.get(code) : null;
    if (!room) throw new Error("Você não está em uma sala.");
    return room;
  }

  private requirePlayer(room: InternalRoom, socketId: string): MultiplayerPlayer {
    const player = room.players.find(candidate => candidate.id === socketId);
    if (!player) throw new Error("Jogador não encontrado.");
    return player;
  }

  private player(id: string, profile: PlayerProfile, host: boolean): MultiplayerPlayer {
    return {
      id,
      name: cleanName(profile.name),
      character: validCharacter(profile.character) ? profile.character : "snowman",
      ready: false,
      host,
      connected: true,
      finishTime: null,
    };
  }

  private generateCode(): string {
    let code = "";
    do code = Array.from({ length: 4 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
    while (this.rooms.has(code));
    return code;
  }

  private publicRoom(room: InternalRoom): MultiplayerRoom {
    return { code: room.code, mode: room.mode, status: room.status, courseId: room.courseId, players: room.players.map(player => ({ ...player })) };
  }
}
