import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {scheduleFor} from '../supabase/functions/_shared/whatsapp-schedule.mjs';
const read = name => readFile(new URL('../supabase/'+name,import.meta.url),'utf8');

test('SQL claim: timezone, both schedules, catch-up, stale payload, no opt-in, hold and duplicate protection',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table client_profiles(id uuid primary key, phone text);
   create table appointments(id uuid primary key,client_phone text,client_name text,service_name text,appointment_date date,start_time time,status text);
   create table whatsapp_notifications(id bigserial primary key,appointment_id uuid references appointments(id),notification_type text,status text default 'pending',attempts integer default 0,provider_message_id text,scheduled_for timestamptz,recipient_phone text,payload jsonb,failed_at timestamptz,error_message text,updated_at timestamptz default now());
   create unique index notification_unique on whatsapp_notifications(appointment_id,notification_type);
  `);
  await db.exec(await read('migrations/20260907010000_hold_uncertain_whatsapp_sends.sql'));
  const sql=await read('migrations/20260908000000_whatsapp_dispatch_hours.sql');
  const id='00000000-0000-4000-8000-000000000001';
  const a={appointment_date:'2026-09-12',start_time:'14:30:00'};
  for(const [type,clock,count] of [
   ['reminder_40h','2026-09-11T07:59:59-03:00',0],
   ['reminder_40h','2026-09-11T08:00:00-03:00',1],
   ['reminder_40h','2026-09-11T20:30:00-03:00',1],
   ['reminder_40h','2026-09-12T00:00:00-03:00',0],
   ['reminder_2h','2026-09-12T12:29:59-03:00',0],
   ['reminder_2h','2026-09-12T12:35:00-03:00',1],
   ['reminder_2h','2026-09-12T13:30:00-03:00',0],
  ]) {
   await db.exec('truncate whatsapp_notifications,appointments');
   // Freeze only this in-memory function; production SQL keeps PostgreSQL now().
   await db.exec(sql.replaceAll('now()',`timestamptz '${clock}'`));
   await db.query('insert into appointments values ($1,$2,$3,$4,$5,$6,$7)',[id,'5548999999999','Ana Silva','Manicure',a.appointment_date,a.start_time,'confirmed']);
   const payload={version:2,phone:'5548999999999',message:'Synthetic',client_name:'Ana Silva',service_name:'Manicure',appointment_date:a.appointment_date,start_time:'14:30'};
   const args=[id,type,new Date(scheduleFor(type,a).scheduledFor).toISOString(),payload.phone,JSON.stringify(payload)];
   await db.query('insert into whatsapp_notifications(appointment_id,notification_type,scheduled_for,recipient_phone,payload) values($1,$2,$3,$4,$5)',args);
   await assert.rejects(db.query('insert into whatsapp_notifications(appointment_id,notification_type,scheduled_for,recipient_phone,payload) values($1,$2,$3,$4,$5)',args));
   assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,count,`${type} ${clock}`);
   assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,0);
  }
  await db.exec(sql.replaceAll('now()',"timestamptz '2026-09-12T12:35:00-03:00'"));
  await db.exec("update appointments set status='cancelled'");
  assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,0);
  await db.exec("update appointments set status='confirmed',client_phone='5548888888888'");
  assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,0);
  await db.exec("update appointments set client_phone='5548999999999'; update whatsapp_notifications set payload=payload-'version'");
  assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,0);
  await db.exec("update whatsapp_notifications set status='processing',attempts=1,updated_at=timestamptz '2026-09-12T12:00:00-03:00'");
  assert.equal((await db.query('select * from claim_due_whatsapp_notifications(1)')).rows.length,0);
  assert.equal((await db.query('select status from whatsapp_notifications')).rows[0].status,'failed');
 } finally {await db.close();}
});

test('cleanup proposal requires approval, refuses dependent views and preserves client data',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role authenticated; create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table client_profiles(id uuid primary key,user_id uuid,phone text);
    insert into client_profiles values('00000000-0000-4000-8000-000000000001',null,'synthetic');`);
  await db.exec(await read('migrations/20260906000000_whatsapp_reminder_opt_in.sql'));
  await db.exec(await read('migrations/20260906050000_fix_whatsapp_opt_in_user_id.sql'));
  const cleanup=await read('cleanup/remove_meta_opt_in.proposed.sql');
  await assert.rejects(db.exec(cleanup),/requires production audit/);await db.exec('rollback');
  await db.exec("set mirian.opt_in_cleanup_approved='yes'; create view dependent_test as select whatsapp_opt_in from client_profiles");
  await assert.rejects(db.exec(cleanup),/depend/);await db.exec('rollback');
  assert.equal((await db.query("select to_regprocedure('public.get_my_whatsapp_opt_in()') as f")).rows[0].f,'get_my_whatsapp_opt_in()');
  await db.exec('drop view dependent_test');await db.exec(cleanup);
  assert.deepEqual((await db.query('select phone from client_profiles')).rows,[{phone:'synthetic'}]);
  assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_name='client_profiles' and column_name like 'whatsapp_opt%'")).rows[0].n,0);
 } finally {await db.close();}
});
