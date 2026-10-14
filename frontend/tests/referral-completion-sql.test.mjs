import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';

const migration = await readFile(new URL('../supabase/migrations/20261014100000_qualify_referral_on_first_completed_service.sql', import.meta.url), 'utf8');

async function createDb() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select '10000000-0000-0000-0000-000000000001'::uuid $$;
    create function public.is_mirian_admin() returns boolean language sql stable as $$ select true $$;

    create table public.client_profiles(id uuid primary key, user_id uuid, full_name text not null);
    create table public.client_referrals(
      id uuid primary key, referrer_client_id uuid not null, referred_client_id uuid not null unique,
      status text not null default 'pending', created_at timestamptz not null, qualified_at timestamptz
    );
    create table public.referral_rewards(
      id uuid primary key default gen_random_uuid(), client_id uuid not null,
      referral_id uuid not null unique, status text not null default 'available',
      discount_percent smallint not null default 30, earned_at timestamptz not null default now(),
      reserved_at timestamptz, used_at timestamptz
    );
    create table public.appointments(
      id uuid primary key, client_id uuid, status text not null,
      created_at timestamptz not null, appointment_date date not null,
      start_time time not null, duration_minutes integer not null default 60,
      is_referred_first_appointment boolean not null default false,
      referral_reward_id uuid, referral_discount_percent smallint,
      original_price_cents integer, price_cents integer
    );
    create table public.client_notifications(
      id uuid primary key default gen_random_uuid(), client_id uuid not null,
      type text not null, title text not null, message text not null,
      data jsonb not null, entity_type text, entity_id uuid, dedupe_key text not null unique
    );

    create function public.create_client_notification(
      p_client_id uuid,p_type text,p_title text,p_message text,p_data jsonb,
      p_entity_type text,p_entity_id uuid,p_dedupe_key text
    ) returns uuid language plpgsql as $$
    declare v_id uuid;
    begin
      insert into public.client_notifications(client_id,type,title,message,data,entity_type,entity_id,dedupe_key)
      values(p_client_id,p_type,p_title,p_message,p_data,p_entity_type,p_entity_id,p_dedupe_key)
      on conflict(dedupe_key) do nothing returning id into v_id;
      return v_id;
    end $$;
    create function public.reserve_available_referral_reward(p_client_id uuid)
      returns void language plpgsql as $$ begin return; end $$;

    insert into public.client_profiles(id,user_id,full_name) values
      ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Indicadora'),
      ('20000000-0000-0000-0000-000000000002',null,'Indicada'),
      ('20000000-0000-0000-0000-000000000003',null,'Outra indicada');
  `);
  await db.exec(migration);
  return db;
}

test('SQL qualifica após cancelamento, suporta restauração ADM e mantém o benefício idempotente', async () => {
  const db = await createDb();
  try {
    await db.exec(`
      insert into client_referrals(id,referrer_client_id,referred_client_id,created_at) values
        ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','2026-10-01T00:00:00Z');
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time,is_referred_first_appointment) values
        ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','confirmed','2026-10-02T00:00:00Z','2026-10-05','10:00',true);
      update appointments set status='cancelled' where id='40000000-0000-0000-0000-000000000001';
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time,is_referred_first_appointment) values
        ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','confirmed','2026-10-03T00:00:00Z','2026-10-06','10:00',false);
      update appointments set status='completed' where id='40000000-0000-0000-0000-000000000002';
    `);

    assert.deepEqual((await db.query(`select status from client_referrals where id='30000000-0000-0000-0000-000000000001'`)).rows, [{status:'rewarded'}]);
    assert.deepEqual((await db.query(`select status,discount_percent from referral_rewards where referral_id='30000000-0000-0000-0000-000000000001'`)).rows, [{status:'available',discount_percent:30}]);
    assert.equal((await db.query(`select count(*)::int n from client_notifications where type='referral-qualified'`)).rows[0].n,1);

    await db.exec(`
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time,is_referred_first_appointment) values
        ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','confirmed','2026-10-04T00:00:00Z','2026-10-07','10:00',false);
      update appointments set status='completed' where id='40000000-0000-0000-0000-000000000003';
      insert into client_referrals(id,referrer_client_id,referred_client_id,created_at) values
        ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','2026-10-01T00:00:00Z');
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time,is_referred_first_appointment) values
        ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','cancelled','2026-10-02T00:00:00Z','2026-10-05','10:00',false);
      update appointments set status='completed' where id='40000000-0000-0000-0000-000000000004';
    `);
    assert.equal((await db.query(`select count(*)::int n from referral_rewards`)).rows[0].n,2);
    assert.equal((await db.query(`select count(*)::int n from client_notifications where type='referral-qualified'`)).rows[0].n,2);
  } finally {
    await db.close();
  }
});

test('SQL recusa reserva anterior à indicação e não reaplica descontos após conclusão legada', async () => {
  const db = await createDb();
  try {
    await db.exec(`
      insert into client_referrals(id,referrer_client_id,referred_client_id,created_at) values
        ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','2026-10-03T00:00:00Z'),
        ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','2026-10-01T00:00:00Z');
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time) values
        ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','confirmed','2026-10-02T00:00:00Z','2026-10-05','10:00');
      update appointments set status='completed' where id='40000000-0000-0000-0000-000000000001';
      -- Mimic an existing completed row whose qualification trigger was missed.
      alter table appointments disable trigger appointments_finalize_referral_reward;
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time) values
        ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','completed','2026-10-02T00:00:00Z','2026-10-05','10:00');
      alter table appointments enable trigger appointments_finalize_referral_reward;
      insert into appointments(id,client_id,status,created_at,appointment_date,start_time) values
        ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','confirmed','2026-10-04T00:00:00Z','2026-10-07','10:00');
      update appointments set status='completed' where id='40000000-0000-0000-0000-000000000003';
    `);
    assert.equal((await db.query(`select count(*)::int n from referral_rewards`)).rows[0].n,0);
    assert.equal((await db.query(`select count(*)::int n from client_notifications where type='referral-qualified'`)).rows[0].n,0);
    assert.deepEqual((await db.query(`select referral_status from get_admin_referrals() where referral_id='30000000-0000-0000-0000-000000000002'`)).rows, [{referral_status:'REALIZADA'}]);
    assert.deepEqual((await db.query(`select referral_status,reward_id from get_my_active_referrals() where referral_id='30000000-0000-0000-0000-000000000002'`)).rows, [{referral_status:'REALIZADA',reward_id:null}]);
  } finally {
    await db.close();
  }
});
