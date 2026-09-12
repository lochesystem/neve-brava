import {afterEach,it,expect} from "vitest";
import {setActiveCourse,courseHeight} from "../src/core/course.ts";
import {createRider,updateRider,EMPTY_INTENT} from "../src/core/simulation.ts";
import {createRival,updateRival} from "../src/core/rival.ts";
import {createCourseStructures} from "../src/view/courseStructures.ts";
afterEach(()=>setActiveCourse("vale-bravo"));
it.each(["passagem-geleira","canion-ferrugem"])("contains riders gently and visibly on %s",id=>{
  const c=setActiveCourse(id),f=c.forks![0];
  for(const shield of [0,4])for(const side of [-1,1]){
    const rider=createRider();rider.s=f.start+30;rider.x=side<0?f.left-.81:f.right+.81;
    rider.lateralSpeed=-side*20;rider.speed=40;rider.shieldTime=shield;rider.y=courseHeight(rider.s,rider.x)+.46;
    const events=updateRider(rider,{...EMPTY_INTENT,steer:-side},1/30);
    expect(rider.recovering).toBe(0);
    expect(rider.speed).toBeGreaterThan(39);
    expect(events.some(e=>e.type==="SHIELD_BREAK")).toBe(false);
    expect(rider.x).toBeCloseTo(side<0?f.left-.8:f.right+.8);
    if(shield)expect(rider.shieldTime).toBeGreaterThan(3.9);
  }
  const bot=createRival();bot.s=f.start+30;bot.x=f.left-.81;bot.lateralSpeed=20;bot.y=courseHeight(bot.s,bot.x)+.52;
  updateRival(bot,bot.s,0,1/30);
  expect(bot.stun).toBe(0);
  expect(bot.x).toBeLessThanOrEqual(f.left-.8);
  expect(createCourseStructures().getObjectByName("fork-soft-boundary")).toBeDefined();
});
