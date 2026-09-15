import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260912140000_waitlist_opportunity_push.sql", "utf8");
const fn = fs.readFileSync("supabase/functions/waitlist-opportunity-push/index.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const serviceWorker = fs.readFileSync("public/push-sw.js", "utf8");

test("dispatcher de oportunidades é separado e idempotente", () => {
  assert.match(migration, /get_waitlist_opportunity_dispatch_targets/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /o\.appointment_date between r\.week_start and r\.week_end/);
  assert.match(fn, /waitlist_push_dispatches/);
  assert.match(fn, /insertError \|\| existingError \|\| !existing/);
  assert.match(fn, /skipped\+\+;\s+continue;/);
  assert.doesNotMatch(fn, /status:\"pending\",updated_at:new Date\(\)\.toISOString\(\),last_error:null/);
  assert.match(fn, /statusCode/);
  assert.match(fn, /status === 404 \|\| status === 410/);
});

test("cron da lista de espera é independente e roda a cada minuto", () => {
  assert.match(migration, /waitlist-opportunity-push/);
  assert.match(migration, /'\* \* \* \* \*'/);
  assert.match(migration, /waitlist_secret_key/);
});

test("deep-link consulta oportunidade pelo backend e registra abertura", () => {
  assert.match(app, /get_my_waitlist_opportunity/);
  assert.match(app, /mark_waitlist_opportunity_opened/);
  assert.match(app, /opportunity/);
  assert.match(app, /Vaga disponível/);
  assert.match(app, /startNewClientBooking\(\s*opportunity\.service_name,\s*opportunity\.appointment_date,\s*String\(opportunity\.start_time\)/);
  assert.match(app, /function startNewClientBooking\([\s\S]*?setShowClientAccount\(false\);[\s\S]*?setBookingStep\(2\);/);
  assert.match(app, /startNewClientBooking\(service\.name\)/);
  assert.match(app, /Escolha data e horário/);
  assert.match(app, /Revisar agendamento/);
  assert.match(app, /if \(clientOpportunity\) \{\s*await claimClientOpportunity\(\)/);
  assert.doesNotMatch(app, /debugOpportunity|OpportunityDebugRootBanner|Diagnóstico Opportunity/);
  assert.doesNotMatch(app, /if \(!opportunityId \|\| !clientProfile\) return;\s*setClientAccountSection\("appointments"\);\s*setShowClientAccount\(true\);/);
});

test("deep-link de opportunity tem prioridade sobre section=appointments", () => {
  assert.match(app, /setShowClientAccount\(false\);\s*setClientOpportunityLoading\(true\);/);
  assert.match(app, /setBookingStep\(2\);/);
  assert.match(app, /startNewClientBooking\(\s*opportunity\.service_name/);
  assert.match(app, /!isOpportunityBookingView/);
});

test("notificationclick mantém navegação e fallback dentro de event.waitUntil", () => {
  assert.match(serviceWorker, /event\.waitUntil\(\(async \(\) => \{/);
  assert.match(serviceWorker, /new URL\(event\.notification\.data\?\.url \|\| "\/admin", self\.location\.origin\)\.href/);
  assert.match(serviceWorker, /await existing\.navigate\(targetUrl\)/);
  assert.match(serviceWorker, /await .*\.focus\(\)/);
  assert.match(serviceWorker, /self\.clients\.openWindow\(targetUrl\)/);
});
