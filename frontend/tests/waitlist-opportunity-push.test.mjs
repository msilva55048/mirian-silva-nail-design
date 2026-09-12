import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260912140000_waitlist_opportunity_push.sql", "utf8");
const fn = fs.readFileSync("supabase/functions/waitlist-opportunity-push/index.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

test("dispatcher de oportunidades é separado e idempotente", () => {
  assert.match(migration, /get_waitlist_opportunity_dispatch_targets/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /o\.appointment_date between r\.week_start and r\.week_end/);
  assert.match(fn, /waitlist_push_dispatches/);
  assert.match(fn, /\["sent","opened"\]/);
  assert.match(fn, /statusCode/);
  assert.match(fn, /status === 404 \|\| status === 410/);
});

test("cron da lista de espera é independente e roda a cada minuto", () => {
  assert.match(migration, /waitlist-opportunity-push/);
  assert.match(migration, /'\* \* \* \* \*'/);
  assert.match(migration, /service_role_key/);
});

test("deep-link consulta oportunidade pelo backend e registra abertura", () => {
  assert.match(app, /get_my_waitlist_opportunity/);
  assert.match(app, /mark_waitlist_opportunity_opened/);
  assert.match(app, /opportunity/);
  assert.match(app, /Vaga disponível/);
});
