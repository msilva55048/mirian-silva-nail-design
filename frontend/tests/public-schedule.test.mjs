import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPublicBaseStartMinutes} from '../src/shared/publicSchedule.ts';
import {getFixedClientStartMinutes,getConfiguredClientStartMinutes} from '../src/shared/domain.ts';
for(const date of ['2026-09-08','2026-09-12','2026-09-13','2026-10-13','2026-10-14','2026-10-24','2026-10-25']) {
 test(`${date}: exactly 07:00,19:00,21:00 for public anchors`,()=>{
  assert.deepEqual(getPublicBaseStartMinutes(date),[420,1140,1260]);
  assert.deepEqual(getFixedClientStartMinutes(date),[420,1140,1260]);
  assert.deepEqual(getConfiguredClientStartMinutes(date,[]),[420,1140,1260]);
 });
}
test('26 October retains existing main-screen weekday schedule',()=>assert.deepEqual(getPublicBaseStartMinutes('2026-10-26'),[420,540,660,780,1020,1140]));
test('only explicit overrides can add a non-base anchor before cutoff',()=>{
 const date='2026-10-25';
 assert.deepEqual(getConfiguredClientStartMinutes(date,[{override_date:date,start_time:'09:00',is_available:true},{override_date:date,start_time:'19:00',is_available:false}]),[420,540,1260]);
});
test('empty date has no anchors',()=>assert.deepEqual(getPublicBaseStartMinutes(''),[]));

test('official cutoff dates, Saturday full grid and Sunday closed',()=>{
 const full=[420,540,660,780,1020,1140];
 for(const [date,expected] of [['2026-10-25',[420,1140,1260]],['2026-10-26',full],['2026-10-31',full],['2026-11-01',[]],['2026-11-02',full]]){
  assert.deepEqual(getPublicBaseStartMinutes(date),expected,date);
  assert.deepEqual(getConfiguredClientStartMinutes(date,[]),expected,date);
 }
 assert.deepEqual(getConfiguredClientStartMinutes('2026-11-01',[{override_date:'2026-11-01',start_time:'19:00',is_available:true}]),[]);
});
