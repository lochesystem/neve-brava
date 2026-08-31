import { describe, expect, it } from "vitest";
import { COINS, COURSE_LENGTH, ITEM_BOXES, LIFT_TRANSITION_TIME, OBSTACLES, RACE_LAPS, RAMPS, courseHeight, courseSlope, rampHeight, rampLength } from "../src/core/course.ts";
import { applyRiderFreeze, applyRiderTimeWarp, applyRiderWindHit, EMPTY_INTENT, createRider, interpolateRider, updateRider } from "../src/core/simulation.ts";

describe("simulação da prancha", () => {
  it("escudo anula ataque da IA e congelamento realmente segura o jogador", () => {
    const shielded = createRider();
    shielded.shieldTime = 4;
    expect(applyRiderWindHit(shielded)).toContainEqual({ type: "SHIELD_BREAK" });
    expect(shielded.recovering).toBe(0);

    const frozen = createRider();
    frozen.s = 50;
    applyRiderFreeze(frozen);
    for (let index = 0; index < 60; index += 1) updateRider(frozen, { ...EMPTY_INTENT, tuck: 1 }, 1 / 60);
    expect(frozen.s).toBe(50);
    expect(frozen.freezeTime).toBeGreaterThan(.9);
  });

  it("especial temporal da Giru mantém o jogador lento por cinco segundos", () => {
    const rider = createRider();
    rider.speed = 45;
    applyRiderTimeWarp(rider);
    for (let index = 0; index < 60; index += 1) updateRider(rider, { ...EMPTY_INTENT, tuck: 1 }, 1 / 60);
    expect(rider.timeWarpTime).toBeGreaterThan(3.9);
    expect(rider.speed).toBeLessThan(13);
  });
  it("acelera com tuck sem ultrapassar o limite", () => {
    const rider = createRider();
    for (let index = 0; index < 1_200; index += 1) updateRider(rider, { ...EMPTY_INTENT, tuck: 1 }, 1 / 60);
    expect(rider.speed).toBeCloseTo(45);
  });

  it("carving muda a linha lateral de forma contínua", () => {
    const rider = createRider();
    for (let index = 0; index < 90; index += 1) updateRider(rider, { ...EMPTY_INTENT, steer: 0.7 }, 1 / 60);
    expect(rider.x).toBeGreaterThan(4);
    expect(rider.x).toBeLessThan(20);
    expect(rider.lateralSpeed).toBeGreaterThan(0);
  });

  it("ollie sai do chão e retorna por pouso", () => {
    const rider = createRider();
    for (let index = 0; index < 24; index += 1) updateRider(rider, { ...EMPTY_INTENT, jumpHeld: true }, 1 / 60);
    updateRider(rider, { ...EMPTY_INTENT, jumpReleased: true }, 1 / 60);
    expect(rider.grounded).toBe(false);
    let landed = false;
    for (let index = 0; index < 240; index += 1) {
      const events = updateRider(rider, { ...EMPTY_INTENT, recoverHeld: true }, 1 / 60);
      if (events.some(event => event.type === "LAND")) { landed = true; break; }
    }
    expect(landed).toBe(true);
    expect(rider.grounded).toBe(true);
  });

  it("normaliza um giro completo ao pousar sem desenrolar para o outro lado", () => {
    const rider = createRider();
    rider.s = 60;
    rider.grounded = false;
    rider.y = courseHeight(rider.s) + 0.48;
    rider.verticalSpeed = -4;
    rider.spin = Math.PI * 2 + 0.08;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events.some(event => event.type === "LAND")).toBe(true);
    expect(rider.grounded).toBe(true);
    expect(rider.heading).toBeCloseTo(0.08, 2);
    expect(Math.abs(rider.heading)).toBeLessThan(0.2);
    expect(events.some(event => event.type === "LAND" && event.boost > 0)).toBe(true);
    expect(rider.turboTime).toBeGreaterThan(0);
  });

  it("entrega nitro após manobra válida mesmo em pouso imperfeito sem queda", () => {
    const rider = createRider();
    rider.s = 64;
    rider.grounded = false;
    rider.y = courseHeight(rider.s) + 0.48;
    rider.verticalSpeed = -4;
    rider.spin = Math.PI * 2 + 0.5;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    const landing = events.find(event => event.type === "LAND");
    expect(landing?.type === "LAND" && landing.grade).toBe("sketchy");
    expect(landing?.type === "LAND" && landing.boost).toBeGreaterThan(.9);
    expect(rider.turboTime).toBeGreaterThan(.9);
    expect(events.some(event => event.type === "CRASH")).toBe(false);
  });

  it("transforma pouso perdido em capotamento com impulso residual", () => {
    const rider = createRider();
    rider.s = 70;
    rider.grounded = false;
    rider.y = courseHeight(rider.s) + 0.48;
    rider.verticalSpeed = -5;
    rider.spin = Math.PI;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events.some(event => event.type === "CRASH")).toBe(true);
    expect(events.some(event => event.type === "LAND" && event.grade === "crash")).toBe(true);
    expect(rider.recovering).toBeGreaterThan(0);
    expect(rider.grounded).toBe(false);
    updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(rider.tumbleTime).toBeGreaterThan(0);
  });

  it("sobe pela superfície da rampa, decola no lip e pousa sem queda automática", () => {
    const results: Array<{ ramp: string; grade: string; impact: number }> = [];
    for (const ramp of RAMPS) {
      const rider = createRider();
      rider.s = ramp.s - rampLength(ramp) - 1;
      rider.x = ramp.x;
      rider.y = courseHeight(rider.s) + 0.46;
      rider.speed = 32;
      let climbed = false;
      let tookOff = false;
      let landingGrade = "";
      let measuredImpact = 0;
      for (let index = 0; index < 420; index += 1) {
        const verticalSpeedBeforeStep = rider.verticalSpeed;
        const surfaceSpeedBeforeStep = courseSlope(rider.s) * rider.speed;
        const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
        const clearance = rider.y - courseHeight(rider.s) - 0.46;
        if (rider.grounded && clearance > rampHeight(ramp) * 0.45) climbed = true;
        if (events.some(event => event.type === "TAKEOFF" && event.ramp)) {
          tookOff = true;
          expect(clearance).toBeGreaterThan(rampHeight(ramp) * 0.8);
        }
        const landing = events.find(event => event.type === "LAND");
        if (landing?.type === "LAND") {
          landingGrade = landing.grade;
          measuredImpact = surfaceSpeedBeforeStep - verticalSpeedBeforeStep;
          break;
        }
      }
      expect(climbed).toBe(true);
      expect(tookOff).toBe(true);
      results.push({ ramp: ramp.id, grade: landingGrade, impact: Number(measuredImpact.toFixed(2)) });
    }
    expect(results.map(({ ramp, grade }) => ({ ramp, grade })))
      .toEqual(RAMPS.map(ramp => ({ ramp: ramp.id, grade: "clean" })));
    expect(Math.max(...results.map(result => result.impact))).toBeLessThan(21);
  });

  it("impacto frontal dispara uma única queda e recupera em posição segura", () => {
    const rider = createRider();
    rider.s = 112;
    rider.x = -7;
    rider.y = courseHeight(rider.s) + 0.46;
    rider.speed = 26;
    let crashes = 0;
    for (let index = 0; index < 20; index += 1) {
      crashes += updateRider(rider, EMPTY_INTENT, 1 / 60).filter(event => event.type === "CRASH").length;
    }
    expect(crashes).toBe(1);
    expect(rider.recovering).toBeGreaterThan(0);
    expect(rider.tumbleTime).toBeGreaterThan(0.2);
    expect(rider.grounded).toBe(false);
    expect(rider.s).toBeGreaterThan(112);
    for (let index = 0; index < 70; index += 1) {
      updateRider(rider, EMPTY_INTENT, 1 / 60);
      expect(rider.y).toBeGreaterThanOrEqual(courseHeight(rider.s) + 0.46 - 0.0001);
    }
    expect(rider.grounded).toBe(true);
    expect(rider.tumbleTime).toBe(0);
    expect(rider.invulnerable).toBeGreaterThan(0);
    expect(rider.y).toBeCloseTo(courseHeight(rider.s) + 0.46);
  });

  it("mantém resultado próximo com apresentação a 60 e 120 Hz", () => {
    const sixty = createRider();
    for (let index = 0; index < 600; index += 1) updateRider(sixty, { ...EMPTY_INTENT, tuck: 0.6, steer: 0.2 }, 1 / 60);
    const oneTwenty = createRider();
    let accumulator = 0;
    for (let index = 0; index < 1_200; index += 1) {
      accumulator += 1 / 120;
      while (accumulator >= 1 / 60) {
        updateRider(oneTwenty, { ...EMPTY_INTENT, tuck: 0.6, steer: 0.2 }, 1 / 60);
        accumulator -= 1 / 60;
      }
    }
    expect(oneTwenty.s).toBeCloseTo(sixty.s, 5);
    expect(oneTwenty.x).toBeCloseTo(sixty.x, 5);
  });

  it("interpola posição e rotação sem repetir saltos visuais", () => {
    const previous = createRider();
    const current = { ...previous, s: 12, x: 4, y: previous.y - 1, heading: -Math.PI + 0.1 };
    previous.heading = Math.PI - 0.1;
    const halfway = interpolateRider(previous, current, 0.5);
    expect(halfway.s).toBe(6);
    expect(halfway.x).toBe(2);
    expect(Math.abs(Math.abs(halfway.heading) - Math.PI)).toBeLessThan(0.02);
  });

  it("coleta moedas de 100 créditos", () => {
    const coin = COINS[0];
    const rider = createRider();
    rider.s = coin.s - .2; rider.x = coin.x; rider.y = courseHeight(rider.s) + .46; rider.speed = 30;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events).toContainEqual({ type: "COIN", value: 100, id: coin.id });
    expect(rider.credits).toBe(100);
    expect(rider.collectedCoins).toContain(coin.id);
  });

  it("coleta uma caixa sem gastar os créditos acumulados", () => {
    const box = ITEM_BOXES[0];
    const rider = createRider();
    rider.credits = 200;
    rider.s = box.s - .2; rider.x = box.x; rider.y = courseHeight(rider.s) + .46; rider.speed = 30;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events).toContainEqual({ type: "ITEM_ACQUIRED", item: box.item });
    expect(rider.credits).toBe(200);
    expect(rider.item).toBe(box.item);
    expect(rider.recovering).toBe(0);
  });

  it("coleta a caixa mesmo sem possuir créditos", () => {
    const box = ITEM_BOXES[0];
    const rider = createRider();
    rider.credits = 100;
    rider.s = box.s - .2; rider.x = box.x; rider.y = courseHeight(rider.s) + .46; rider.speed = 30;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events).toContainEqual({ type: "ITEM_ACQUIRED", item: box.item });
    expect(events.some(event => event.type === "CRASH")).toBe(false);
    expect(rider.recovering).toBe(0);
    expect(rider.credits).toBe(100);
    expect(rider.collectedBoxes).toContain(box.id);
  });

  it("oferece a Nevasca em 40% das caixas somente para o último colocado", () => {
    const box = ITEM_BOXES[0];
    const last = createRider();
    last.s = box.s - .2; last.x = box.x; last.y = courseHeight(last.s) + .46; last.speed = 30;
    const luckyEvents = updateRider(last, EMPTY_INTENT, 1 / 60, 4, () => .39);
    expect(luckyEvents).toContainEqual({ type: "ITEM_ACQUIRED", item: "blizzard" });
    expect(last.item).toBe("blizzard");

    const unlucky = createRider();
    unlucky.s = box.s - .2; unlucky.x = box.x; unlucky.y = courseHeight(unlucky.s) + .46; unlucky.speed = 30;
    updateRider(unlucky, EMPTY_INTENT, 1 / 60, 4, () => .4);
    expect(unlucky.item).toBe(box.item);

    const notLast = createRider();
    notLast.s = box.s - .2; notLast.x = box.x; notLast.y = courseHeight(notLast.s) + .46; notLast.speed = 30;
    updateRider(notLast, EMPTY_INTENT, 1 / 60, 3, () => 0);
    expect(notLast.item).toBe(box.item);
  });

  it("consome a Nevasca ao usar o item", () => {
    const rider = createRider();
    rider.item = "blizzard";
    const events = updateRider(rider, { ...EMPTY_INTENT, itemPressed: true }, 1 / 60);
    expect(events).toContainEqual({ type: "ITEM_USED", item: "blizzard" });
    expect(rider.item).toBeNull();
  });

  it("ativa turbo e usa o escudo para absorver um obstáculo comum", () => {
    const turboRider = createRider();
    turboRider.item = "turbo";
    updateRider(turboRider, { ...EMPTY_INTENT, itemPressed: true }, 1 / 60);
    expect(turboRider.item).toBeNull();
    expect(turboRider.turboTime).toBeGreaterThan(2.5);
    for (let index = 0; index < 120; index += 1) updateRider(turboRider, { ...EMPTY_INTENT, tuck: 1 }, 1 / 60);
    expect(turboRider.speed).toBeGreaterThan(45);

    const obstacle = OBSTACLES.find(item => !item.decorative)!;
    const shieldRider = createRider();
    shieldRider.item = "shield";
    updateRider(shieldRider, { ...EMPTY_INTENT, itemPressed: true }, 1 / 60);
    shieldRider.s = obstacle.s - .2; shieldRider.x = obstacle.x; shieldRider.y = courseHeight(shieldRider.s) + .46; shieldRider.speed = 30;
    const events = updateRider(shieldRider, EMPTY_INTENT, 1 / 60);
    expect(events.some(event => event.type === "SHIELD_BREAK")).toBe(true);
    expect(events.some(event => event.type === "CRASH")).toBe(false);
    expect(shieldRider.shieldTime).toBe(0);
  });

  it("permite ao especial do Guy atingir aproximadamente o dobro da velocidade normal", () => {
    const rider = createRider();
    rider.speed = 45;
    rider.specialTurboTime = 3;
    for (let index = 0; index < 90; index += 1) updateRider(rider, { ...EMPTY_INTENT, tuck: 1 }, 1 / 60);
    expect(rider.speed).toBeGreaterThan(82);
    expect(rider.specialTurboTime).toBeGreaterThan(1.4);
  });

  it("entra automaticamente no teleférico e começa a volta seguinte no topo", () => {
    const rider = createRider();
    rider.credits = 500;
    rider.item = "shield";
    rider.collectedCoins = [COINS[0].id];
    rider.collectedBoxes = [ITEM_BOXES[0].id];
    rider.s = COURSE_LENGTH - .1;
    rider.speed = 30;
    const entryEvents = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(entryEvents).toContainEqual({ type: "LIFT", nextLap: 2 });
    expect(rider.liftTime).toBeGreaterThan(0);
    expect(rider.finished).toBe(false);

    let lapEvents = 0;
    for (let index = 0; index < Math.ceil(LIFT_TRANSITION_TIME * 60) + 2; index += 1) {
      lapEvents += updateRider(rider, EMPTY_INTENT, 1 / 60).filter(event => event.type === "LAP").length;
      if (rider.lap === 2) break;
    }
    expect(lapEvents).toBe(1);
    expect(rider.lap).toBe(2);
    expect(rider.s).toBe(0);
    expect(rider.x).toBe(0);
    expect(rider.credits).toBe(500);
    expect(rider.item).toBe("shield");
    expect(rider.collectedCoins).toEqual([]);
    expect(rider.collectedBoxes).toEqual([]);
  });

  it("encerra a corrida somente ao concluir a última volta", () => {
    const rider = createRider();
    rider.lap = RACE_LAPS;
    rider.s = COURSE_LENGTH - .1;
    rider.speed = 30;
    const events = updateRider(rider, EMPTY_INTENT, 1 / 60);
    expect(events).toContainEqual({ type: "FINISH" });
    expect(rider.finished).toBe(true);
    expect(rider.liftTime).toBe(0);
  });
});
