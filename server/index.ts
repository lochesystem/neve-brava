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
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const activeConnections = new Map<string, string>();
const RECONNECT_GRACE_MS = 20_000;

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
  connectionStateRecovery: { maxDisconnectionDuration: RECONNECT_GRACE_MS, skipMiddlewares: true },
});

function playerIdFor(socket: Socket): string {
  const sessionId = socket.handshake.auth.sessionId;
  return typeof sessionId === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(sessionId) ? sessionId : socket.id;
}

function replyError(callback: ((result: unknown) => void) | undefined, error: unknown): void {
  callback?.({ success: false, error: error instanceof Error ? error.message : "Não foi possível concluir a operação." });
}

function emitRoom(code: string): void {
  const room = roomManager.room(code);
  if (room) io.to(code).emit("room-update", room);
}

function launchRace(start: RaceStart): void {
  botRaces.start(start);
  io.to(start.room.code).emit("race-start", start);
  setTimeout(() => roomManager.markRacing(start.room.code), Math.max(0, start.startsAt - Date.now()));
}

io.on("connection", (socket: Socket) => {
  const playerId = playerIdFor(socket);
  const reconnectTimer = reconnectTimers.get(playerId);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimers.delete(playerId);
  const previousSocketId = activeConnections.get(playerId);
  activeConnections.set(playerId, socket.id);
  if (previousSocketId && previousSocketId !== socket.id) io.sockets.sockets.get(previousSocketId)?.disconnect(true);
  const restoredRoom = roomManager.setConnected(playerId, true);
  if (restoredRoom) {
    socket.join(restoredRoom.code);
    socket.emit("room-update", restoredRoom);
    emitRoom(restoredRoom.code);
  }

  socket.on("create-room", (profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.create(playerId, profile, "private");
      socket.join(room.code);
      callback?.({ success: true, room, playerId });
    } catch (error) { replyError(callback, error); }
  });

  socket.on("quick-match", (profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.quickMatch(playerId, profile);
      socket.join(room.code);
      callback?.({ success: true, room, playerId });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("join-room", (rawCode: string, profile: PlayerProfile, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.join(rawCode, playerId, profile);
      socket.join(room.code);
      callback?.({ success: true, room, playerId });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("update-player", (profile: Partial<PlayerProfile>, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.updatePlayer(playerId, profile);
      callback?.({ success: true, room });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("set-course", (courseId: string, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.setCourse(playerId, courseId);
      callback?.({ success: true, room });
      emitRoom(room.code);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("set-ready", (ready: boolean, callback?: (result: unknown) => void) => {
    try {
      const room = roomManager.setReady(playerId, Boolean(ready));
      callback?.({ success: true, room });
      emitRoom(room.code);
      if (room.mode === "quick" && room.players.length >= 2 && room.players.every(player => player.ready && player.connected)) {
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
      const start = roomManager.start(playerId);
      callback?.({ success: true });
      launchRace(start);
    } catch (error) { replyError(callback, error); }
  });

  socket.on("racer-state", (packet: Omit<RacerStatePacket, "playerId">) => {
    const room = roomManager.roomFor(playerId);
    if (!room || (room.status !== "countdown" && room.status !== "racing")) return;
    botRaces.updateHuman(room.code, playerId, packet.state);
    socket.to(room.code).volatile.emit("racer-state", { ...packet, playerId } satisfies RacerStatePacket);
  });

  socket.on("race-action", (action: Omit<MultiplayerAction, "actorId">) => {
    const room = roomManager.roomFor(playerId);
    if (!room || room.status !== "racing") return;
    botRaces.handleHumanAction(room.code, playerId, action);
    socket.to(room.code).emit("race-action", { ...action, actorId: playerId } satisfies MultiplayerAction);
  });

  socket.on("race-finish", (finishTime: number) => {
    try {
      const room = roomManager.finish(playerId, finishTime);
      io.to(room.code).emit("room-update", room);
      if (room.status === "finished") botRaces.stop(room.code);
    } catch { /* pacote tardio depois de sair da sala */ }
  });

  socket.on("leave-room", () => {
    const code = roomManager.codeFor(playerId);
    const room = roomManager.leave(playerId);
    if (code) socket.leave(code);
    if (room) emitRoom(room.code);
    if (room?.status === "finished") botRaces.stop(room.code);
  });

  socket.on("disconnect", () => {
    if (activeConnections.get(playerId) !== socket.id) return;
    activeConnections.delete(playerId);
    const disconnectedRoom = roomManager.setConnected(playerId, false);
    if (!disconnectedRoom) return;
    emitRoom(disconnectedRoom.code);
    const timer = setTimeout(() => {
      reconnectTimers.delete(playerId);
      if (activeConnections.has(playerId)) return;
      const room = roomManager.leave(playerId);
      if (room) emitRoom(room.code);
      if (room?.status === "finished") botRaces.stop(room.code);
    }, RECONNECT_GRACE_MS);
    timer.unref();
    reconnectTimers.set(playerId, timer);
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
