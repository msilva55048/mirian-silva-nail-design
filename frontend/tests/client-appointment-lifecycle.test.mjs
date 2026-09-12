import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';

const app = readFileSync('src/App.tsx', 'utf8');
const sql = readFileSync('supabase/migrations/20260912180000_client_appointment_lifecycle.sql', 'utf8');
const marker = readFileSync('supabase/migrations/20260912170000_persist_confirmation_action.sql', 'utf8');
const tree = ts.createSourceFile('App.tsx', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let helper;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'getClientAppointmentDisplayStatus') helper = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
const display = new Function(ts.transpile(helper) + ';return getClientAppointmentDisplayStatus;')();

function functionSource(name) {
  let result;
  function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(tree);
    ts.forEachChild(node, walk);
  }
  walk(tree);
  return ts.transpile(result);
}

test('ação real só atualiza confirmação após sucesso e reload conserva timestamp e ordenação', async () => {
  let rows=[{id:'one',status:'confirmed',confirmation_sent_at:null}];
  let error='';
  let response={error:{message:'offline'},data:null};
  const supabase={rpc:async()=>response};
  const mark=new Function('supabase','setPanelError','setAppointments',functionSource('markConfirmationSent')+';return markConfirmationSent;')(
    supabase, value=>{error=value;}, update=>{rows=update(rows);});
  await mark(rows[0]);
  assert.ok(error.includes('continua pendente'));
  assert.equal(rows[0].confirmation_sent_at,null);
  response={error:null,data:'2026-10-10T15:00:00Z'};
  await mark(rows[0]);
  assert.equal(rows[0].confirmation_sent_at,response.data);
  assert.equal(display(rows[0]).label,'Confirmado');
  const confirmed={...rows[0],client_id:'client',appointment_date:'2026-10-10',start_time:'14:00'};
  response={error:null,data:[confirmed,{...confirmed,id:'older',status:'completed',appointment_date:'2026-09-01'}, {...confirmed,id:'newer',status:'cancelled',appointment_date:'2026-10-20'}]};
  const load=new Function('supabase','setClientAppointments',functionSource('loadClientAppointments')+';return loadClientAppointments;')(supabase,value=>{rows=value;});
  await load('client');
  assert.deepEqual(rows.map(r=>r.id),['newer','one','older']);
  assert.equal(display(rows[1]).label,'Confirmado');
});

test('status exibido usa confirmação e precedência de cancelamento/conclusão', () => {
  assert.deepEqual(display({status:'confirmed',confirmation_sent_at:null}), {label:'Agendado',className:'pending'});
  assert.deepEqual(display({status:'pending',confirmation_sent_at:'2026-10-10T15:00:00Z'}), {label:'Confirmado',className:'confirmed'});
  assert.deepEqual(display({status:'completed',confirmation_sent_at:null}), {label:'Realizado',className:'completed'});
  assert.deepEqual(display({status:'cancelled',confirmation_sent_at:'2026-10-10T15:00:00Z'}), {label:'Cancelado',className:'cancelled'});
});

test('RPC real e conclusão persistente respeitam duração, fuso, cancelamento, repetição e isolamento', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema cron;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.client_user',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'')='yes'$$;
      create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
      create table client_profiles(id uuid primary key,user_id uuid);
      create table appointments(id uuid primary key,client_id uuid,service_name text,appointment_date date,start_time time,duration_minutes integer,price_cents integer,status text,created_at timestamptz default now(),confirmation_sent_at timestamptz);
      insert into client_profiles values ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
      insert into appointments(id,client_id,service_name,appointment_date,start_time,duration_minutes,status)
      select ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
        case when n=5 then '00000000-0000-0000-0000-000000000002'::uuid else '00000000-0000-0000-0000-000000000001'::uuid end,
        'Serviço', '2026-10-10', '14:00', case when n=3 then 180 else 120 end,
        case when n=4 then 'cancelled' else 'confirmed' end from generate_series(1,5) n;
    `);
    await db.exec(marker + sql);
    await db.exec(`set test.admin='yes'; set test.client_user='10000000-0000-0000-0000-000000000001';`);
    const id = '20000000-0000-0000-0000-000000000001';
    const sent = (await db.query('select mark_appointment_confirmation_sent($1) as sent',[id])).rows[0].sent;
    assert.ok(sent);
    assert.equal((await db.query('select mark_appointment_confirmation_sent($1) as sent',[id])).rows[0].sent.getTime(),sent.getTime());
    let rows=(await db.query('select * from get_my_client_appointments_v2()')).rows;
    assert.equal(rows.length,4);
    assert.ok(rows.find(r=>r.id===id).confirmation_sent_at);
    assert.equal(display(rows.find(r=>r.id===id)).label,'Confirmado');
    // Same server calculation even when the database/session is in another timezone.
    await db.exec(`set timezone='Asia/Tokyo'`);
    assert.equal((await db.query("select complete_finished_appointments('2026-10-10T18:59:00Z') as n")).rows[0].n,0);
    assert.equal((await db.query("select complete_finished_appointments('2026-10-10T19:00:00Z') as n")).rows[0].n,3);
    assert.equal((await db.query("select complete_finished_appointments('2026-10-10T19:00:00Z') as n")).rows[0].n,0);
    rows=(await db.query('select * from get_my_client_appointments_v2()')).rows;
    assert.equal(rows.filter(r=>r.status==='completed').length,2); // includes unconfirmed appointment
    assert.equal(rows.find(r=>r.id.endsWith('3')).status,'confirmed'); // 180-minute snapshot
    assert.equal(rows.find(r=>r.id.endsWith('4')).status,'cancelled');
    await db.exec(`update appointments set status='cancelled' where id='${id}';`);
    await db.query("select complete_finished_appointments('2026-10-11T19:00:00Z')");
    assert.equal(display((await db.query('select * from get_my_client_appointments_v2() where id=$1',[id])).rows[0]).label,'Cancelado');
    await db.exec(`update appointments set appointment_date='2026-10-12' where id='${id}';`);
    rows=(await db.query('select * from get_my_client_appointments_v2()')).rows;
    assert.equal(rows[0].id,id); // newest date wins even when cancelled
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select complete_finished_appointments()'), /permission denied/);
  } finally { await db.close(); }
});

test('entrada publicada usa RPC persistente e atualiza histórico sem gravar ao abrir WhatsApp', () => {
  const opening=app.slice(app.indexOf('    function openWhatsAppNotification('),app.indexOf('    async function markConfirmationSent('));
  assert.doesNotMatch(opening,/supabase|localStorage|\.insert|\.update/);
  assert.match(app,/rpc\("get_my_client_appointments_v2"\)/);
  assert.match(app,/rpc\("mark_appointment_confirmation_sent"/);
  assert.match(app,/confirmation_sent_at: data/);
  assert.doesNotMatch(app,/markFinishedAppointmentsAsCompleted|dispatchedWhatsAppNotificationKeys/);
  assert.match(app,/clientAccountSection !== "appointments"/);
  assert.match(app,/window\.setInterval\(refresh, 15000\)/);
  assert.match(app,/\.client-account__status \{\s*display: flex;\s*align-items: center;\s*justify-content: center;\s*text-align: center;/);
});

