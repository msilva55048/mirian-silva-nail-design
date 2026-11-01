import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {getPublicBaseStartMinutes} from '../src/shared/publicSchedule.ts';

test('migration aplica âncoras de terça no backend sem reescrever appointments e valida limites', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create role service_role;
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function public.is_mirian_admin() returns boolean language sql as $$ select false $$;
      create table public.appointments(
        id uuid primary key default gen_random_uuid(), appointment_date date not null,
        start_time time not null, duration_minutes integer not null,
        service_name text not null, status text default 'confirmed'
      );
      create table public.schedule_time_overrides(
        override_date date not null, start_time time not null, is_available boolean not null
      );
      create table public.schedule_blocks(
        block_date date not null, start_time time not null, end_time time not null
      );
      insert into public.appointments(id, appointment_date, start_time, duration_minutes, service_name)
      values ('00000000-0000-4000-8000-000000000011','2027-01-05','08:30',60,'Antigo');
    `);
    const migration = await readFile(new URL('../supabase/migrations/20261101120000_tuesday_2027_public_schedule_anchors.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(`create trigger appointments_test_anchor_validation
      before insert or update of appointment_date,start_time,duration_minutes,service_name
      on public.appointments for each row execute function public.validate_client_anchor_boundaries();`);

    const anchorsFor = async (date) => (await db.query('select client_booking_base_start_minutes($1) as starts', [date])).rows[0].starts;
    assert.deepEqual(await anchorsFor('2026-12-29'), getPublicBaseStartMinutes('2026-12-29'));
    assert.deepEqual(await anchorsFor('2027-01-05'), getPublicBaseStartMinutes('2027-01-05'));
    assert.deepEqual(await anchorsFor('2027-01-06'), getPublicBaseStartMinutes('2027-01-06'));

    const allowed = async (date, time, duration, name = 'Normal') => (await db.query(
      'select client_booking_start_allowed($1,$2,$3,$4,null) as allowed', [date, time, name, duration],
    )).rows[0].allowed;
    assert.equal(await allowed('2027-01-05', '13:30', 120), true);
    assert.equal(await allowed('2027-01-05', '15:30', 120), true);
    assert.equal(await allowed('2027-01-05', '19:30', 120), true, 'terça fecha às 21:30');
    assert.equal(await allowed('2027-01-05', '19:30', 150), false, 'terça não ultrapassa 21:30');
    assert.equal(await allowed('2027-01-06', '19:00', 120), true, 'quarta mantém fechamento às 21:00');
    assert.equal(await allowed('2027-01-06', '19:00', 150), false);
    assert.equal(await allowed('2026-12-29', '19:30', 30), false, 'terça antiga conserva limite público');

    const insert = (time, duration) => db.query(
      `insert into public.appointments(appointment_date,start_time,duration_minutes,service_name)
       values ('2027-01-05',$1,$2,'Normal')`, [time, duration],
    );
    await insert('13:30', 30);
    await insert('15:30', 30);
    await insert('19:30', 120);
    await insert('09:30', 60);
    await assert.rejects(insert('19:30', 150), /21:30/);
    await assert.rejects(insert('15:30', 30), /Horário ocupado/);
    await db.exec("insert into public.schedule_blocks values ('2027-01-05','17:30','18:30')");
    await assert.rejects(insert('17:30', 30), /Horário bloqueado/);

    assert.equal(await allowed('2027-01-05', '09:30', 60), true, 'dinâmico termina exatamente em 10:30');
    assert.equal(await allowed('2027-01-05', '09:30', 90), false, 'dinâmico não atravessa 10:30');
    await assert.rejects(insert('09:30', 90), /dinâmico inválido/);

    const preserved = (await db.query(`select appointment_date::text, start_time::text, duration_minutes, service_name
      from public.appointments where id='00000000-0000-4000-8000-000000000011'`)).rows[0];
    assert.deepEqual(preserved, {
      appointment_date: '2027-01-05', start_time: '08:30:00', duration_minutes: 60, service_name: 'Antigo',
    });
  } finally {
    await db.close();
  }
});
