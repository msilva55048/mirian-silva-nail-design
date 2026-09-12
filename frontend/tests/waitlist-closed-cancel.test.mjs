import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(new URL('../supabase/migrations/20260912130000_waitlist_closed_dates_and_delete_cancel.sql', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../src/features/admin/SharedWaitlist.tsx', import.meta.url), 'utf8');

test('lista de espera bloqueia o intervalo fechado em Cliente e Admin', () => {
  assert.match(migration, /waitlist_date_is_closed/);
  assert.match(migration, /date '2026-10-21' and date '2026-10-26'/i);
  assert.match(migration, /Esta data está fechada/);
  assert.match(app, /isBlocked = isClientBookingDateBlocked\(date\)/);
  assert.match(admin, /isClosed = isClientBookingDateBlocked\(date\)/);
});

test('cancelamento remove a solicitação e preserva os demais estados', () => {
  assert.match(migration, /delete from public\.waiting_list_requests r[\s\S]*cp\.user_id = auth\.uid\(\)/i);
  assert.match(migration, /delete from public\.waiting_list_requests\s+where id = p_request_id and status = 'active'/i);
  assert.match(migration, /delete from public\.waiting_list_requests where status = 'cancelled'/i);
  assert.doesNotMatch(migration, /update public\.waiting_list_requests[\s\S]*status = 'cancelled'/i);
});
