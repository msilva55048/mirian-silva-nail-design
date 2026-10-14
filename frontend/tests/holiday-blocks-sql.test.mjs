import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {getBookingHolidays} from '../src/shared/publicSchedule.ts';

test('feriados geram bloqueios editáveis sem abrir domingos para clientes nem ADM',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create schema auth;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   create function public.is_mirian_admin() returns boolean language sql stable as $$ select auth.uid()='11111111-1111-4111-8111-111111111111'::uuid $$;
   create table schedule_blocks(block_date date,start_time time,end_time time,reason text);
   insert into schedule_blocks values
    (date '2027-01-01','07:30','08:00',null),
    (date '2027-08-15','09:00','11:00','Feriado automático Estadual - Santa Catarina — Data Magna — legado');
   create table appointments(id integer primary key,appointment_date date,start_time time,status text);
   insert into appointments values(1,date '2027-09-07','09:00','confirmed');
   create function client_booking_start_allowed(p_date date,p_start_time time,p_service_name text,p_service_duration integer,p_excluded_appointment_id uuid default null)
    returns boolean language plpgsql as $$ begin
     if p_date between date '2026-10-21' and date '2026-10-26' or (p_date >= date '2026-11-01' and extract(isodow from p_date) = 7) then return false; end if;
     return true;
    end $$;`);
  const migration=await readFile(new URL('../supabase/migrations/20261014003020_seed_confirmed_booking_holidays_2027_2040.sql',import.meta.url),'utf8');
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::integer as n from booking_holidays')).rows[0].n,182);
  assert.deepEqual((await db.query('select min(holiday_date)::text as first,max(holiday_date)::text as last from booking_holidays')).rows[0],{first:'2027-01-01',last:'2040-12-25'});
  const sqlHolidays=(await db.query('select holiday_date::text as date,holiday_name as name,scope,legal_basis as "legalBasis" from booking_holidays order by holiday_date')).rows;
  const appHolidays=Array.from({length:14},(_,i)=>getBookingHolidays(2027+i)).flat().sort((a,b)=>a.date.localeCompare(b.date));
  assert.deepEqual(sqlHolidays,appHolidays,'calendário e catálogo no banco usam as mesmas datas e fundamentos');
  const initialBlockCount=(await db.query('select count(*)::integer as n from schedule_blocks')).rows[0].n;
  assert.ok(initialBlockCount>140,'cada feriado tem blocos removíveis por faixa horária');
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks where block_date='2027-01-01' and start_time='07:30' and end_time='08:00' and reason is null")).rows[0].n,1,'bloqueio manual existente preservado');
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks a join schedule_blocks b on a.block_date=b.block_date and a.ctid<>b.ctid and a.start_time<b.end_time and a.end_time>b.start_time where a.reason like 'Feriado automático %' and b.reason is null")).rows[0].n,0,'bloqueios automáticos não sobrepõem bloqueios manuais existentes');
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks a join schedule_blocks b on a.block_date=b.block_date and a.ctid<b.ctid and a.start_time<b.end_time and a.end_time>b.start_time where a.reason like 'Feriado automático %' and b.reason like 'Feriado automático %'")).rows[0].n,0,'faixas automáticas não se sobrepõem');
  assert.deepEqual((await db.query("select array_agg(start_time::text || '-' || end_time::text order by start_time) as bands from schedule_blocks where block_date='2027-09-07'")).rows[0].bands,['07:00:00-09:00:00','09:00:00-11:00:00','11:00:00-13:00:00','13:00:00-17:00:00','17:00:00-19:00:00','19:00:00-21:00:00'],'feriado nacional bloqueia toda a jornada útil em faixas removíveis');
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks where block_date='2027-08-15'")).rows[0].n,0,'feriado estadual em domingo não gera bloqueios automáticos de atendimento');
  assert.equal((await db.query("select count(*)::integer as n from booking_holiday_block_exceptions where holiday_date='2027-08-15' and start_time='09:00' and end_time='11:00'")).rows[0].n,1,'faixa automática antiga de domingo removida sem esquecer a exceção');
  assert.equal((await db.query("select count(*)::integer as n from appointments where appointment_date='2027-09-07' and status='confirmed'")).rows[0].n,1,'agendamento confirmado preservado');
  assert.deepEqual((await db.query("select client_booking_base_start_minutes(date '2027-08-15') as starts")).rows[0].starts,[]);
  assert.deepEqual((await db.query("select client_booking_base_start_minutes(date '2027-08-08') as starts")).rows[0].starts,[]);
  assert.deepEqual((await db.query("select client_booking_base_start_minutes(date '2034-03-19') as starts")).rows[0].starts,[],'feriado municipal no domingo não cria âncoras públicas');
  assert.equal((await db.query("select client_booking_start_allowed(date '2027-08-15','09:00','Normal',30,null) as ok")).rows[0].ok,false);
  assert.equal((await db.query("select client_booking_start_allowed(date '2027-08-08','09:00','Normal',30,null) as ok")).rows[0].ok,false);
  assert.equal((await db.query("select client_booking_start_allowed(date '2034-03-19','09:00','Normal',30,null) as ok")).rows[0].ok,false,'RPC pública recusa domingo feriado');
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks where block_date='2034-03-19'")).rows[0].n,0,'domingo feriado não recebe bloqueios automáticos que interfiram no ADM');
  await db.query("select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)");
  await assert.rejects(db.query("insert into appointments values(2,date '2034-03-19','09:00','confirmed')"),/Agendamentos públicos não são permitidos aos domingos/,'backend bloqueia inserção de cliente no domingo feriado');
  await db.query("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)");
  await db.query("insert into appointments values(2,date '2027-08-08','09:00','confirmed'),(3,date '2034-03-19','11:00','confirmed')");
  assert.equal((await db.query("select count(*)::integer as n from appointments where appointment_date in ('2027-08-08','2034-03-19') and status='confirmed'")).rows[0].n,2,'administradora pode criar manualmente em domingo comum e feriado');
  assert.equal((await db.query("select count(*)::integer as n from booking_holidays where scope like 'Municipal%'")).rows[0].n,42);
  assert.equal((await db.query("select count(*)::integer as n from booking_holidays where holiday_date='2027-05-27' and holiday_name='Corpus Christi' and scope='Municipal - São José/SC'")).rows[0].n,1,'Corpus Christi móvel municipal');
  assert.equal((await db.query("select count(*)::integer as n from booking_holidays where holiday_date='2027-03-26' and holiday_name='Sexta-feira da Paixão' and scope='Municipal - São José/SC'")).rows[0].n,1,'Sexta-feira da Paixão municipal');
  assert.equal((await db.query("select count(*)::integer as n from booking_holidays where holiday_date='2027-02-15'")).rows[0].n,0,'Carnaval facultativo excluído');
  await db.exec("delete from schedule_blocks where block_date = date '2027-09-07' and start_time='09:00' and end_time='11:00' and reason like 'Feriado automático %'");
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks where block_date='2027-09-07' and start_time='09:00' and end_time='11:00'")).rows[0].n,0,'exclusão fica persistente: não há sincronização recorrente');
  assert.equal((await db.query("select count(*)::integer as n from booking_holiday_block_exceptions where holiday_date='2027-09-07' and start_time='09:00' and end_time='11:00'")).rows[0].n,1,'exclusão registrada como exceção permanente');
  await db.exec(migration);
  assert.equal((await db.query("select count(*)::integer as n from schedule_blocks where block_date='2027-09-07' and start_time='09:00' and end_time='11:00'")).rows[0].n,0,'reexecução não recria a liberação manual');
  assert.equal((await db.query('select count(*)::integer as n from schedule_blocks')).rows[0].n,initialBlockCount-1,'reexecução não duplica bloqueios nem restaura o registro apagado');
 }finally{await db.close();}
});
