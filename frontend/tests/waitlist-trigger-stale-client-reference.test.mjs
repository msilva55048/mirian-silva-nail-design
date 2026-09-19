import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  "supabase/migrations/20260919023000_fix_waitlist_opportunity_trigger_stale_client_reference.sql",
  "utf8",
);

test("trigger de oportunidade não acessa client_id inexistente", () => {
  assert.match(migration, /create or replace function public\.capture_waitlist_client_notification\(\)/);
  assert.doesNotMatch(migration, /new\.client_id/i);
  assert.match(migration, /return new;/i);
});
