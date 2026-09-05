import { describe, expect, it } from "vitest";
import { RoomManager } from "../server/RoomManager.ts";

describe("salas multiplayer", () => {
  it("cria uma sala privada com código curto e anfitrião", () => {
    const rooms = new RoomManager();
    const room = rooms.create("host", { name: "Ana", character: "giru" }, "private");

    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.status).toBe("waiting");
    expect(room.players).toEqual([
      expect.objectContaining({ id: "host", name: "Ana", character: "giru", host: true }),
    ]);
  });

  it("impede personagens repetidos e respeita o limite de quatro jogadores", () => {
    const rooms = new RoomManager();
    const created = rooms.create("p1", { name: "Um", character: "snowman" }, "private");
    const joined = rooms.join(created.code, "p2", { name: "Dois", character: "snowman" });

    expect(joined.players[1].character).not.toBe("snowman");
    rooms.join(created.code, "p3", { name: "Três", character: "yeti" });
    rooms.join(created.code, "p4", { name: "Quatro", character: "giru" });
    expect(() => rooms.join(created.code, "p5", { name: "Cinco", character: "guy" })).toThrow("cheia");
  });

  it("reserva a escolha da pista e o início ao anfitrião", () => {
    const rooms = new RoomManager();
    const created = rooms.create("host", { name: "Host", character: "guy" }, "private");
    rooms.join(created.code, "guest", { name: "Guest", character: "yeti" });

    expect(() => rooms.setCourse("guest", "bosque-torto")).toThrow("anfitrião");
    expect(() => rooms.start("guest")).toThrow("anfitrião");
    rooms.setCourse("host", "bosque-torto");
    rooms.setReady("host", true);
    rooms.setReady("guest", true);

    const start = rooms.start("host");
    expect(start.room.courseId).toBe("bosque-torto");
    expect(start.room.status).toBe("countdown");
    expect(start.startsAt).toBeGreaterThan(Date.now());
    expect(start.bots).toEqual([
      { actorId: "bot:snowman", character: "snowman", startX: 2.5 },
      { actorId: "bot:giru", character: "giru", startX: 7.4 },
    ]);
  });

  it("coloca duas buscas rápidas na mesma sala", () => {
    const rooms = new RoomManager();
    const first = rooms.quickMatch("p1", { name: "Um", character: "guy" });
    const second = rooms.quickMatch("p2", { name: "Dois", character: "giru" });

    expect(second.code).toBe(first.code);
    expect(second.mode).toBe("quick");
    expect(second.players).toHaveLength(2);
  });

  it("promove outro anfitrião quando o primeiro sai do lobby", () => {
    const rooms = new RoomManager();
    const created = rooms.create("host", { name: "Host", character: "guy" }, "private");
    rooms.join(created.code, "guest", { name: "Guest", character: "giru" });

    const room = rooms.leave("host");
    expect(room?.players).toEqual([expect.objectContaining({ id: "guest", host: true })]);
  });

  it("preserva a vaga durante uma queda curta e bloqueia a largada até reconectar", () => {
    const rooms = new RoomManager();
    const created = rooms.create("host-session", { name: "Host", character: "snowman" }, "private");
    rooms.join(created.code, "guest-session", { name: "Guest", character: "guy" });
    rooms.setReady("host-session", true);
    rooms.setReady("guest-session", true);

    const disconnected = rooms.setConnected("guest-session", false);
    expect(disconnected?.players.find(player => player.id === "guest-session")?.connected).toBe(false);
    expect(() => rooms.start("host-session")).toThrow("conectados");

    const restored = rooms.setConnected("guest-session", true);
    expect(restored?.players.find(player => player.id === "guest-session")?.ready).toBe(true);
    expect(rooms.start("host-session").room.status).toBe("countdown");
  });

  it("transfere o anfitrião se ele abandonar uma corrida", () => {
    const rooms = new RoomManager();
    const created = rooms.create("host", { name: "Host", character: "snowman" }, "private");
    rooms.join(created.code, "guest", { name: "Guest", character: "guy" });
    rooms.setReady("host", true);
    rooms.setReady("guest", true);
    rooms.start("host");
    rooms.markRacing(created.code);

    const room = rooms.leave("host");
    expect(room?.players.find(player => player.id === "host")?.host).toBe(false);
    expect(room?.players.find(player => player.id === "guest")?.host).toBe(true);
    expect(room?.status).toBe("racing");
  });
});
