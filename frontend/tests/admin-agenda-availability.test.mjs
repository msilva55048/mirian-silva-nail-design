import {getPublicBaseStartMinutes,isPublicBookingDateClosed} from '../src/shared/publicSchedule.ts';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {hasScheduleBlockConflict} from '../src/features/admin/scheduleBlockConflicts.ts';
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const nodes=[];function visit(n){nodes.push(n);ts.forEachChild(n,visit);}visit(tree);
const declaration=name=>nodes.find(n=>(ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n))&&n.name?.getText(tree)===name);
const fnNames=['timeToMinutes','minutesToTime','getMinutesFromTime','formatDateForInput','getAgendaDurationMinutes','isRepairAppointment','mergeIntervals','intervalsOverlap','isWeekendDate','getFixedClientStartMinutes','getFixedAdminManualStartMinutes','getFixedAdminNewAppointmentStartMinutes','getConfiguredClientStartMinutes','getConfiguredClientBlockEndMinutes','getClientBookingStartContext','canServiceUseClientStart'];
const constants=tree.statements.filter(ts.isVariableStatement).filter(n=>n.declarationList.declarations.some(d=>/^(CLIENT_|ADMIN_(WEEKDAY|WEEKEND)|REPAIR_|LAST_GENERATED_|OCTOBER_2026_)/.test(d.name.getText(tree))));
const defs="const isPublicBookingDateClosed = "+isPublicBookingDateClosed.toString()+"; const isClientBookingDateBlocked = isPublicBookingDateClosed; const getPublicBaseStartMinutes = "+getPublicBaseStartMinutes.toString()+";\n"+[...constants.map(n=>n.getText(tree)),...fnNames.map(n=>declaration(n).getText(tree))].join('\n');
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None}}).outputText;
function runMemo(name,vars){const body=declaration(name).initializer.arguments[0].getText(tree);return new Function(...Object.keys(vars),'hasScheduleBlockConflict',compile(defs+`\nreturn (${body})();`))(...Object.values(vars),hasScheduleBlockConflict);}
const helpers=new Function(compile(defs+'\nreturn {getClientBookingStartContext,canServiceUseClientStart,getConfiguredClientStartMinutes,getFixedAdminManualStartMinutes,getAgendaDurationMinutes};'))();
const date='2030-01-07';
const base=['07:00','09:00','11:00','13:00','17:00','19:00'];
const appt=(time,status='confirmed',duration=120,service='Manicure')=>({id:time,appointment_date:date,start_time:time,duration_minutes:duration,service_name:service,status,client_name:'Teste',client_phone:'',client_email:''});
const vars=(appointments=[],adminBlocks=[],adminTimeOverrides=[])=>({agendaDate:date,blockDate:date,appointments,adminBlocks,adminTimeOverrides,adminNow:new Date('2030-01-06T12:00:00')});
const override=(time,is_available=true)=>({override_date:date,start_time:time,is_available});
const agenda=(...args)=>runMemo('agendaAvailableTimes',vars(...args));
const blockTimes=(...args)=>runMemo('blockAvailableTimes',vars(...args));
async function save(times,overrides=[],appointments=[],blocks=[]){
 const v=vars(appointments,blocks,overrides),inserted=[];
 const scope={...v,selectedBlockTimes:times,blockAvailableTimes:blockTimes(appointments,blocks,overrides),blockReason:' teste ',setBlockError:()=>{},setIsSavingBlock:()=>{},setAdminBlocks:()=>{},setSelectedBlockTimes:()=>{},setBlockReason:()=>{},supabase:{
  from(table){
   assert.equal(table,'schedule_blocks');
   return {insert(rows){
    inserted.push(...rows);
    return {async select(){return {data:rows.map((r,i)=>({...r,id:String(i)})),error:null};}};
   }};
  }
 }};
 const call=new Function(...Object.keys(scope),compile(defs+'\n'+declaration('saveSelectedBlocks').getText(tree)+'\nreturn saveSelectedBlocks();'));
 await call(...Object.values(scope));return inserted;
}
test('top panel uses only public starts and hides occupied 09:00',()=>{assert.deepEqual(agenda(),base);assert.deepEqual(agenda([appt('09:00')]),base.filter(t=>t!=='09:00'));});
test('all configured anchors occupied leaves no administrative 30-minute false slots',()=>{assert.deepEqual(agenda(base.map(t=>appt(t))),[]);});
test('blocked anchor and partial overlap disappear immediately',()=>{assert.ok(!agenda([],[{block_date:date,start_time:'09:00',end_time:'11:00'}]).includes('09:00'));assert.ok(!agenda([appt('09:15', 'confirmed',30)]).includes('09:00'));});
test('only cancelled and no-show are ignored; completed still occupies',()=>{assert.deepEqual(agenda([appt('09:00','cancelled'),appt('11:00','no-show')]),base);assert.ok(!agenda([appt('09:00','completed')]).includes('09:00'));});
test('configured additions and removals are respected in both panels',()=>{const changes=[override('10:00'),override('11:00',false)];for(const list of [agenda([],[],changes),blockTimes([],[],changes)]){assert.ok(list.includes('10:00'));assert.ok(!list.includes('11:00'));}});
for(const [start,end] of [['09:00','11:00'],['11:00','13:00'],['13:00','17:00'],['19:00','19:30']])test(`saveSelectedBlocks inserts ${start}–${end}`,async()=>{assert.deepEqual((await save([start])).map(r=>[r.start_time,r.end_time]),[[start,end]]);});
test('added 10:00 becomes next boundary; removed anchor is never a boundary',async()=>{assert.deepEqual((await save(['09:00','10:00'],[override('10:00')])).map(r=>[r.start_time,r.end_time]),[['09:00','10:00'],['10:00','11:00']]);assert.equal((await save(['09:00'],[override('11:00',false)]))[0].end_time,'13:00');});
test('block selection checks entire interval and rejects stale selection',async()=>{assert.ok(!blockTimes([appt('10:00','confirmed',30)]).includes('09:00'));assert.deepEqual(await save(['09:00'],[],[appt('10:00','confirmed',30)]),[]);});
test('repair chains preserved, 20 minutes occupies 30, normal service never generates starts',()=>{
 const repair=t=>appt(t,'confirmed',20,'Reparo de Unha (Unitário)');
 assert.ok(agenda([repair('09:00')]).includes('09:30'));
 assert.ok(agenda([repair('09:00'),repair('09:30')]).includes('10:00'));
 assert.ok(!agenda([appt('09:00','confirmed',30)]).includes('09:30'));
 assert.ok(agenda([repair('19:00')]).includes('19:30'));
 assert.ok(!agenda([repair('19:00'),repair('19:30')]).includes('20:00'));
 assert.equal(helpers.getAgendaDurationMinutes(20),30);
 const context=helpers.getClientBookingStartContext(date,[{id:'r',date,startTime:'09:00',serviceName:'Reparo de Unha (Unitário)',durationMinutes:20,status:'confirmed'}]);
 assert.equal(helpers.canServiceUseClientStart(570,90,context),true);
 assert.equal(helpers.canServiceUseClientStart(570,120,context),false);
});
test('manual creation and edit retain their dedicated 30-minute choices',()=>{
 const common=vars();
 const manual=runMemo('manualAvailableTimes',{...common,manualDate:date,manualSelectedService:{duration_minutes:30}});
 assert.ok(manual.includes('09:30'));
 const edited=runMemo('editAppointmentAvailableTimes',{...common,editAppointmentDate:date,selectedAdminAppointment:{id:'existing'},editSelectedService:{duration_minutes:30}});
 assert.ok(edited.includes('09:30'));
});
test('memo invalidation includes blocks and overrides',()=>{
 for(const name of ['agendaAvailableTimes','blockAvailableTimes']){
 const deps=declaration(name).initializer.arguments[1].getText(tree);assert.match(deps,/adminBlocks/);assert.match(deps,/adminTimeOverrides/);
 }
});

test('public client availability still respects repair fit, occupancy and schedule blocks',()=>{
 const clientAppointments=[{id:'repair',date,startTime:'09:00',durationMinutes:20,serviceName:'Reparo de Unha (Unitário)',status:'confirmed'}];
 const publicFns=['getOccupiedIntervals','isPastTime','getAvailableTimes'].map(n=>declaration(n).getText(tree)).join('\n');
 const scope={appointments:clientAppointments,editingClientAppointment:null,scheduleBlocks:[{date,startTime:'11:00',endTime:'13:00'}],scheduleTimeOverrides:[],today:'2030-01-06'};
 const get=new Function(...Object.keys(scope),compile(defs+'\n'+publicFns+'\nreturn getAvailableTimes;'))(...Object.values(scope));
 const available=get(date,90);
 assert.ok(!available.includes('09:00'));
 assert.ok(available.includes('09:30'));
 assert.ok(!available.includes('11:00'));
 assert.ok(!get(date,120).includes('09:30'));
});

test('19:30 is generated only with 19:00 as the last configured anchor',()=>{
 const date='2026-10-25';
 const repair={id:'r',date,startTime:'19:00',serviceName:'Reparo de Unha (Unitário)',durationMinutes:20,status:'confirmed'};
 assert.ok(!helpers.getClientBookingStartContext(date,[repair]).generatedStarts.includes(1170));
 const removed=[{override_date:date,start_time:'21:00',is_available:false}];
 assert.ok(helpers.getClientBookingStartContext(date,[repair],removed).generatedStarts.includes(1170));
 const extra=[...removed,{override_date:date,start_time:'20:00',is_available:true}];
 assert.ok(!helpers.getClientBookingStartContext(date,[repair],extra).generatedStarts.includes(1170));
});
