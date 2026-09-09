import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPublicBaseStartMinutes} from '../src/shared/publicSchedule.ts';
import {getFixedClientStartMinutes,getConfiguredClientStartMinutes} from '../src/shared/domain.ts';
const early=[420,1170,1260],weekend=[420,540,660,780],full=[420,540,660,780,1020,1140];
for(const [date,expected] of [
 ['2026-10-18',weekend],['2026-10-19',early],['2026-10-20',early],['2026-10-21',[]],['2026-10-22',[]],['2026-10-23',[]],['2026-10-24',[]],['2026-10-25',[]],
 ['2026-10-26',[]],['2026-10-27',full],['2026-10-31',weekend],['2026-11-01',[]],
 ['2026-11-02',full],['2026-11-07',weekend],['2026-11-08',[]],
 ['2026-09-08',early],['2026-09-12',weekend],['2026-09-13',weekend],
]) test(`${date}: official public anchors`,()=>{
 assert.deepEqual(getPublicBaseStartMinutes(date),expected);
 assert.deepEqual(getFixedClientStartMinutes(date),expected);
 assert.deepEqual(getConfiguredClientStartMinutes(date,[]),expected);
});
test('explicit overrides still add/remove anchors on open dates',()=>{
 for(const [date,expected] of [['2026-10-20',[420,540,1260]],['2026-10-31',[420,540,660,780]]])
  assert.deepEqual(getConfiguredClientStartMinutes(date,[{override_date:date,start_time:'09:00',is_available:true},{override_date:date,start_time:'19:30',is_available:false}]),expected);
});
test('closed Sundays cannot be reopened by overrides',()=>{
 for(const date of ['2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-11-01','2026-11-08']) assert.deepEqual(getConfiguredClientStartMinutes(date,[{override_date:date,start_time:'19:00',is_available:true}]),[]);
});
test('empty date has no anchors',()=>assert.deepEqual(getPublicBaseStartMinutes(''),[]));
