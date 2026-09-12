import {afterEach,it,expect} from "vitest";
import {setActiveCourse,RAMPS,courseHeight,rampLength,validateCourse} from "../src/core/course.ts";
import {createRider,updateRider,EMPTY_INTENT} from "../src/core/simulation.ts";
import {createFinaleScenery} from "../src/view/finaleScenery.ts";
afterEach(()=>setActiveCourse("vale-bravo"));
it("gives the finale its own gallery, natural jumps and crown landmarks",()=>{
  const c=setActiveCourse("pico-tempestade");
  expect(validateCourse()).toEqual([]);
  expect(c.tunnels).toHaveLength(1);
  expect(RAMPS.every(r=>r.natural)).toBe(true);
  expect(createFinaleScenery().children).toHaveLength(3);
});
it.each([18,40,58])("lands each finale jump aligned at %s m/s",speed=>{
  setActiveCourse("pico-tempestade");
  for(const ramp of RAMPS){
    const rider=createRider();rider.s=ramp.s-rampLength(ramp)-2;rider.x=0;rider.speed=speed;rider.y=courseHeight(rider.s)+.46;
    if(speed===58)rider.turboTime=5;
    let landed=false;
    for(let i=0;i<600;i++){
      const events=updateRider(rider,EMPTY_INTENT,1/60);
      expect(events.some(e=>e.type==="CRASH")).toBe(false);
      if(events.some(e=>e.type==="LAND")){landed=true;break;}
    }
    expect(landed).toBe(true);
  }
});
