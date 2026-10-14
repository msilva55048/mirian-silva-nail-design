import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getBookingHoliday,getBookingHolidays,getPublicBaseStartMinutes,isPublicBookingDateClosed} from '../src/shared/publicSchedule.ts';
import {getFixedAdminManualStartMinutes,getConfiguredAdminStartMinutes,getFixedClientStartMinutes,getConfiguredClientStartMinutes} from '../src/shared/domain.ts';
import {isClientBookingDateBlocked} from '../src/features/public/bookingDateRules.ts';
const early=[420,1170,1260],weekend=[420,540,660,780],full=[420,540,660,780,1020,1140];
for(const [date,expected] of [
 ['2026-10-18',weekend],['2026-10-19',full],['2026-10-20',full],['2026-10-21',[]],['2026-10-22',[]],['2026-10-23',[]],['2026-10-24',[]],['2026-10-25',[]],
 ['2026-10-26',[]],['2026-10-27',full],['2026-10-31',weekend],['2026-11-01',[]],
 ['2026-11-02',full],['2026-11-07',weekend],['2026-11-08',[]],
 ['2026-09-08',early],['2026-09-12',weekend],['2026-09-13',weekend],
]) test(`${date}: official public anchors`,()=>{
 assert.deepEqual(getPublicBaseStartMinutes(date),expected);
 assert.deepEqual(getFixedClientStartMinutes(date),expected);
 assert.deepEqual(getConfiguredClientStartMinutes(date,[]),expected);
});
test('explicit overrides still add/remove anchors on open dates',()=>{
 for(const [date,expected] of [['2026-10-20',full],['2026-10-31',[420,540,660,780]]])
  assert.deepEqual(getConfiguredClientStartMinutes(date,[{override_date:date,start_time:'09:00',is_available:true},{override_date:date,start_time:'19:30',is_available:false}]),expected);
});
test('all Sundays from the original public cutoff remain X/closed, including Sunday holidays',()=>{
 for(const date of ['2026-10-21','2026-10-22','2026-10-23','2026-10-24','2026-10-25','2026-10-26','2026-11-01','2026-11-08','2027-08-08','2027-08-15','2034-03-19']) {
  assert.equal(isPublicBookingDateClosed(date),true,date);
  assert.equal(isClientBookingDateBlocked(date),true,date);
  assert.deepEqual(getConfiguredClientStartMinutes(date,[{override_date:date,start_time:'09:00',is_available:true},{override_date:date,start_time:'19:00',is_available:true}]),[],date);
 }
});
test('grade administrativa de sábado e domingo permanece disponível no painel ADM',()=>{
 const weekend=Array.from({length:13},(_,index)=>420+index*30);
 for(const date of ['2027-08-08','2027-08-15','2034-03-19']) {
  assert.deepEqual(getFixedAdminManualStartMinutes(date),weekend,date);
  assert.deepEqual(getConfiguredAdminStartMinutes(date,[]),weekend,date);
 }
});
test('empty date has no anchors',()=>assert.deepEqual(getPublicBaseStartMinutes(''),[]));
test('catálogo contém feriados nacionais, estaduais e municipais confirmados por ano',()=>{
 for(let year=2027;year<=2040;year++){
  const holidays=getBookingHolidays(year);
  assert.equal(holidays.length,13,`${year}`);
  assert.equal(holidays.filter(item=>item.scope==='Nacional').length,9,`${year} nacionais`);
  assert.equal(holidays.filter(item=>item.scope==='Estadual - Santa Catarina').length,1,`${year} estaduais`);
  assert.equal(holidays.filter(item=>item.scope==='Municipal - São José/SC').length,3,`${year} municipais`);
  assert.ok(holidays.every(item=>item.name&&item.legalBasis),`${year} base legal`);
 }
 assert.equal(getBookingHoliday('2027-03-19')?.name,'Aniversário de São José (Dia de São José)');
 assert.equal(getBookingHoliday('2027-03-26')?.name,'Sexta-feira da Paixão');
 assert.equal(getBookingHoliday('2027-05-27')?.name,'Corpus Christi');
 assert.equal(getBookingHoliday('2027-02-15'),undefined,'Carnaval/ponto facultativo permanece fora');
 assert.equal(getBookingHoliday('2027-03-25'),undefined,'Quinta-feira Santa/ponto facultativo permanece fora');
});
test('datas móveis municipais seguem o domingo de Páscoa entre anos comuns e bissextos',()=>{
 const expected={2027:['2027-03-26','2027-05-27'],2028:['2028-04-14','2028-06-15'],2032:['2032-03-26','2032-05-27'],2040:['2040-03-30','2040-05-31']};
 for(const [year,[goodFriday,corpus]] of Object.entries(expected)){
  assert.equal(getBookingHolidays(Number(year)).find(item=>item.name==='Sexta-feira da Paixão')?.date,goodFriday);
  assert.equal(getBookingHolidays(Number(year)).find(item=>item.name==='Corpus Christi')?.date,corpus);
 }
});
test('Data Magna é transferida ao domingo seguinte quando 11 de agosto cai de segunda a sábado',()=>{
 assert.equal(getBookingHoliday('2027-08-15')?.scope,'Estadual - Santa Catarina');
 assert.equal(getBookingHoliday('2035-08-12')?.scope,'Estadual - Santa Catarina','transferência de sábado para domingo');
 assert.equal(getBookingHoliday('2040-08-12')?.scope,'Estadual - Santa Catarina','transferência de sábado para domingo');
 assert.deepEqual(getPublicBaseStartMinutes('2027-08-15'),[],'Data Magna em domingo não abre horários públicos');
});
test('cutoff 02/10 is inclusive and preserves the São Paulo calendar date',()=>{
 assert.deepEqual(getPublicBaseStartMinutes('2026-10-01'),early);
 assert.deepEqual(getPublicBaseStartMinutes('2026-10-02'),full);
 assert.equal(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}).format(new Date('2026-10-02T12:00:00Z')),'Fri');
});
