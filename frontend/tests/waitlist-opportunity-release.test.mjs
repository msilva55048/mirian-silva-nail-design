import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(new URL('../supabase/migrations/20260911110000_waitlist_opportunities_on_release.sql', import.meta.url), 'utf8');

test('captura cancelamentos e reagendamentos server-side', () => {
  assert.match(migration, /after insert or update of status, appointment_date, start_time/i);
  assert.match(migration, /coalesce\(new\.status, ''\) in \('cancelled','canceled','cancelado','no_show','no-show'\)/i);
  assert.match(migration, /old\.appointment_date is distinct from new\.appointment_date/i);
  assert.match(migration, /old\.start_time is distinct from new\.start_time/i);
  assert.match(migration, /source_appointment_id, service_id, service_name_snapshot/i);
});

test('é idempotente por appointment e slot liberado', () => {
  assert.match(migration, /on conflict \(source_appointment_id, appointment_date, start_time\) do nothing/i);
  assert.doesNotMatch(migration, /client-web-push|notification|fetch\s*\(/i);
});

test('revalida futuro, bloqueio e ocupação concorrente', () => {
  assert.match(migration, /America\/Sao_Paulo/i);
  assert.match(migration, /schedule_blocks/i);
  assert.match(migration, /appointments a/i);
  assert.match(migration, /return false;/i);
});

test('invalida oportunidade aberta quando o slot é ocupado', () => {
  assert.match(migration, /update public\.waitlist_opportunities/i);
  assert.match(migration, /o\.status = 'open'/i);
  assert.match(migration, /set status = 'cancelled'/i);
});
