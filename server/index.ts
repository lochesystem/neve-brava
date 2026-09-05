import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { RoomManager } from "./RoomManager.js";
import { BotRaceManager } from "./BotRace.js";
import type {
  MultiplayerAction,
  PlayerProfile,
  RaceStart,
  RacerStatePacket,
} from "../shared/multiplayer.js";

const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = (process.env.CLIENT_URL ?? "http://127.0.0.1:5173,http://localhost:5173,https://lochesystem.github.io")
  .split(",").map(value => value.trim()).filter(Boolean);
const roomManager = new RoomManager();
const botRaces = new BotRaceManager();

const httpServer = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    response.end(JSON.stringify({ status: "ok", rooms: roomManager.count(), races: botRaces.count() }));
    return;
  }
  response.writeHead(404).end();
});

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

function replyError(callback: ((result: unknown) => void) | undefined, error: unknown): void {
  callback?.({ success: false, error: error instanceof Error ? error.message : "Não foi possível concluir a operação." });
}

function emitRoom(code: string): void {
  const sockets = io.sockets.adapter.rooms.get(code);
  const firstSocket = sockets?.values().next().value as string | undefined;
  const room = firstSocket ? roomManager.roomFor(firstSocket) : null;
  if (room) io.to(code).emit("room-update", room);
}

function launchRace(start: RaceStart): void {
  botRaces.start(start);
  io.to(start.room.code).emit("race-start", start);
  setTimeout(() => roomManager.markRacing(start.room.code), Math.max(0, start.startsAt - Date.now()));
}

io.on("connection", (socket: Socket) => {
  socket.on("create-room", (profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.create(socket.id, profile, "private");
      socket.join(room.code);
      callback?.({ success: true, room, playerId: socket.id });
    } catch (error) { replyError(callback, error); }
  });

  socket.on("quick-match", (profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.quickMatch(socket.id, profile);
      socket.join(room.code);
      callback?.({ success: true, room, playerId: socket.id });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("join-room", (rawCode: string, profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.join(rawCode, socket.id, profile);
      socket.join(room.code);
      callback?.({ success: true, room, playerId: socket.id });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("update-player", (profile: Partial<PlayerProfile>, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.updatePlayer(socket.id, profile);
      callback?.({ success: true, room });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("set-course", (courseId: string, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.setCourse(socket.id, courseId);
      callback?.({ success: true, room });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("set-ready", (ready: boolean, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.setReady(socket.id, Boolean(ready));
      callback?.({ success: true, room });
      emitRoom(room.code);
      if (room.mode === "quick" && room.players.length >= 2 && room.players.every(player => player.ready)) {
        const host = room.players.find(player => player.host);
        if (host) {
          const start = roomManager.start(host.id);
          launchRace(start);
        }
      }
    } catch (error) { replyError(callback, error); }
  });

  socket.on("start-race", (callback?: (result: unknown) => void) => {
    try {
      const start = roomManager.start(socket.id);
      callback?.({ success: true });
      launchRace(start);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("racer-state", (packet: Omit<RacerStatePacket, "playerId">) => {
    const room = roomManager.roomFor(socket.id);
    if (!room || (room.status !== "countdown" && room.status !== "racing")) return;
    botRaces.updateHuman(room.code, socket.id, packet.state);
    socket.to(room.code).volatile.emit("racer-state", { ...packet, playerId: socket.id } satisfies RacerStatePacket);
  });

  socket.on("race-action", (action: Omit<MultiplayerAction, "actorId">) => {
    const room = roomManager.roomFor(socket.id);
    if (!room || room.status !== "racing") return;
    botRaces.handleHumanAction(room.code, socket.id, action);
    socket.to(room.code).emit("race-action", { ...action, actorId: socket.id } satisfies MultiplayerAction);
  });

  socket.on("race-finish", (finishTime: number) => {
    try {
      const room = roomManager.finish(socket.id, finishTime);
      io.to(room.code).emit("room-update", room);
      if (room.status === "finished") botRaces.stop(room.code);
    } catch { /* pacote tardio depois de sair da sala */ }
  });

  socket.on("leave-room", () => {
    const code = roomManager.codeFor(socket.id);
    const room = roomManager.leave(socket.id);
    if (code) socket.leave(code);
    if (room) emitRoom(room.code);
    if (room?.status === "finished") botRaces.stop(room.code);
  });

  socket.on("disconnect", () => {
    const room = roomManager.leave(socket.id);
    if (room) emitRoom(room.code);
    if (room?.status === "finished") botRaces.stop(room.code);
  });
});

setInterval(() => botRaces.tick(
  Date.now(),
  (code, packet) => io.to(code).volatile.emit("bot-state", packet),
  (code, action) => io.to(code).emit("race-action", action),
), 1_000 / 30).unref();

setInterval(() => roomManager.cleanup(), 60_000).unref();

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Snow Rush multiplayer disponível na porta ${port}`);
});
