import { afterEach, describe, expect, it } from "vitest";
import { CAMPAIGN_ORDER, readCampaign, recordCampaign, courseUnlocked, nextCampaignCourse, newCampaign, finishCampaignStage } from "../src/core/campaign.ts";
import { COINS, ITEM_BOXES, RAMPS, courseHeight, courseTerrainHeight, courseWallX, courseCeiling, courseAdvanceScale, courseWorldPoint, setActiveCourse } from "../src/core/course.ts";
import { createRider, EMPTY_INTENT, updateRider } from "../src/core/simulation.ts";
import { createRival, updateRival } from "../src/core/rival.ts";
import { characterUnlocked } from "../src/core/campaign.ts";
afterEach(() => setActiveCourse("vale-bravo"));
describe("campaign progression", () => {
  it("unlocks cactus only after the canyon podium and preserves the unlock on new game", () => {
    let save = newCampaign(readCampaign(null));
    expect(characterUnlocked(save,"cactus")).toBe(false);
    expect(characterUnlocked(recordCampaign(save,"canion-ferrugem",1,100),"cactus")).toBe(false);
    for (const id of CAMPAIGN_ORDER) {
      if(id === "canion-ferrugem") break;
      save = finishCampaignStage(save,"campaign",id,3,100);
    }
    expect(characterUnlocked(finishCampaignStage(save,"campaign","canion-ferrugem",4,100),"cactus")).toBe(false);
    expect(characterUnlocked(finishCampaignStage(save,"arcade","canion-ferrugem",1,100),"cactus")).toBe(false);
    save=finishCampaignStage(save,"campaign","canion-ferrugem",3,100);
    expect(characterUnlocked(save,"cactus")).toBe(true);
    save.run!.character="cactus";
    expect(readCampaign(JSON.stringify(save)).run!.character).toBe("cactus");
    expect(characterUnlocked(newCampaign(readCampaign(JSON.stringify(save))),"cactus")).toBe(true);
    expect(readCampaign(JSON.stringify({version:1,results:{},run:{stage:0,character:"cactus"}})).run!.character).toBeUndefined();
  });
  it("saves a sequential run and character; arcade and out-of-order results cannot advance it", () => {
    let save = newCampaign(readCampaign(null));
    save.run!.character = "giru";
    expect(finishCampaignStage(save, "arcade", "vale-bravo", 1, 100)).toBe(save);
    expect(finishCampaignStage(save, "campaign", "canion-cristal", 1, 100)).toBe(save);
    save = finishCampaignStage(save, "campaign", "vale-bravo", 4, 100);
    expect(save.run!.stage).toBe(0);
    save = finishCampaignStage(save, "campaign", "vale-bravo", 3, 100);
    expect(save.run).toEqual({ stage: 1, character: "giru" });
    expect(readCampaign(JSON.stringify(save))).toEqual(save);
    const restarted = newCampaign(save);
    expect(courseUnlocked(restarted, "canion-cristal")).toBe(true);
    expect(restarted.run).toEqual({ stage: 0 });
    expect(finishCampaignStage(restarted, "campaign", "vale-bravo", 4, 120).run!.stage).toBe(0);
  });
  it("migrates legacy progress, completes a run and rejects forged progress", () => {
    let save = newCampaign(readCampaign(null));
    for (const id of CAMPAIGN_ORDER) save = finishCampaignStage(save, "campaign", id, 2, 100);
    expect(save.run!.stage).toBe(CAMPAIGN_ORDER.length);
    expect(readCampaign(JSON.stringify({version: 1, results: save.results})).run!.stage).toBe(CAMPAIGN_ORDER.length);
    expect(readCampaign(JSON.stringify({version: 1, results: {}, run: {stage: 6, character: "invalid"}})).run).toEqual({stage: 0});
  });
  it("unlocks only sequential podiums and survives save round trip", () => {
    let save = readCampaign(null);
    expect(CAMPAIGN_ORDER.filter(id => courseUnlocked(save,id))).toEqual(["vale-bravo"]);
    save = recordCampaign(save,"vale-bravo",4,200);
    expect(nextCampaignCourse(save,"vale-bravo")).toBeNull();
    for (const id of CAMPAIGN_ORDER) { expect(courseUnlocked(save,id)).toBe(true); save = recordCampaign(save,id,3,190); }
    expect(readCampaign(JSON.stringify(save)).results).toEqual(save.results);
    expect(nextCampaignCourse(save,"pico-tempestade")).toBeNull();
    expect(nextCampaignCourse(save,"unknown")).toBeNull();
  });
  it("rejects corrupt, locked and invalid results; retains best results", () => {
    let save = readCampaign("broken");
    expect(recordCampaign(save,"pico-tempestade",1,20)).toEqual(save);
    expect(recordCampaign(save,"vale-bravo",0,20)).toEqual(save);
    save = recordCampaign(save,"vale-bravo",1,200);
    save = recordCampaign(save,"vale-bravo",4,220);
    expect(save.results["vale-bravo"]).toEqual({place:1,time:200});
  });
});
describe("glacier terrain", () => {
  it("shortcut is physically shorter, separated, and faster at identical speed", () => {
    setActiveCourse("passagem-geleira");
    const measure=(x:number)=>{let length=0,time=0;for(let s=910;s<1230;s+=.5){const a=courseWorldPoint(s,x),b=courseWorldPoint(s+.5,x);length+=Math.hypot(b.x-a.x,b.z-a.z);time+=.5/(40*courseAdvanceScale(s,0,40,x));}return {length,time};};
    const shortcut=measure(-14),main=measure(10);
    expect(shortcut.length).toBeLessThan(main.length*.9);
    expect(main.time-shortcut.time).toBeGreaterThan(1.2);
    expect(courseWorldPoint(1070,10).x-courseWorldPoint(1070,-14).x).toBeGreaterThan(140);
    expect(courseCeiling(600,14)).toBeLessThan(courseCeiling(600,0));
  });
  it("has physical divided lanes, finite tunnel clearance and natural launch surfaces", () => {
    setActiveCourse("passagem-geleira");
    expect(courseWallX(1000,5,-14)).toBeCloseTo(-6.8);
    expect(courseWallX(1000,-14,10)).toBeCloseTo(-3.2);
    expect(courseWallX(1300,-14,10)).toBe(-14);
    expect(courseWallX(600,20)).toBeCloseTo(16.2);
    expect(courseCeiling(600)-courseHeight(600)).toBeCloseTo(11);
    expect(courseCeiling(800)).toBe(Infinity);
    for (const ramp of RAMPS) expect(courseTerrainHeight(ramp.s,0)-courseHeight(ramp.s)).toBeCloseTo(ramp.height!);
    expect(courseAdvanceScale(1000,10,40)).toBeLessThan(courseAdvanceScale(1000,0,40));
    for (const pickup of [...COINS,...ITEM_BOXES]) if (pickup.s>=910 && pickup.s<=1230) expect(pickup.x < -8 || pickup.x > 0).toBe(true);
  });
  it("launches player and bot from the natural lip", () => {
    setActiveCourse("passagem-geleira");
    const rider=createRider(); rider.s=349.8; rider.x=0; rider.speed=40; rider.y=courseTerrainHeight(rider.s,0)+.46;
    updateRider(rider,{...EMPTY_INTENT,tuck:1},1/60);
    expect(rider.grounded).toBe(false); expect(rider.verticalSpeed).toBeGreaterThan(10);
    const bot=createRival(); bot.s=349.8; bot.x=0; bot.speed=40;
    updateRival(bot,350,0,1/60);
    expect(bot.grounded).toBe(false); expect(bot.verticalSpeed).toBeGreaterThan(10);
  });
  it("walls cause falls but shield absorbs the hit", () => {
    setActiveCourse("passagem-geleira");
    for(const shield of [0,4]) {
      const rider=createRider(); rider.s=550; rider.x=18; rider.y=courseHeight(550)+.46; rider.shieldTime=shield;
      const events=updateRider(rider,EMPTY_INTENT,1/60);
      expect(rider.x).toBeCloseTo(16.2);
      if(shield) { expect(rider.recovering).toBe(0); expect(events.some(e=>e.type==="SHIELD_BREAK")).toBe(true); }
      else expect(rider.recovering).toBeGreaterThan(0);
    }
  });
  it("bots finish all three laps without getting stuck in a branch", () => {
    setActiveCourse("passagem-geleira");
    const bot=createRival();
    for(let i=0;i<24000 && !bot.finished;i++) updateRival(bot,bot.s,0,1/60);
    expect(bot.finished).toBe(true);
  });
});
