import { describe, expect, it } from "vitest";
import { BotRaceManager } from "../server/BotRace.ts";
import type { BotStatePacket, MultiplayerAction, RaceStart } from "../shared/multiplayer.ts";

function raceStart(): RaceStart {
  return {
    startsAt: 10_000,
    seed: 42,
    room: {
      code: "TEST",
      mode: "private",
      status: "countdown",
      courseId: "vale-bravo",
      players: [
        { id: "p1", name: "UM", character: "snowman", ready: true, host: true, connected: true, finishTime: null },
        { id: "p2", name: "DOIS", character: "guy", ready: true, host: false, connected: true, finishTime: null },
      ],
    },
    bots: [
      { actorId: "bot:yeti", character: "yeti", startX: 2.5 },
      { actorId: "bot:giru", character: "giru", startX: 7.4 },
    ],
  };
}

function simulate(manager: BotRaceManager): BotStatePacket[] {
  const packets: BotStatePacket[] = [];
  const actions: MultiplayerAction[] = [];
  manager.start(raceStart());
  for (let frame = 0; frame <= 300; frame += 1) {
    manager.tick(10_000 + frame * (1_000 / 30), (_code, packet) => packets.push(packet), (_code, action) => actions.push(action));
  }
  return packets;
}

describe("corrida autoritativa dos bots", () => {
  it("simula e transmite os bots pelo servidor", () => {
    const packets = simulate(new BotRaceManager());
    const last = packets.at(-1)!;

    expect(packets.length).toBeGreaterThanOrEqual(145);
    expect(last.bots.map(bot => bot.actorId)).toEqual(["bot:yeti", "bot:giru"]);
    expect(last.bots.every(bot => bot.state.s > 100)).toBe(true);
  });

  it("produz a mesma corrida para a mesma semente", () => {
    const first = simulate(new BotRaceManager()).at(-1);
    const second = simulate(new BotRaceManager()).at(-1);

    expect(second).toEqual(first);
  });

  it("aplica ações humanas ao estado canônico dos bots", () => {
    const manager = new BotRaceManager();
    const packets: BotStatePacket[] = [];
    manager.start(raceStart());
    manager.handleHumanAction("TEST", "p1", { id: "blizzard", type: "blizzard" });
    manager.tick(10_100, (_code, packet) => packets.push(packet), () => undefined);

    expect(packets[0].bots.every(bot => bot.state.slowTime > 0)).toBe(true);
  });
});
