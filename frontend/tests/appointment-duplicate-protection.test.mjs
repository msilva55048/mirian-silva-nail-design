import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260916130000_prevent_duplicate_active_client_appointments.sql"),
  "utf8",
);

test("protege slots exatos ativos por cliente sem alterar regras de sobreposição", () => {
  assert.match(migration, /create unique index if not exists appointments_active_client_slot_unique/i);
  assert.match(migration, /on public\.appointments\s*\(client_id, appointment_date, start_time\)/i);
  assert.match(migration, /where status in \('pending', 'confirmed'\)/i);
  assert.doesNotMatch(migration, /duration_minutes|schedule_blocks|drop index/i);
});
