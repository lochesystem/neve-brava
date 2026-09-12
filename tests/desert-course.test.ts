import {afterEach,describe,it,expect} from "vitest";
import {setActiveCourse,courseWorldPoint,courseHeight,courseCeiling,courseAdvanceScale,courseWallX,routeOffsetFor,isBridgeSurface,touchesItemBox,ITEM_BOXES,OBSTACLES,RAMPS} from "../src/core/course.ts";
import {createRider,updateRider,EMPTY_INTENT} from "../src/core/simulation.ts";
import {createRival,updateRival} from "../src/core/rival.ts";
afterEach(()=>setActiveCourse("vale-bravo"));
describe("Cânion Ferrugem",()=>{
  it("collects every bridge-section box at racing speed without credits",()=>{
    setActiveCourse("canion-ferrugem");
    const boxes=ITEM_BOXES.filter(b=>b.s>=1120&&b.s<=1740);
    expect(boxes.length).toBeGreaterThan(0);
    for(const box of boxes){
      const rider=createRider();rider.s=box.s-5;rider.x=box.x;rider.speed=54;rider.y=courseHeight(rider.s,rider.x)+.46;
      for(let i=0;i<30;i++)updateRider(rider,EMPTY_INTENT,1/60);
      expect(rider.collectedBoxes).toContain(box.id);
    }
  });
  it("cannot collect a box on the other bridge level",()=>{
    setActiveCourse("canion-ferrugem");
    const box={id:"deck-test",s:1430,x:0,radius:1.05,height:2.1,item:"wind" as const};
    expect(touchesItemBox({s:1430,x:-14,y:courseHeight(1430,-14)+.46},1429,box)).toBe(false);
    expect(touchesItemBox({s:1430,x:0,y:courseHeight(1430,0)+.46},1429,box)).toBe(true);
    // A visible overlap remains collectible just after crossing the old s-plane.
    expect(touchesItemBox({s:1430.3,x:0,y:courseHeight(1430.3,0)+.46},1430.1,box)).toBe(true);
  });
  it("keeps the default line on the broad deck and makes the shortcut peel left",()=>{
    const c=setActiveCourse("canion-ferrugem"),f=c.forks![0];
    expect(courseWallX(f.start+10,0,0)).toBe(0);
    expect(isBridgeSurface(1300,0)).toBe(true);
    expect(isBridgeSurface(1300,-14)).toBe(false);
    expect(isBridgeSurface(1800,0)).toBe(false);
    expect(c.halfWidth-f.right).toBeGreaterThanOrEqual(24);
    expect(c.halfWidth+f.left).toBeGreaterThanOrEqual(14);
    expect(routeOffsetFor(c,f.start+80,-14)).toBeLessThan(-20);
    expect(OBSTACLES.filter(o=>o.decorative&&o.s>=f.start&&o.s<=f.end)).toHaveLength(0);
  });
  it("has desert content without snow obstacles",()=>{
    const c=setActiveCourse("canion-ferrugem");expect(c.biome).toBe("desert");
    expect(OBSTACLES.every(o=>o.kind==="rock")).toBe(true);
    expect(RAMPS.every(r=>r.natural)).toBe(true);
  });
  it("crosses under the bridge with clearance and a genuinely shorter route",()=>{
    setActiveCourse("canion-ferrugem");let shortest=Infinity,crossing=0,main=0,shortcut=0;
    for(let s=1120;s<1740;s+=.5){
      main+=.5/courseAdvanceScale(s,0,40,10);shortcut+=.5/courseAdvanceScale(s,0,40,-14);
      const gap=Math.abs(courseWorldPoint(s,10).x-courseWorldPoint(s,-14).x);
      if(gap<shortest){shortest=gap;crossing=s;}
    }
    expect(shortest).toBeLessThan(1);
    expect(courseHeight(crossing,10)-courseHeight(crossing,-14)).toBeGreaterThan(18);
    expect(courseCeiling(crossing,-14)-courseHeight(crossing,-14)).toBeGreaterThan(17);
    expect(shortcut).toBeLessThan(main*.85);
  });
  it.each([-17,10])("player follows the correct physical floor on lane %s",x=>{
    setActiveCourse("canion-ferrugem");const r=createRider();r.s=1130;r.x=x;r.y=courseHeight(r.s,x)+.46;
    for(let i=0;i<6000&&r.s<1742;i++){
      updateRider(r,EMPTY_INTENT,1/60);
      if(r.grounded)expect(r.y).toBeCloseTo(courseHeight(r.s,r.x)+.46,3);
    }
    expect(r.s).toBeGreaterThanOrEqual(1742);
  });
  it("server bot completes all three laps",()=>{
    setActiveCourse("canion-ferrugem");const bot=createRival();
    for(let i=0;i<36000&&!bot.finished;i++)updateRival(bot,bot.s,0,1/60);
    expect(bot.finished).toBe(true);
  });
});
