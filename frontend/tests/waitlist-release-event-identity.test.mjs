import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(new URL('../supabase/migrations/20260911120000_waitlist_release_event_identity.sql', import.meta.url), 'utf8');

test('usa versão monotônica do appointment como identidade do evento', () => {
  assert.match(migration, /waitlist_release_version bigint/i);
  assert.match(migration, /old\.waitlist_release_version, 0\) \+ 1/i);
  assert.match(migration, /release_event_version/i);
  assert.match(migration, /on conflict \(source_appointment_id, release_event_version\) do nothing/i);
});

test('permite nova liberação do mesmo slot após nova ocupação', () => {
  assert.match(migration, /drop constraint if exists waitlist_opportunities_source_appointment_id_appointment_da_key/i);
  assert.match(migration, /waitlist_opportunities_release_event_unique/i);
  assert.match(migration, /status = 'cancelled'/i);
});

test('não altera push, UI ou scheduler', () => {
  assert.doesNotMatch(migration, /client-web-push|notification|cron\.schedule|service_worker/i);
});
