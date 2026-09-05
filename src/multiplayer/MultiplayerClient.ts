import { io, type Socket } from "socket.io-client";
import type {
  BotStatePacket,
  MultiplayerAction,
  MultiplayerCharacterId,
  MultiplayerCourseId,
  MultiplayerRoom,
  NetworkRacerState,
  PlayerProfile,
  RaceStart,
  RacerStatePacket,
} from "../../shared/multiplayer.ts";

type OperationResult = { success: boolean; error?: string; room?: MultiplayerRoom; playerId?: string };

export class MultiplayerClient extends EventTarget {
  private socket: Socket | null = null;
  room: MultiplayerRoom | null = null;
  playerId: string | null = null;
  connected = false;

  get serverUrl(): string {
    if (import.meta.env.VITE_MULTIPLAYER_URL) return import.meta.env.VITE_MULTIPLAYER_URL;
    return location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://127.0.0.1:3001"
      : "https://neve-brava-multiplayer.onrender.com";
  }

  connect(): void {
    if (this.socket) return;
    this.socket = io(this.serverUrl, { autoConnect: false, timeout: 7_000, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => {
      this.connected = true;
      this.playerId = this.socket?.id ?? null;
      this.emit("connection");
    });
    this.socket.on("disconnect", () => {
      this.connected = false;
      this.emit("connection");
    });
    this.socket.on("connect_error", () => {
      this.connected = false;
      this.emit("connection");
    });
    this.socket.on("room-update", (room: MultiplayerRoom) => {
      this.room = room;
      this.emit("room", room);
    });
    this.socket.on("race-start", (start: RaceStart) => {
      this.room = start.room;
      this.emit("race-start", start);
    });
    this.socket.on("racer-state", (packet: RacerStatePacket) => this.emit("racer-state", packet));
    this.socket.on("bot-state", (packet: BotStatePacket) => this.emit("bot-state", packet));
    this.socket.on("race-action", (action: MultiplayerAction) => this.emit("race-action", action));
    this.socket.connect();
  }

  async createRoom(profile: PlayerProfile): Promise<MultiplayerRoom> {
    return this.operation("create-room", profile);
  }

  async quickMatch(profile: PlayerProfile): Promise<MultiplayerRoom> {
    return this.operation("quick-match", profile);
  }

  async joinRoom(code: string, profile: PlayerProfile): Promise<MultiplayerRoom> {
    return this.operation("join-room", code.trim().toUpperCase(), profile);
  }

  async updatePlayer(character: MultiplayerCharacterId, name: string): Promise<MultiplayerRoom> {
    return this.operation("update-player", { character, name });
  }

  async setCourse(courseId: MultiplayerCourseId): Promise<MultiplayerRoom> {
    return this.operation("set-course", courseId);
  }

  async setReady(ready: boolean): Promise<MultiplayerRoom> {
    return this.operation("set-ready", ready);
  }

  async startRace(): Promise<void> {
    await this.operation("start-race");
  }

  sendState(sequence: number, state: NetworkRacerState): void {
    this.socket?.volatile.emit("racer-state", { sequence, state });
  }

  sendAction(action: Omit<MultiplayerAction, "actorId">): void {
    this.socket?.emit("race-action", action);
  }

  sendFinish(finishTime: number): void {
    this.socket?.emit("race-finish", finishTime);
  }

  leave(): void {
    this.socket?.emit("leave-room");
    this.room = null;
    this.emit("room", null);
  }

  private operation(event: string, ...args: unknown[]): Promise<MultiplayerRoom> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Servidor multiplayer indisponível."));
        return;
      }
      const timeout = window.setTimeout(() => reject(new Error("O servidor demorou para responder.")), 8_000);
      this.socket.emit(event, ...args, (result: OperationResult) => {
        window.clearTimeout(timeout);
        if (!result.success) {
          reject(new Error(result.error || "Não foi possível concluir a operação."));
          return;
        }
        if (result.playerId) this.playerId = result.playerId;
        if (result.room) {
          this.room = result.room;
          this.emit("room", result.room);
          resolve(result.room);
        } else resolve(this.room as MultiplayerRoom);
      });
    });
  }

  private emit<T>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}
