import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {getPublicBaseStartMinutes} from '../src/shared/publicSchedule.ts';

test('corrective SQL and real create/reschedule RPCs follow official dates and repair rules',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema auth;
   create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
   create table client_profiles(id uuid primary key,user_id uuid,full_name text,phone text,email text);
   insert into client_profiles values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Teste','synthetic','synthetic');
   create table services(id bigint primary key,name text,duration_minutes integer,price_cents integer);
   insert into services values(1,'Normal',30,100),(2,'Reparo de Unha (Unitário)',20,100);
   create table appointments(id uuid primary key default gen_random_uuid(),client_id uuid,client_name text,client_phone text,client_email text,service_name text,appointment_date date,start_time time,duration_minutes integer,price_cents integer,status text);
   create table schedule_time_overrides(override_date date,start_time time,is_available boolean);
   create table schedule_blocks(block_date date,start_time time,end_time time);`);
  const old=await readFile(new URL('../supabase/migrations/20260908180000_dynamic_repair_slots.sql',import.meta.url),'utf8');
  // Only this synthetic database freezes the clock for repeatable 2026 fixtures.
  await db.exec(old.replaceAll('now()',"timestamptz '2026-09-08T12:00:00Z'"));
  await db.exec(await readFile(new URL('../supabase/migrations/20260908200000_correct_public_booking_schedule.sql',import.meta.url),'utf8'));
  const allowed=async(date,time,duration=30,name='Normal')=>(await db.query('select client_booking_start_allowed($1,$2,$3,$4,null) as ok',[date,time,name,duration])).rows[0].ok;
  const create=async(date,time,name='Normal')=>(await db.query('select create_my_appointment($1,$2,$3) as id',[name,date,time])).rows[0].id;
  let lastId;
  for(const date of ['2026-10-25','2026-10-26','2026-10-31','2026-11-01','2026-11-02']){
   const expected=getPublicBaseStartMinutes(date);
   assert.deepEqual((await db.query('select client_booking_base_start_minutes($1) as starts',[date])).rows[0].starts,expected);
   for(const min of [420,540,660,780,1020,1140,1260]){
    const time=String(Math.floor(min/60)).padStart(2,'0')+':00';
    assert.equal(await allowed(date,time),expected.includes(min),`${date} ${time}`);
    if(expected.includes(min)){
     lastId=await create(date,time);
     await db.query('select reschedule_my_appointment($1,$2,$3)',[lastId,date,time]);
    } else await assert.rejects(create(date,time));
   }
  }
  await assert.rejects(db.query('select reschedule_my_appointment($1,$2,$3)',[lastId,'2026-11-01','07:00']));
  await db.exec("insert into schedule_time_overrides values('2026-11-01','07:00',true)");
  assert.equal(await allowed('2026-11-01','07:00'),false);
  await db.exec('truncate appointments,schedule_time_overrides');
  await create('2026-10-25','19:00','Reparo de Unha (Unitário)');
  assert.equal(await allowed('2026-10-25','19:30'),false); // 21:00 still an anchor
  await db.exec("insert into schedule_time_overrides values('2026-10-25','21:00',false)");
  assert.equal(await allowed('2026-10-25','19:30',120),true);
  await create('2026-10-25','19:30','Reparo de Unha (Unitário)');
  assert.equal(await allowed('2026-10-25','20:00'),false);
  await db.exec("insert into schedule_time_overrides values('2026-10-25','20:00',true)");
  assert.equal(await allowed('2026-10-25','19:30'),false);
  await db.exec('truncate appointments,schedule_time_overrides');
  const repair=await create('2026-10-31','09:00','Reparo de Unha (Unitário)');
  assert.equal((await db.query('select duration_minutes from appointments where id=$1',[repair])).rows[0].duration_minutes,20);
  assert.equal(await allowed('2026-10-31','09:20'),false);
  await assert.rejects(db.query('select reschedule_my_appointment($1,$2,$3)',[repair,'2026-10-31','09:30'])); // no self-generated move
  await create('2026-10-31','09:30','Reparo de Unha (Unitário)');
  assert.equal(await allowed('2026-10-31','10:00',60),true);
  assert.equal(await allowed('2026-10-31','10:00',120),false);
  await db.exec("insert into schedule_time_overrides values('2026-10-31','10:30',true)");
  assert.equal(await allowed('2026-10-31','10:00',60),false);
  assert.equal(await allowed('2026-10-31','10:00',30),true);
 } finally {await db.close();}
});
